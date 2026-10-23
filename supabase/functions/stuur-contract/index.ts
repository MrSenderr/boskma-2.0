import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FROM_EMAIL    = "onboarding@boskmafoodservice.nl";
const MANAGER_EMAIL = "sander@boskmafoodservice.nl";
const SIGN_URL      = Deno.env.get("CONTRACT_SIGN_URL") ?? "https://app.boskmafoodservice.nl/contract-tekenen.html";

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
    const { medewerker_id, medewerker_naam, medewerker_email, contract_html, contract_type, contract_start } = body;
    if (!medewerker_id || !medewerker_naam || !contract_html) {
      throw new Error("medewerker_id, medewerker_naam en contract_html zijn vereist");
    }

    // Annuleer openstaande (niet-getekende) verzoeken voor deze medewerker
    await fetch(`${SB_URL}/rest/v1/contract_verzoeken?medewerker_id=eq.${medewerker_id}&werknemer_getekend_op=is.null&geannuleerd_op=is.null`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ geannuleerd_op: new Date().toISOString() }),
    });

    // Maak nieuw verzoek aan
    const res = await fetch(`${SB_URL}/rest/v1/contract_verzoeken`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({
        medewerker_id,
        medewerker_naam,
        medewerker_email: medewerker_email || null,
        contract_html,
        contract_type: contract_type || null,
        contract_start: contract_start || null,
      }),
    });
    const rows = await res.json();
    if (!rows?.length) throw new Error("Aanmaken mislukt");

    const token = rows[0].token;
    const url = `${SIGN_URL}?token=${token}`;

    // Stuur e-mail
    let email_verzonden = false;
    if (medewerker_email) {
      const voornaam = medewerker_naam.split(" ")[0];
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [medewerker_email],
          subject: `${voornaam}, je arbeidsovereenkomst staat klaar om te tekenen`,
          html: buildMailHtml(voornaam, url),
        }),
      });
      email_verzonden = mailRes.ok;
    }

    return new Response(JSON.stringify({ ok: true, token, url, email_verzonden }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[stuur-contract]", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

function buildMailHtml(voornaam: string, url: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#f5ead4;border:1px solid #cdbfa0;border-radius:3px;overflow:hidden">
<tr><td style="background:#1d6e72;padding:0"><table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 32px 24px">
<p style="margin:0 0 6px;color:rgba(245,234,212,.6);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Georgia,serif">Snackerie 't Zonnetje</p>
<h1 style="margin:0;color:#f5ead4;font-size:22px;font-weight:700;font-family:Georgia,serif;letter-spacing:.5px">Contract tekenen</h1>
</td></tr>
<tr><td style="height:3px;background:#c8953a;line-height:3px;font-size:3px">&nbsp;</td></tr>
</table></td></tr>
<tr><td style="padding:28px 32px">
<p style="margin:0 0 6px;color:#a89272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Georgia,serif">Beste ${voornaam},</p>
<p style="margin:8px 0 20px;color:#2c1f0e;font-size:15px;line-height:1.7;font-family:Georgia,serif">Je arbeidsovereenkomst bij Snackerie 't Zonnetje staat klaar. Lees het contract goed door en zet je handtekening via de knop hieronder.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#fff8ee;border-left:3px solid #c8953a;border-radius:0 3px 3px 0">
<tr><td style="padding:14px 18px">
<p style="margin:0 0 6px;color:#2c1f0e;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;font-family:Georgia,serif">Hoe werkt het?</p>
<table cellpadding="0" cellspacing="0">
<tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">1&nbsp;&nbsp; Open de link en lees het contract door</td></tr>
<tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">2&nbsp;&nbsp; Zet je handtekening in het vak onderaan</td></tr>
<tr><td style="padding:3px 0;color:#6b5a3e;font-size:13px;font-family:Georgia,serif">3&nbsp;&nbsp; Na ondertekening door de werkgever ontvang je het definitieve exemplaar</td></tr>
</table>
</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<a href="${url}" style="display:inline-block;background:#1d6e72;color:#f5ead4;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 36px;border-radius:3px;text-decoration:none;font-family:Georgia,serif">Contract bekijken &amp; tekenen</a>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #cdbfa0;padding-top:16px"><tr><td>
<p style="margin:0 0 4px;color:#a89272;font-size:11px;font-family:Georgia,serif">Werkt de knop niet? Gebruik dan deze link:</p>
<p style="margin:0;word-break:break-all;font-size:11px;color:#a89272;font-family:monospace">${url}</p>
</td></tr></table>
</td></tr>
<tr><td style="background:#ede0c4;border-top:1px solid #cdbfa0;padding:14px 32px">
<p style="margin:0;color:#a89272;font-size:11px;font-family:Georgia,serif">Snackerie 't Zonnetje &nbsp;·&nbsp; Vragen? <a href="mailto:${MANAGER_EMAIL}" style="color:#6b5a3e;text-decoration:none">${MANAGER_EMAIL}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
