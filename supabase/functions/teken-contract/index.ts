// teken-contract
// GET  ?token=<uuid>                → contract HTML ophalen voor tekenpagina
// POST { token, handtekening, naam } → werknemer handtekening opslaan
// POST { token, werkgever_handtekening, werkgever_naam, pdf_url } → werkgever countertekenen
// GET  ?token=<uuid>&status=1        → status + handtekeningen ophalen (voor app)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL    = "onboarding@boskmafoodservice.nl";
const MANAGER_EMAIL = "sander@boskmafoodservice.nl";

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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const statusOnly = url.searchParams.get("status") === "1";
    if (!token) return jsonErr("token vereist", 400);

    const res = await fetch(
      `${SB_URL}/rest/v1/contract_verzoeken?token=eq.${token}&select=token,medewerker_naam,contract_html,werknemer_handtekening,werknemer_naam_bevestiging,werknemer_getekend_op,werkgever_getekend_op,pdf_url,geannuleerd_op`,
      { headers: h }
    );
    const rows = await res.json();
    if (!rows?.length) return jsonErr("Ongeldige of verlopen link", 404);
    const row = rows[0];

    if (row.geannuleerd_op) return jsonErr("Dit contract is ingetrokken door de werkgever", 410);

    if (statusOnly) {
      return new Response(JSON.stringify({
        ok: true,
        medewerker_naam: row.medewerker_naam,
        werknemer_getekend_op: row.werknemer_getekend_op,
        werknemer_handtekening: row.werknemer_handtekening,
        werknemer_naam_bevestiging: row.werknemer_naam_bevestiging,
        werkgever_getekend_op: row.werkgever_getekend_op,
        pdf_url: row.pdf_url,
        contract_html: row.contract_html,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (row.werknemer_getekend_op) {
      return new Response(JSON.stringify({
        ok: true,
        al_getekend: true,
        medewerker_naam: row.medewerker_naam,
        werkgever_getekend_op: row.werkgever_getekend_op,
        pdf_url: row.pdf_url,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      al_getekend: false,
      medewerker_naam: row.medewerker_naam,
      contract_html: row.contract_html,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { token } = body;
      if (!token) return jsonErr("token vereist", 400);

      // Haal rij op
      const tkRes = await fetch(
        `${SB_URL}/rest/v1/contract_verzoeken?token=eq.${token}&select=id,medewerker_id,medewerker_naam,medewerker_email,werknemer_getekend_op,werkgever_getekend_op,geannuleerd_op`,
        { headers: h }
      );
      const rows = await tkRes.json();
      if (!rows?.length) return jsonErr("Ongeldige link", 404);
      const row = rows[0];
      if (row.geannuleerd_op) return jsonErr("Dit contract is ingetrokken", 410);

      // Countertekenen door werkgever
      if (body.werkgever_handtekening) {
        if (!row.werknemer_getekend_op) return jsonErr("Werknemer heeft nog niet getekend", 409);
        if (row.werkgever_getekend_op) return jsonErr("Werkgever heeft al getekend", 409);

        const pdfUrl = body.pdf_url || null;

        await fetch(`${SB_URL}/rest/v1/contract_verzoeken?token=eq.${token}`, {
          method: "PATCH",
          headers: h,
          body: JSON.stringify({
            werkgever_handtekening: body.werkgever_handtekening,
            werkgever_getekend_op: new Date().toISOString(),
            pdf_url: pdfUrl,
          }),
        });

        // Stuur getekend exemplaar naar medewerker
        if (row.medewerker_email && pdfUrl) {
          const voornaam = row.medewerker_naam?.split(" ")[0] || row.medewerker_naam;
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [row.medewerker_email],
              subject: `${voornaam}, je getekende arbeidsovereenkomst`,
              html: buildGetekendMailHtml(voornaam, pdfUrl),
            }),
          }).catch(() => {});
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Werknemer tekent
      const { handtekening, naam } = body;
      if (!handtekening) return jsonErr("handtekening vereist", 400);
      if (row.werknemer_getekend_op) return jsonErr("Contract is al eerder ondertekend", 409);

      await fetch(`${SB_URL}/rest/v1/contract_verzoeken?token=eq.${token}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({
          werknemer_handtekening: handtekening,
          werknemer_naam_bevestiging: naam || null,
          werknemer_getekend_op: new Date().toISOString(),
        }),
      });

      // Notificeer manager
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [MANAGER_EMAIL],
          subject: `${row.medewerker_naam} heeft het contract ondertekend`,
          html: `<p><strong>${row.medewerker_naam}</strong> heeft zojuist het arbeidscontract digitaal ondertekend.</p><p>Log in op de app om te countertekenen en het definitieve PDF te genereren.</p>`,
        }),
      }).catch(() => {});

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });

    } catch (err: any) {
      console.error("[teken-contract]", err.message);
      return jsonErr(err.message, 500);
    }
  }

  return jsonErr("Method not allowed", 405);
});

function buildGetekendMailHtml(voornaam: string, pdfUrl: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#f5ead4;border:1px solid #cdbfa0;border-radius:3px;overflow:hidden">
<tr><td style="background:#1d6e72;padding:0"><table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 32px 24px">
<p style="margin:0 0 6px;color:rgba(245,234,212,.6);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Georgia,serif">Snackerie 't Zonnetje</p>
<h1 style="margin:0;color:#f5ead4;font-size:22px;font-weight:700;font-family:Georgia,serif;letter-spacing:.5px">Contract volledig getekend</h1>
</td></tr>
<tr><td style="height:3px;background:#c8953a;line-height:3px;font-size:3px">&nbsp;</td></tr>
</table></td></tr>
<tr><td style="padding:28px 32px">
<p style="margin:0 0 6px;color:#a89272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Georgia,serif">Beste ${voornaam},</p>
<p style="margin:8px 0 20px;color:#2c1f0e;font-size:15px;line-height:1.7;font-family:Georgia,serif">Goed nieuws — je arbeidsovereenkomst is door beide partijen ondertekend. Hieronder vind je een link om het definitieve getekende exemplaar te downloaden. Bewaar dit voor je eigen administratie.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<a href="${pdfUrl}" style="display:inline-block;background:#1d6e72;color:#f5ead4;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 36px;border-radius:3px;text-decoration:none;font-family:Georgia,serif">Getekend contract downloaden</a>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #cdbfa0;padding-top:16px"><tr><td>
<p style="margin:0 0 4px;color:#a89272;font-size:11px;font-family:Georgia,serif">Werkt de knop niet? Gebruik dan deze link:</p>
<p style="margin:0;word-break:break-all;font-size:11px;color:#a89272;font-family:monospace">${pdfUrl}</p>
</td></tr></table>
</td></tr>
<tr><td style="background:#ede0c4;border-top:1px solid #cdbfa0;padding:14px 32px">
<p style="margin:0;color:#a89272;font-size:11px;font-family:Georgia,serif">Snackerie 't Zonnetje &nbsp;·&nbsp; Vragen? <a href="mailto:${MANAGER_EMAIL}" style="color:#6b5a3e;text-decoration:none">${MANAGER_EMAIL}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function jsonErr(msg: string, status: number) {
  return new Response(
    JSON.stringify({ ok: false, error: msg }),
    { status, headers: { ...cors, "Content-Type": "application/json" } }
  );
}
