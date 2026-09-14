// stuur-inloglink
//
// POST { email }
//
// Maakt een eenmalige inloglink voor een medewerker en mailt hem. Bewust niet
// via de standaardmail van Supabase: die gaat buiten de testmodus om, en dan
// zou een medewerker tijdens het testen alsnog post krijgen.
//
// De toegangsregel staat in de database (huidige_medewerker): pas inloggen
// zodra het dossier naar het loonbureau is, en niet meer na uit dienst. Deze
// functie controleert hetzelfde, zodat er geen link vertrekt naar iemand die er
// toch niet in zou komen.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL      = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE  = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY  = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL  = "onboarding@boskmafoodservice.nl";
const MANAGER     = "sander@boskmafoodservice.nl";
const APP_URL     = Deno.env.get("APP_URL") ?? "https://nieuw.boskmafoodservice.nl";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* Supabase gebruikt sinds kort een nieuw sleutelformaat (sb_secret_…) naast de
   oude JWT-sleutels. Een nieuwe sleutel hoort alleen in de apikey-header; zet je
   hem ook als Bearer, dan probeert PostgREST hem als JWT te lezen en krijg je
   een onbegrijpelijke melding als "JWT issued at future".

   Vandaar: alleen als de sleutel eruitziet als een JWT gaat hij als Bearer mee. */
const isJwt = SB_SERVICE.split(".").length === 3;
const h: Record<string, string> = {
  apikey: SB_SERVICE,
  "Content-Type": "application/json",
  ...(isJwt ? { Authorization: `Bearer ${SB_SERVICE}` } : {}),
};

/** Bij twijfel gaan we ervan uit dat testmodus aan staat. Liever een mail te
 *  weinig naar buiten dan een te veel. */
async function leesTestmodus() {
  const veilig = { aan: true, adres: MANAGER };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, { headers: h });
    if (!r.ok) return veilig;
    const w = (await r.json())?.[0]?.waarde;
    if (!w || typeof w !== "object") return veilig;
    return { aan: w.aan !== false, adres: w.adres || MANAGER };
  } catch {
    return veilig;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email } = await req.json();
    const adres = String(email ?? "").trim().toLowerCase();
    if (!adres.includes("@")) return json({ ok: false, error: "Vul een geldig e-mailadres in." }, 400);

    // 1. Mag deze persoon inloggen?
    const q = new URLSearchParams({
      select: "id,voornaam,fase,loonbureau_verstuurd_op,uit_dienst_op,is_apparaat",
      email: `eq.${adres}`,
      fase: "eq.medewerker",
    });
    const r = await fetch(`${SB_URL}/rest/v1/sollicitaties?${q}`, { headers: h });
    if (!r.ok) throw new Error(`ophalen mislukt: ${r.status} ${await r.text()}`);
    const rijen = await r.json();
    const mw = rijen?.[0];

    // Bewust altijd dezelfde melding: anders kun je met dit formulier uitvinden
    // wie er bij Boskma werkt.
    const nietGevonden = { ok: true, verstuurd: false } as const;
    // Dezelfde regel als huidige_medewerker() in de database: een tablet mag
    // inloggen zonder loonbureau-gegevens, want het krijgt geen loon.
    const magInloggen = mw && !mw.uit_dienst_op && (mw.loonbureau_verstuurd_op || mw.is_apparaat);
    if (!magInloggen) return json(nietGevonden);

    // 2. Account aanmaken als het er nog niet is. Meteen bevestigd, zodat
    //    Supabase er zelf geen mail over stuurt.
    const maak = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ email: adres, email_confirm: true }),
    });
    if (!maak.ok && maak.status !== 422) {
      console.error("[inloglink] account aanmaken mislukt", maak.status, await maak.text());
    }

    // 3. Link laten maken, niet laten versturen door Supabase
    const link = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ type: "magiclink", email: adres, redirect_to: APP_URL }),
    });
    if (!link.ok) throw new Error(`link maken mislukt: ${await link.text()}`);
    const gegevens = await link.json();
    const url = gegevens?.properties?.action_link ?? gegevens?.action_link;
    // De code is het vangnet: mailscanners openen links in binnenkomende post
    // automatisch, en dan is een eenmalige link op voordat de ontvanger klikt.
    const code = gegevens?.properties?.email_otp ?? gegevens?.email_otp ?? null;
    if (!url && !code) throw new Error("geen link teruggekregen");

    // 4. Zelf mailen, zodat testmodus erover gaat
    const tm = await leesTestmodus();
    const ontvanger = tm.aan ? tm.adres : adres;

    const balk = tm.aan
      ? `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#5c4310">
           <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${adres}</strong>.
           Die persoon heeft niets ontvangen. Klik je de knop toch aan, dan log je in als hem.
         </div>`
      : "";

    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f0ebd5;font-family:Helvetica,Arial,sans-serif;color:#0e2226">
      ${balk}
      <div style="max-width:520px;margin:0 auto;background:#fbf9f2;border-radius:6px;padding:28px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#5c7073">Snackerie 't Zonnetje</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#003a41">Hoi ${mw.voornaam ?? ""}, hier is je code</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6">
          Open de app en vul de code hieronder in. Je hoeft geen wachtwoord te
          onthouden — daarna blijf je ingelogd op dit toestel.
        </p>
        ${code ? `<div style="margin:0 0 20px;padding:18px;background:#f0ebd5;border-radius:6px;text-align:center">
          <p style="margin:0 0 6px;font-size:13px;color:#5c7073">Vul deze code in de app in:</p>
          <p style="margin:0;font-size:30px;font-weight:700;letter-spacing:.28em;color:#003a41;font-family:monospace">${code}</p>
        </div>` : ""}
        <p style="margin:0 0 20px">
          <a href="${APP_URL}" style="display:inline-block;background:#003a41;color:#f0ebd5;text-decoration:none;padding:14px 28px;border-radius:4px;font-weight:700">Open de app</a>
        </p>
        ${url ? `<p style="margin:0 0 20px;font-size:13px;color:#5c7073">
          Liever zonder code? <a href="${url}" style="color:#003a41">klik dan hier</a>.
          Werkt die link niet, dan is hij onderweg al geopend door een controle van je
          mailprogramma — gebruik in dat geval gewoon de code.
        </p>` : ""}
        <p style="margin:0;font-size:13px;color:#5c7073">
          De code is een uur geldig. Niet zelf aangevraagd? Dan kun je deze mail weggooien.
        </p>
      </div>
    </body></html>`;

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ontvanger],
        subject: `${tm.aan ? "[TEST] " : ""}Je inlogcode voor Snackerie 't Zonnetje`,
        html,
      }),
    });
    if (!mail.ok) throw new Error(`versturen mislukt: ${await mail.text()}`);

    return json({ ok: true, verstuurd: true, testmodus: tm.aan, verstuurd_naar: ontvanger });
  } catch (err) {
    // De echte melding gaat mee als 'reden'. Die is technisch en Engels, maar
    // zonder deze regel sta je te gissen bij een storing — en dat kostte
    // vanmiddag een uur.
    const reden = err instanceof Error ? err.message : String(err);
    // Tijdelijk: wat zit er in de sleutel die deze functie gebruikt? Bij
    // "JWT issued at future" is dat het enige wat de oorzaak kan aanwijzen.
    console.error("[inloglink]", reden);
    return json({ ok: false, error: "Er ging iets mis. Probeer het zo nog eens.", reden }, 500);
  }
});
