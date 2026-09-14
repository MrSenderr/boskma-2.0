// send-onboarding
// Aangemaakt door boskma-app wanneer een sollicitant op "Aannemen" wordt geklikt.
// Maakt een eenmalig token aan en stuurt een onboarding-e-mail naar de sollicitant.
//
// POST body: { sollicitatie_id: string (UUID) }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FROM_EMAIL    = "onboarding@boskmafoodservice.nl";
const MANAGER_EMAIL = "sander@boskmafoodservice.nl";
const ONBOARDING_URL = Deno.env.get("ONBOARDING_URL") ?? "https://onboarding.snackerie-zonnetje.nl";

/** Testmodus staat in de tabel instellingen. Zolang hij aan staat gaat er geen
 *  enkele mail naar een medewerker of het loonbureau, maar naar het testadres.
 *
 *  Bij twijfel — tabel onbereikbaar, rij weg, rare waarde — gaan we ervan uit
 *  dat hij AAN staat. Liever een mail te weinig naar buiten dan een te veel. */
async function leesTestmodus(h: Record<string, string>) {
  const veilig = { aan: true, adres: MANAGER_EMAIL };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, { headers: h });
    if (!r.ok) return veilig;
    const rijen = await r.json();
    const w = rijen?.[0]?.waarde;
    if (!w || typeof w !== "object") return veilig;
    return { aan: w.aan !== false, adres: w.adres || MANAGER_EMAIL };
  } catch {
    return veilig;
  }
}

