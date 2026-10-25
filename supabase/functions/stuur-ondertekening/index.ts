// stuur-ondertekening
// POST { ondertekening: uuid }
// → laat de medewerker weten dat er een contract klaarligt om te tekenen, per
//   mail en met een pushbericht als hij meldingen aan heeft, en zet
//   verstuurd_op.
//
// Hetzelfde patroon als stuur-voorstel: de functie zoekt de rij zelf op en
// gebruikt uit het verzoek alleen het nummer. Anders kan wie de publieke
// sleutel heeft — en die staat in elke browser — post namens Sander naar een
// adres naar keuze sturen.
//
// Het contract zelf gaat niet mee als bijlage. Tekenen doe je in de app, en
// daar staat het stuk; een PDF in de mail is een tweede versie waarvan niemand
// weet of het dezelfde is.

import { wieBelt } from "../_shared/beller.ts";
import { pushNaar } from "../_shared/push.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "onboarding@boskmafoodservice.nl";
const CC_EMAIL = "sander@boskmafoodservice.nl";
const APP_URL = Deno.env.get("APP_URL") ?? "https://nieuw.boskmafoodservice.nl";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Bij twijfel staat testmodus aan: liever een mail te weinig naar buiten. */
async function leesTestmodus(): Promise<{ aan: boolean; adres: string }> {
  const veilig = { aan: true, adres: CC_EMAIL };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, {
      headers: h,
    });
    if (!r.ok) return veilig;
    const w = (await r.json())?.[0]?.waarde;
    if (!w || typeof w !== "object") return veilig;
    return { aan: w.aan !== false, adres: w.adres || CC_EMAIL };
  } catch {
    return veilig;
  }
}

function ontsnap(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mailtekst(voornaam: string, testAdres?: string): string {
  const balk = testAdres
    ? `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:14px;color:#5c4310">
         <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${ontsnap(testAdres)}</strong>. De medewerker heeft niets ontvangen.
       </div>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1b1b1b;max-width:560px">
    ${balk}
    <p>Hoi ${ontsnap(voornaam)},</p>
    <p>Je contract is klaar en staat in de app om te tekenen. Je vindt het onder
    <strong>Mijn dossier</strong>.</p>
    <p>Lees het eerst rustig door. Daarna typ je je naam en zet je er een handtekening bij.
    Zodra jij getekend hebt, teken ik mee en krijg je het getekende contract in je dossier.</p>
    <p style="margin-top:20px"><a href="${APP_URL}/mijn-dossier" style="color:#1b1b1b">Naar Mijn dossier</a></p>
    <p style="margin-top:24px">Groet,<br>Sander</p>
    <p style="color:#6b6b6b;font-size:13px;margin-top:24px">Kom je er niet in, of teken je het liever op papier?
    Laat het me weten, dan print ik het uit.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    if (!(await wieBelt(req))) return json({ ok: false, error: "hier mag je niet bij" }, 403);

    const { ondertekening } = await req.json().catch(() => ({}));
    if (typeof ondertekening !== "string" || !ondertekening) {
      return json({ ok: false, error: "geen ondertekening meegegeven" }, 400);
    }

    const velden = "id,verstuurd_op,ingetrokken_op,medewerker_id,sollicitaties(voornaam,email)";
    const r = await fetch(
      `${SB_URL}/rest/v1/ondertekeningen?id=eq.${ondertekening}&select=${encodeURIComponent(velden)}`,
      { headers: h },
    );
    if (!r.ok) return json({ ok: false, error: `lezen mislukt: ${await r.text()}` }, 500);
    const o = (await r.json())?.[0];
    if (!o) return json({ ok: false, error: "ondertekening niet gevonden" }, 404);
    if (o.ingetrokken_op) return json({ ok: false, error: "deze ondertekening is ingetrokken" }, 409);
    if (o.verstuurd_op) return json({ ok: false, error: "dit is al verstuurd" }, 409);

    const naar = (o.sollicitaties?.email ?? "").trim();
    if (!naar) {
      return json(
        { ok: false, error: "deze medewerker heeft geen mailadres; print het contract uit" },
        400,
      );
    }

    const tm = await leesTestmodus();
    const ontvanger = tm.aan ? tm.adres : naar;

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ontvanger],
        ...(tm.aan ? {} : { bcc: [CC_EMAIL] }),
        subject: `${tm.aan ? "[TEST] " : ""}Je contract staat klaar om te tekenen`,
        html: mailtekst(o.sollicitaties?.voornaam ?? "", tm.aan ? naar : undefined),
      }),
    });

    if (!mail.ok) {
      const fout = await mail.text();
      console.error("[stuur-ondertekening] Resend fout:", fout);
      return json({ ok: false, error: `verzenden mislukt: ${fout}` }, 500);
    }

    // Pas vastleggen als de mail eruit is.
    const nu = new Date().toISOString();
    const bij = await fetch(`${SB_URL}/rest/v1/ondertekeningen?id=eq.${ondertekening}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ verstuurd_op: nu, bijgewerkt_op: nu }),
    });
    if (!bij.ok) {
      console.error("[stuur-ondertekening] vastleggen mislukt:", await bij.text());
      return json({ ok: false, error: "de mail is verstuurd, maar het vastleggen mislukte" }, 500);
    }

    let push = { apparaten: 0, gelukt: 0 };
    if (!tm.aan) {
      try {
        push = await pushNaar(naar, {
          title: "Je contract staat klaar",
          body: "Lees het in de app en zet je handtekening.",
          url: `${APP_URL}/mijn-dossier`,
          tag: `ondertekening-${ondertekening}`,
        });
      } catch (e) {
        console.warn("[stuur-ondertekening] push mislukt:", e);
      }
    }

    return json({
      ok: true,
      testmodus: tm.aan,
      verstuurd_naar: ontvanger,
      apparaten: push.apparaten,
      push_gelukt: push.gelukt,
    });
  } catch (e) {
    const bericht = e instanceof Error ? e.message : "onbekende fout";
    console.error("[stuur-ondertekening]", bericht);
    return json({ ok: false, error: bericht }, 500);
  }
});
