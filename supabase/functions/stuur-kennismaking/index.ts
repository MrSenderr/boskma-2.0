// stuur-kennismaking
// Stuurt een persoonlijke kennismakingsmail naar een sollicitant.
//
// POST body: { voornaam: string, email: string, bericht: string }
// Response:  { ok: true } | { ok: false, error: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL    = "onboarding@boskmafoodservice.nl";
const MANAGER_EMAIL = "sander@boskmafoodservice.nl";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { voornaam, email, bericht } = await req.json();
    if (!voornaam || !email || !bericht) throw new Error("voornaam, email en bericht zijn vereist");

    const berichtHtml = bericht
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const mailHtml = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#f5ead4;border:1px solid #cdbfa0;border-radius:3px;overflow:hidden">
        <tr>
          <td style="background:#1d6e72;padding:0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:28px 32px 24px">
                <p style="margin:0 0 6px;color:rgba(245,234,212,.6);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Georgia,serif">Snackerie 't Zonnetje</p>
                <h1 style="margin:0;color:#f5ead4;font-size:22px;font-weight:700;font-family:Georgia,serif;letter-spacing:.5px">Uitnodiging kennismaking</h1>
              </td></tr>
              <tr><td style="height:3px;background:#c8953a;line-height:3px;font-size:3px">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0;color:#2c1f0e;font-size:15px;line-height:1.8;font-family:Georgia,serif">${berichtHtml}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ede0c4;border-top:1px solid #cdbfa0;padding:14px 32px">
            <p style="margin:0;color:#a89272;font-size:11px;font-family:Georgia,serif">Snackerie 't Zonnetje &nbsp;·&nbsp; <a href="mailto:${MANAGER_EMAIL}" style="color:#6b5a3e;text-decoration:none">${MANAGER_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Uitnodiging kennismaking — Snackerie 't Zonnetje`,
        html: mailHtml,
      }),
    });

    if (!mailRes.ok) throw new Error(`Resend: ${await mailRes.text()}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[stuur-kennismaking]", err.message);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
