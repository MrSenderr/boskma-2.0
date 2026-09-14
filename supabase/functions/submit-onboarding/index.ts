// submit-onboarding
// Aangeroepen door het onboarding-formulier bij het versturen.
// Valideert het token, slaat de gegevens op, markeert token als gebruikt
// en stuurt een notificatie-e-mail naar de manager.
//
// POST body: { token, straat, huisnummer, postcode, woonplaats, bsn, iban,
//              noodcontact_naam, noodcontact_tel, loonheffingskorting, tshirt_maat,
//              geslacht, id_kopie_url }
//
// GET ?token=<uuid> → geeft voornaam/achternaam/email/telefoon terug (voor pre-fill)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

  // ── GET: token valideren + sollicitantdata ophalen voor pre-fill ──────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return jsonErr("token vereist", 400);

    const tkRes = await fetch(
      `${SB_URL}/rest/v1/onboarding_tokens?token=eq.${token}&select=token,sollicitatie_id,gebruikt_op`,
      { headers: h }
    );
    const tokens = await tkRes.json();
    if (!tokens?.length) return jsonErr("Ongeldige link", 404);

    const tk = tokens[0];
    if (tk.gebruikt_op) return jsonErr("Deze link is al eerder gebruikt", 410);

    // Haal sollicitantgegevens op
    const solRes = await fetch(
      `${SB_URL}/rest/v1/sollicitaties?id=eq.${tk.sollicitatie_id}&select=voornaam,achternaam,email,telefoonnummer,geboortedatum`,
      { headers: h }
    );
    const sols = await solRes.json();
    if (!sols?.length) return jsonErr("Sollicitant niet gevonden", 404);

    return new Response(
      JSON.stringify({ ok: true, ...sols[0] }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // ── POST: formulier verwerken ─────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { token, voornaam, achternaam, email, telefoonnummer, geboortedatum,
              straat, huisnummer, postcode, woonplaats, geboorteplaats,
              bsn, iban, noodcontact_naam, noodcontact_tel,
              loonheffingskorting, tshirt_maat, geslacht, id_kopie_url, id_kopie_achterzijde,
              loonheffing_pdf } = body;

      if (!token) return jsonErr("token vereist", 400);

      // 1. Valideer token (niet al gebruikt)
      const tkRes = await fetch(
        `${SB_URL}/rest/v1/onboarding_tokens?token=eq.${token}&select=token,sollicitatie_id,gebruikt_op`,
        { headers: h }
      );
      const tokens = await tkRes.json();
      if (!tokens?.length) return jsonErr("Ongeldige link", 404);

      const tk = tokens[0];
      if (tk.gebruikt_op) return jsonErr("Dit formulier is al eerder ingevuld", 410);

      const sollicitatie_id = tk.sollicitatie_id;

      // 2. Haal naam op voor notificatie-e-mail
      const solRes = await fetch(
        `${SB_URL}/rest/v1/sollicitaties?id=eq.${sollicitatie_id}&select=voornaam,achternaam,email`,
        { headers: h }
      );
      const sols = await solRes.json();
      const sol = sols?.[0];
      const naam = sol ? `${sol.voornaam} ${sol.achternaam}` : "Onbekend";

      // 3. Sla onboarding data op in sollicitaties
      const onboarding_data = {
        straat, huisnummer, postcode, woonplaats, geboorteplaats,
        bsn, iban,
        noodcontact_naam, noodcontact_tel,
        loonheffingskorting: !!loonheffingskorting,
        tshirt_maat,
        ...(geslacht ? { geslacht } : {}),
        ...(id_kopie_url ? { id_kopie_url } : {}),
        ...(id_kopie_achterzijde ? { id_kopie_achterzijde } : {}),
        ...(loonheffing_pdf ? { loonheffing_pdf } : {}),
      };

      const solUpdate: Record<string, any> = {
        onboarding_ingevuld_op: new Date().toISOString(),
        onboarding_data,
        status: "onboarding_ingevuld",
      };
      if (voornaam)       solUpdate.voornaam = voornaam;
      if (achternaam)     solUpdate.achternaam = achternaam;
      if (email)          solUpdate.email = email;
      if (telefoonnummer) solUpdate.telefoonnummer = telefoonnummer;
      if (geboortedatum)  solUpdate.geboortedatum = geboortedatum;

      await fetch(`${SB_URL}/rest/v1/sollicitaties?id=eq.${sollicitatie_id}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(solUpdate),
      });

      // 4. Markeer token als gebruikt
      await fetch(`${SB_URL}/rest/v1/onboarding_tokens?token=eq.${token}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ gebruikt_op: new Date().toISOString() }),
      });

      // 5. Stuur notificatie-e-mail naar manager
      const mailHtml = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:520px;width:100%">
        <tr>
          <td style="background:#10b981;padding:24px 32px">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Snackerie Zonnetje</p>
            <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700">Onboarding ingevuld ✓</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">
              <strong>${naam}</strong> heeft het onboardingformulier ingevuld. De gegevens staan klaar in de boskma-app.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
              <tr style="background:#f9fafb"><td style="padding:8px 14px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.4px" colspan="2">Ontvangen gegevens</td></tr>
              <tr style="border-top:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px;color:#6b7280;width:45%">Naam</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${naam}</td></tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Adres</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${straat} ${huisnummer}, ${postcode} ${woonplaats}</td></tr>
              <tr style="border-top:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Geboorteplaats</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${geboorteplaats||'–'}</td></tr>
              <tr style="border-top:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">IBAN</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${iban}</td></tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Loonheffingskorting</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${loonheffingskorting ? 'Ja' : 'Nee'}</td></tr>
              <tr style="border-top:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">T-shirt maat</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${tshirt_maat}</td></tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Geslacht</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${geslacht==='M'?'Man':geslacht==='V'?'Vrouw':geslacht==='X'?'Zeg ik liever niet':'–'}</td></tr>
              <tr style="border-top:1px solid #e5e7eb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Kopie ID voorzijde</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${id_kopie_url?'✓ Geüpload':'Nog niet aangeleverd'}</td></tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Kopie ID achterzijde</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${id_kopie_achterzijde?'✓ Geüpload':'Nog niet aangeleverd'}</td></tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb"><td style="padding:9px 14px;font-size:13px;color:#6b7280">Noodcontact</td><td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:500">${noodcontact_naam} — ${noodcontact_tel}</td></tr>
            </table>
            <p style="margin:0;color:#6b7280;font-size:13px">BSN is zichtbaar in de boskma-app (niet in deze e-mail weergegeven).</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
            <p style="margin:0;color:#9ca3af;font-size:12px">Snackerie Zonnetje · Onboarding systeem</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [MANAGER_EMAIL],
          subject: `✅ ${naam} heeft het onboardingformulier ingevuld`,
          html: mailHtml,
        }),
      });

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );

    } catch (err: any) {
      console.error("[submit-onboarding]", err.message);
      return jsonErr(err.message, 500);
    }
  }

  return jsonErr("Method not allowed", 405);
});

function jsonErr(msg: string, status: number) {
  return new Response(
    JSON.stringify({ ok: false, error: msg }),
    { status, headers: { ...cors, "Content-Type": "application/json" } }
  );
}