function testBalk(echteOntvanger: string) {
  return `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#5c4310">
    <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${echteOntvanger}</strong>.
    Er is niets naar die persoon gestuurd.
  </div>`;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { sollicitatie_id, verstuur_mail = true } = await req.json();
    if (!sollicitatie_id) throw new Error("sollicitatie_id vereist");

    const h = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };

    // 1. Haal sollicitant op
    const solRes = await fetch(
      `${SB_URL}/rest/v1/sollicitaties?id=eq.${sollicitatie_id}&select=voornaam,achternaam,email,telefoonnummer,geboortedatum`,
      { headers: h }
    );
    const sols = await solRes.json();
    if (!sols?.length) throw new Error("Sollicitant niet gevonden");
    const sol = sols[0];

    if (!sol.email) throw new Error("Sollicitant heeft geen e-mailadres");

    // 2. Verwijder alle bestaande tokens voor deze sollicitant zodat de nieuwe link de enige geldige is
    await fetch(`${SB_URL}/rest/v1/onboarding_tokens?sollicitatie_id=eq.${sollicitatie_id}`, {
      method: "DELETE",
      headers: h,
    });

    // 3. Maak nieuw token aan
    const tokenRes = await fetch(`${SB_URL}/rest/v1/onboarding_tokens`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({ sollicitatie_id }),
    });
    const tokens = await tokenRes.json();
    if (!tokens?.length) throw new Error("Token aanmaken mislukt");
    const token = tokens[0].token;

    // 3. Sla verstuurd_op op
    await fetch(`${SB_URL}/rest/v1/sollicitaties?id=eq.${sollicitatie_id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ onboarding_verstuurd_op: new Date().toISOString() }),
    });

    // 4. Stuur e-mail naar sollicitant
    const naam = `${sol.voornaam} ${sol.achternaam}`;
    const link = `${ONBOARDING_URL}?token=${token}`;

    const mailHtml = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-collapse:separate;border-spacing:0">

        <!-- Header -->
        <tr>
          <td style="background:#1d6e72;padding:32px 36px 28px;text-align:center;border-radius:4px 4px 0 0">
            <p style="margin:0 0 4px;color:rgba(245,237,224,.65);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Georgia,serif">Snackerie 't Zonnetje</p>
            <div style="width:40px;height:1px;background:#c8953a;margin:10px auto"></div>
            <h1 style="margin:10px 0 0;color:#f5ead4;font-size:22px;font-weight:600;font-family:Georgia,serif;line-height:1.35">Welkom aan boord,<br>${sol.voornaam}!</h1>
          </td>
        </tr>

        <!-- Gold stripe -->
        <tr><td style="background:#c8953a;height:3px;line-height:3px;font-size:3px">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#f5ead4;padding:28px 36px">
            <p style="margin:0 0 14px;color:#2c1f0e;font-size:15px;line-height:1.7;font-family:Georgia,serif">
              Goed nieuws — je bent aangenomen bij Snackerie 't Zonnetje. We kijken er naar uit om met je samen te werken.
            </p>
            <p style="margin:0 0 22px;color:#2c1f0e;font-size:15px;line-height:1.7;font-family:Georgia,serif">
              Om alles administratief in orde te maken vragen we je een kort onboardingformulier in te vullen. Dit duurt ongeveer <strong>5 minuten</strong>.
            </p>

            <!-- Waarschuwing eenmalige link -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
              <tr>
                <td style="background:#f7edd8;border:1.5px solid #c8953a;border-radius:3px;padding:14px 16px">
                  <p style="margin:0;color:#7a4f0e;font-size:13px;font-weight:bold;font-family:Georgia,serif">
                    Let op: deze link is eenmalig geldig
                  </p>
                  <p style="margin:6px 0 0;color:#6b5a3e;font-size:13px;line-height:1.6;font-family:Georgia,serif">
                    Je kunt de link maar één keer openen. Zorg dat je de onderstaande gegevens bij de hand hebt <em>voordat</em> je de link opent.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Checklist -->
            <p style="margin:0 0 12px;color:#2c1f0e;font-size:13px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;font-family:Georgia,serif">Zorg dat je dit bij de hand hebt</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px">
              <tr>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif;vertical-align:top;width:28px">📋</td>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif"><strong>BSN-nummer</strong> &mdash; staat op je identiteitsbewijs of via DigiD</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif;vertical-align:top;width:28px">💳</td>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif"><strong>IBAN / rekeningnummer</strong> &mdash; staat op je bankpas of in je bankapp</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif;vertical-align:top;width:28px">🏠</td>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif"><strong>Volledig woonadres</strong> &mdash; straat, huisnummer, postcode, woonplaats</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif;vertical-align:top;width:28px">📞</td>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif"><strong>Noodcontactpersoon</strong> &mdash; naam en telefoonnummer</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif;vertical-align:top;width:28px">✅</td>
                <td style="padding:7px 0;color:#2c1f0e;font-size:14px;line-height:1.5;font-family:Georgia,serif"><strong>Loonheffingskorting</strong> &mdash; wil je dit bij ons toepassen? (uitleg staat in het formulier)</td>
              </tr>
            </table>

            <!-- CTA knop -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
              <tr>
                <td align="center">
                  <a href="${link}" style="display:inline-block;background:#1d6e72;color:#f5ead4;font-size:15px;font-weight:600;padding:14px 36px;border-radius:3px;text-decoration:none;letter-spacing:.3px;font-family:Georgia,serif">
                    Onboardingformulier invullen &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;color:#a89272;font-size:12px;font-family:Georgia,serif">Werkt de knop niet? Kopieer dan deze link:</p>
            <p style="margin:0;word-break:break-all;font-size:11px;color:#a89272;font-family:monospace">${link}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1d6e72;padding:14px 36px;border-radius:0 0 4px 4px">
            <p style="margin:0;color:rgba(245,237,224,.6);font-size:12px;font-family:Georgia,serif;text-align:center">
              Snackerie 't Zonnetje &middot; Dorpsstraat 52, Wervershoof &middot; Vragen? <a href="mailto:${MANAGER_EMAIL}" style="color:rgba(245,237,224,.85);text-decoration:none">${MANAGER_EMAIL}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const tm = await leesTestmodus(h);
    let verstuurdNaar: string | null = null;

    if (verstuur_mail) {
      verstuurdNaar = tm.aan ? tm.adres : sol.email;

      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [verstuurdNaar],
          subject: `${tm.aan ? "[TEST] " : ""}Welkom bij Snackerie Zonnetje, ${sol.voornaam}! — Vul je onboardingformulier in`,
          html: tm.aan ? testBalk(sol.email) + mailHtml : mailHtml,
        }),
      });

      if (!mailRes.ok) {
        const err = await mailRes.text();
        throw new Error(`Resend fout: ${err}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, token, link, testmodus: tm.aan, verstuurd_naar: verstuurdNaar }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[send-onboarding]", err.message);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
