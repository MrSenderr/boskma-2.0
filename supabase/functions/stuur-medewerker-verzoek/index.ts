// stuur-medewerker-verzoek
// Aangemaakt door de app wanneer een manager een gegevensverzoek stuurt naar een medewerker.
// Maakt een token aan in medewerker_gegevens en stuurt een e-mail als er een e-mailadres is.
//
// POST body: { medewerker_id: number, medewerker_naam: string, medewerker_email?: string }
// Response:  { ok: true, token: string, url: string, email_verzonden: boolean }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SB_URL       = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE   = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FROM_EMAIL   = "onboarding@boskmafoodservice.nl";
const MANAGER_EMAIL = "sander@boskmafoodservice.nl";
const FORM_URL     = Deno.env.get("MEDEWERKER_FORM_URL") ?? "https://app.boskmafoodservice.nl/medewerker-gegevens.html";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { medewerker_id, medewerker_naam, medewerker_email, bestaande_gegevens, _email_only_url } = body;

    // ── E-mail only modus: geen token aanmaken, alleen mail sturen ────────────
    if (_email_only_url && medewerker_naam && medewerker_email) {
      const voornaam = medewerker_naam.split(" ")[0];
      const url = _email_only_url;
      const bestaande_gegevens_body = body.bestaande_gegevens || null;
      const mailHtml = buildMailHtml(voornaam, url, !!bestaande_gegevens_body);
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [medewerker_email], subject: bestaande_gegevens_body ? `${voornaam}, controleer je gegevens voor de loonadministratie` : `${voornaam}, vul je gegevens in voor de loonadministratie`, html: mailHtml }),
      });
      return new Response(
        JSON.stringify({ ok: mailRes.ok, email_verzonden: mailRes.ok }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!medewerker_id || !medewerker_naam) throw new Error("medewerker_id en medewerker_naam zijn vereist");

    // Verwijder alle openstaande (nog niet ingevulde) tokens voor deze medewerker
    await fetch(`${SB_URL}/rest/v1/medewerker_gegevens?medewerker_id=eq.${medewerker_id}&ingediend_op=is.null`, {
      method: "DELETE",
      headers: h,
    });

    // Maak token-rij aan
    const tokenRes = await fetch(`${SB_URL}/rest/v1/medewerker_gegevens`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({ medewerker_id, medewerker_naam, medewerker_email: medewerker_email || null, bestaande_gegevens: bestaande_gegevens || null }),
    });
    const rows = await tokenRes.json();
    if (!rows?.length) throw new Error("Token aanmaken mislukt");
    const token = rows[0].token;
    const url = `${FORM_URL}?token=${token}`;

    // Stuur e-mail als er een adres is
    let email_verzonden = false;
    if (medewerker_email) {
      const voornaam = medewerker_naam.split(" ")[0];
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [medewerker_email],
          subject: heeftBestaandeGegevens ? `${voornaam}, controleer je gegevens voor de loonadministratie` : `${voornaam}, vul je gegevens in voor de loonadministratie`,
          html: buildMailHtml(voornaam, url, !!bestaande_gegevens),
        }),
      });
      email_verzonden = mailRes.ok;
    }

    return new Response(
      JSON.stringify({ ok: true, token, url, email_verzonden }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[stuur-medewerker-verzoek]", err.message);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

function buildMailHtml(voornaam: string, url: string, heeftBestaandeGegevens: boolean): string {
  const koptekst = heeftBestaandeGegevens ? "Gegevens controleren" : "Gegevens aanvullen";
  const knoptekst = heeftBestaandeGegevens ? "Gegevens controleren" : "Gegevens invullen";

  const introtekst = heeftBestaandeGegevens
    ? `We vragen je je gegevens even te controleren en bij te werken waar nodig. Alles wat we al van je weten staat alvast ingevuld — het kost je hooguit een paar minuten.`
    : `Voor de loonadministratie hebben we een paar gegevens van je nodig. Via de knop hieronder open je een kort formulier — het duurt zo'n vijf minuten.`;

  const checklist = heeftBestaandeGegevens
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#fff8ee;border-left:3px solid #c8953a;border-radius:0 3px 3px 0">
            <tr><td style="padding:14px 18px">
              <p style="margin:0 0 8px;color:#2c1f0e;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;font-family:Georgia,serif">Is er iets gewijzigd?</p>
              <p style="margin:0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif;line-height:1.6">Heb je een nieuw adres, rekeningnummer of telefoonnummer? Zorg dan dat je dit bij de hand hebt. Voor een nieuwe ID-kopie heb je ook je identiteitsbewijs nodig.</p>
            </td></tr>
          </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#fff8ee;border-left:3px solid #c8953a;border-radius:0 3px 3px 0">
            <tr><td style="padding:14px 18px">
              <p style="margin:0 0 8px;color:#2c1f0e;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;font-family:Georgia,serif">Zorg dat je dit bij de hand hebt</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; BSN-nummer (op je ID-bewijs of via DigiD)</td></tr>
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; IBAN / rekeningnummer</td></tr>
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; Volledig woonadres</td></tr>
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; Naam en telefoonnummer noodcontact</td></tr>
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; Voor- en achterkant ID of paspoort</td></tr>
                <tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">&#8226;&nbsp; Het loonheffingsformulier wordt automatisch aangemaakt</td></tr>
              </table>
            </td></tr>
          </table>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#f5ead4;border:1px solid #cdbfa0;border-radius:3px;overflow:hidden">
        <tr><td style="background:#1d6e72;padding:0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 32px 24px">
              <p style="margin:0 0 6px;color:rgba(245,234,212,.6);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Georgia,serif">Snackerie 't Zonnetje</p>
              <h1 style="margin:0;color:#f5ead4;font-size:22px;font-weight:700;font-family:Georgia,serif;letter-spacing:.5px">${koptekst}</h1>
            </td></tr>
            <tr><td style="height:3px;background:#c8953a;line-height:3px;font-size:3px">&nbsp;</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 6px;color:#a89272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Georgia,serif">Beste ${voornaam},</p>
          <p style="margin:8px 0 20px;color:#2c1f0e;font-size:15px;line-height:1.7;font-family:Georgia,serif">${introtekst}</p>
          ${checklist}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td align="center">
              <a href="${url}" style="display:inline-block;background:#1d6e72;color:#f5ead4;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 36px;border-radius:3px;text-decoration:none;font-family:Georgia,serif">${knoptekst}</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #cdbfa0;padding-top:16px">
            <tr><td>
              <p style="margin:0 0 4px;color:#a89272;font-size:11px;font-family:Georgia,serif">Werkt de knop niet? Gebruik dan deze link:</p>
              <p style="margin:0;word-break:break-all;font-size:11px;color:#a89272;font-family:monospace">${url}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#ede0c4;border-top:1px solid #cdbfa0;padding:14px 32px">
          <p style="margin:0;color:#a89272;font-size:11px;font-family:Georgia,serif">Snackerie 't Zonnetje &nbsp;·&nbsp; Vragen? <a href="mailto:${MANAGER_EMAIL}" style="color:#6b5a3e;text-decoration:none">${MANAGER_EMAIL}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
