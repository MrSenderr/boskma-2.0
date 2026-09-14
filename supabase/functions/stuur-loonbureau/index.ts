// stuur-loonbureau
// POST { mutatie_html, files, emp_naam, lb_contract }
// → Genereert mutatieformulier PDF, haalt overige bestanden op,
//   stuurt alles als bijlage naar loonbureau@boskmafoodservice.nl

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOTENBERG_URL  = Deno.env.get("GOTENBERG_URL")!;
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = "onboarding@boskmafoodservice.nl";
const TO_EMAIL       = "h.mes@lbwf.nl";
const CC_EMAIL       = "sander@boskmafoodservice.nl";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** Testmodus staat in de tabel instellingen. Staat hij aan, dan gaat er niets
 *  naar het loonbureau maar alles naar het testadres.
 *
 *  Bij twijfel — tabel onbereikbaar, rij weg, rare waarde — nemen we aan dat hij
 *  AAN staat. Liever een mail te weinig naar buiten dan een te veel. */
async function leesTestmodus() {
  const veilig = { aan: true, adres: CC_EMAIL };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    if (!r.ok) return veilig;
    const rijen = await r.json();
    const w = rijen?.[0]?.waarde;
    if (!w || typeof w !== "object") return veilig;
    return { aan: w.aan !== false, adres: w.adres || CC_EMAIL };
  } catch {
    return veilig;
  }
}

function testBalk(echteOntvanger: string) {
  return `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#5c4310">
    <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${echteOntvanger}</strong>.
    Het loonbureau heeft niets ontvangen.
  </div>`;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonErr("Method not allowed", 405);

  try {
    const { mutatie_html, files, emp_naam, lb_contract } = await req.json();
    if (!mutatie_html || !emp_naam) return jsonErr("mutatie_html en emp_naam zijn vereist", 400);

    const attachments: { filename: string; content: string }[] = [];

    // 1. Genereer mutatieformulier PDF via Gotenberg
    const formData = new FormData();
    formData.append("files", new Blob([mutatie_html], { type: "text/html; charset=utf-8" }), "index.html");
    formData.append("emulatedMediaType", "print");
    formData.append("preferCssPageSize", "true");
    formData.append("printBackground", "true");

    try {
      const gRes = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
        method: "POST", body: formData,
        signal: AbortSignal.timeout(30000),
      });
      if (gRes.ok) {
        const pdfBuf = await gRes.arrayBuffer();
        attachments.push({
          filename: `mutatieformulier_${safeName(emp_naam)}.pdf`,
          content: bufToBase64(pdfBuf),
        });
      } else {
        const errTxt = await gRes.text();
        console.error("[stuur-loonbureau] Gotenberg fout:", gRes.status, errTxt);
      }
    } catch (gErr) {
      console.error("[stuur-loonbureau] Gotenberg onbereikbaar:", gErr);
    }

    // 2. Overige bestanden ophalen en toevoegen
    for (const f of (files || [])) {
      // Een bijlage komt binnen als volledig webadres of als pad in de opslag.
      // Bij een pad halen we hem op met de service role, zodat de bak niet
      // openbaar hoeft te zijn.
      const bron = f.url
        ? { adres: f.url, headers: {} as Record<string, string> }
        : f.pad
          ? {
              adres: `${SB_URL}/storage/v1/object/${f.bucket ?? "Documenten"}/${f.pad}`,
              headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
            }
          : null;
      if (!bron) continue;
      try {
        const fRes = await fetch(bron.adres, { headers: bron.headers });
        if (!fRes.ok) continue;
        const buf = await fRes.arrayBuffer();
        attachments.push({ filename: f.filename, content: bufToBase64(buf) });
      } catch (e) {
        console.warn("[stuur-loonbureau] Bestand overgeslagen:", f.url ?? f.pad, e);
      }
    }

    if (attachments.length === 0) return jsonErr("Geen bestanden konden worden opgehaald", 500);

    const tm = await leesTestmodus();

    // 3. Verstuur via Resend
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [tm.aan ? tm.adres : TO_EMAIL],
        ...(tm.aan ? {} : { cc: [CC_EMAIL] }),
        subject: `${tm.aan ? "[TEST] " : ""}Mutatieformulier + bijlagen — ${emp_naam}${lb_contract ? " (contract door loonbureau)" : ""}`,
        html: (tm.aan ? testBalk(TO_EMAIL) : "") + buildMailBody(emp_naam, attachments.map(a => a.filename), lb_contract),
        attachments,
      }),
    });

    if (!mailRes.ok) {
      const err = await mailRes.text();
      console.error("[stuur-loonbureau] Resend fout:", err);
      return jsonErr("Verzenden mislukt: " + err, 500);
    }

    return new Response(JSON.stringify({ ok: true, testmodus: tm.aan, verstuurd_naar: tm.aan ? tm.adres : TO_EMAIL, bijlagen: attachments.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[stuur-loonbureau]", err.message);
    return jsonErr(err.message, 500);
  }
});

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function safeName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function buildMailBody(naam: string, bestanden: string[], lbContract: boolean): string {
  const lijst = bestanden.map(f => `<li>${f}</li>`).join("");
  return `<p>Hierbij de documenten voor de loonadministratie van <strong>${naam}</strong>.</p>
<p>Bijgevoegd:</p><ul>${lijst}</ul>
${lbContract ? "<p><strong>Verzoek: loonbureau stelt het contract op.</strong></p>" : ""}
<p style="color:#888;font-size:12px;margin-top:24px">Boskma Foodservice V.O.F. · Dorpsstraat 82, 1693 AH Wervershoof</p>`;
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
