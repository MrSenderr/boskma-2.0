// stuur-loonbureau
// POST { mutatie_html, files, emp_naam, lb_contract }
// → Genereert mutatieformulier PDF, haalt overige bestanden op,
//   stuurt alles als bijlage naar het loonbureau.
//
// Het adres staat in de tabel instellingen onder 'loonbureau_naar', zodat een
// nieuw adres of een andere contactpersoon geen nieuwe versie van deze functie
// vraagt. Lukt het lezen niet, dan gaat het naar het algemene adres hieronder —
// nooit naar een persoon die er misschien niet meer werkt.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { wieBelt } from "../_shared/beller.ts";
import { VAN_LOONBUREAU, bufNaarBase64, isOefenkaart, oefenBalk } from "../_shared/loonbureau.ts";

const GOTENBERG_URL  = Deno.env.get("GOTENBERG_URL")!;
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY")!;
const TO_STANDAARD   = "info@lbwf.nl";
const CC_EMAIL       = "sander@boskmafoodservice.nl";

/* Resend neemt een mail van hooguit veertig megabyte aan, en base64 maakt een
   bestand een derde groter. Twintig megabyte aan bijlagen blijft daar ruim
   onder en is voor een mutatieformulier met een paar scans meer dan zat. */
const MAX_BIJLAGEN_BYTES = 20 * 1024 * 1024;

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

/** Naar welk adres het loonbureau post krijgt. */
async function leesOntvanger(): Promise<string> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.loonbureau_naar&select=waarde`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    if (!r.ok) return TO_STANDAARD;
    const adres = (await r.json())?.[0]?.waarde?.adres;
    return typeof adres === "string" && adres.includes("@") ? adres : TO_STANDAARD;
  } catch {
    return TO_STANDAARD;
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
    /* Deze functie mailt het mutatieformulier met bijlagen naar het
       loonbureau: contracten, loonheffingsverklaringen, kopieën van een
       identiteitsbewijs. Niets daarvan hoort in gang gezet te kunnen worden
       door iemand die alleen de publieke sleutel uit de webapp heeft. */
    if (!(await wieBelt(req))) return jsonErr("hier mag je niet bij", 403);

    /* onderwerp, bestandsnaam en bericht zijn er sinds 25 oktober 2026, voor
       het verzoek om een contract bij een verlenging. Dat is geen
       mutatieformulier en hoort ook niet zo in de inbox van het loonbureau te
       staan. Blijven ze leeg, dan gaat alles zoals het ging. */
    const { mutatie_html, files, emp_naam, lb_contract, onderwerp, bestandsnaam, bericht,
            medewerker_id } = await req.json();
    if (!mutatie_html || !emp_naam) return jsonErr("mutatie_html en emp_naam zijn vereist", 400);

    const attachments: { filename: string; content: string }[] = [];
    let bytesTotaal = 0;

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
          filename: `${safeName(bestandsnaam || "mutatieformulier")}_${safeName(emp_naam)}.pdf`,
          content: bufNaarBase64(pdfBuf),
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
        /* Een grens, zodat een te zware bijlage een melding oplevert die
           uitlegt wat er aan de hand is. Zonder dit loopt de functie stuk op
           het geheugen en krijg je alleen "non-2xx status code" te zien — een
           zin waar niemand iets aan heeft. */
        bytesTotaal += buf.byteLength;
        if (bytesTotaal > MAX_BIJLAGEN_BYTES) {
          return jsonErr(
            `De bijlagen zijn samen te groot (meer dan ${Math.round(MAX_BIJLAGEN_BYTES / 1024 / 1024)} MB). ` +
              `Het struikelblok is meestal een foto van een identiteitsbewijs die rechtstreeks ` +
              `van een telefoon komt. Maak die kleiner en zet hem opnieuw in het dossier.`,
            413,
          );
        }
        attachments.push({ filename: f.filename, content: bufNaarBase64(buf) });
      } catch (e) {
        console.warn("[stuur-loonbureau] Bestand overgeslagen:", f.url ?? f.pad, e);
      }
    }

    if (attachments.length === 0) return jsonErr("Geen bestanden konden worden opgehaald", 500);

    const tm = await leesTestmodus();
    const naarLoonbureau = await leesOntvanger();

    /* Post over de testmedewerker gaat nooit naar buiten, ook niet als de
       testmodus uit staat. Anders krijgt het loonbureau bij de eerste oefening
       een verzoek om een contract voor een verzonnen persoon. */
    const oefening = await isOefenkaart(medewerker_id);
    const binnenhouden = tm.aan || oefening;
    const ontvanger = oefening ? CC_EMAIL : tm.aan ? tm.adres : naarLoonbureau;

    // 3. Verstuur via Resend
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: VAN_LOONBUREAU,
        to: [ontvanger],
        ...(binnenhouden ? {} : { cc: [CC_EMAIL] }),
        subject: `${oefening ? "[OEFENING] " : tm.aan ? "[TEST] " : ""}${
          onderwerp
            ? `${onderwerp} — ${emp_naam}`
            : `Mutatieformulier + bijlagen — ${emp_naam}${lb_contract ? " (contract door loonbureau)" : ""}`
        }`,
        html:
          (oefening ? oefenBalk(naarLoonbureau) : tm.aan ? testBalk(naarLoonbureau) : "") +
          (bericht
            ? eigenMailBody(bericht, attachments.map((a) => a.filename))
            : buildMailBody(emp_naam, attachments.map((a) => a.filename), lb_contract)),
        attachments,
      }),
    });

    if (!mailRes.ok) {
      const err = await mailRes.text();
      console.error("[stuur-loonbureau] Resend fout:", err);
      return jsonErr("Verzenden mislukt: " + err, 500);
    }

    return new Response(JSON.stringify({ ok: true, testmodus: binnenhouden, oefening, verstuurd_naar: ontvanger, bijlagen: attachments.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[stuur-loonbureau]", err.message);
    return jsonErr(err.message, 500);
  }
});

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

/* Een eigen begeleidend berichtje, met dezelfde bijlagenlijst eronder. De
   tekst komt uit de app en wordt ontsnapt: het loonbureau hoort geen html uit
   een invoerveld te krijgen. */
function eigenMailBody(tekst: string, bestanden: string[]): string {
  const veilig = String(tekst).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lijst = bestanden.map(f => `<li>${f}</li>`).join("");
  return `<p>${veilig}</p>
<p>Bijgevoegd:</p><ul>${lijst}</ul>
<p style="color:#888;font-size:12px;margin-top:24px">Boskma Foodservice V.O.F. · Dorpsstraat 82, 1693 AH Wervershoof</p>`;
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
