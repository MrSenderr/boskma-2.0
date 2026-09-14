// medewerker-gegevens
// Gebruikt door het medewerker-gegevens formulier.
//
// GET  ?token=<uuid>   → token valideren, medewerker_naam teruggeven
// POST { token, ...gegevens } → gegevens opslaan, ingediend_op zetten

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

  // ── GET: token valideren ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return jsonErr("token vereist", 400);

    const res = await fetch(
      `${SB_URL}/rest/v1/medewerker_gegevens?token=eq.${token}&select=token,medewerker_naam,ingediend_op,bestaande_gegevens`,
      { headers: h }
    );
    const rows = await res.json();
    if (!rows?.length) return jsonErr("Ongeldige link", 404);
    if (rows[0].ingediend_op) return jsonErr("Dit formulier is al eerder ingevuld", 410);

    return new Response(
      JSON.stringify({ ok: true, medewerker_naam: rows[0].medewerker_naam, bestaande_gegevens: rows[0].bestaande_gegevens || null }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // ── POST: gegevens opslaan ────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { token, telefoon, email, geboortedatum,
              straat, huisnummer, postcode, woonplaats,
              geboorteplaats, bovenkleding_maat,
              noodcontact_naam, noodcontact_tel,
              loonheffingskorting, lhk_datum, iban, bsn,
              geslacht, id_kopie_url, id_kopie_achterzijde_url,
              loonheffing_pdf } = body;

      if (!token) return jsonErr("token vereist", 400);

      // Valideer IBAN
      if (iban && iban.replace(/\s/g, '').length < 10) return jsonErr("IBAN te kort", 400);

      // Valideer BSN (elfproef)
      if (bsn) {
        const s = bsn.replace(/\s/g, '');
        const isValid = /^\d{8,9}$/.test(s) && (() => {
          const p = s.padStart(9, '0');
          const w = [9, 8, 7, 6, 5, 4, 3, 2, -1];
          const som = p.split('').reduce((a: number, d: string, i: number) => a + parseInt(d) * w[i], 0);
          return som % 11 === 0 && som !== 0;
        })();
        if (!isValid) return jsonErr("Ongeldig BSN — elfproef mislukt", 400);
      }

      // Valideer token
      const tkRes = await fetch(
        `${SB_URL}/rest/v1/medewerker_gegevens?token=eq.${token}&select=token,ingediend_op`,
        { headers: h }
      );
      const rows = await tkRes.json();
      if (!rows?.length) return jsonErr("Ongeldige link", 404);
      if (rows[0].ingediend_op) return jsonErr("Dit formulier is al eerder ingevuld", 410);

      // Sla gegevens op
      const gegevens = {
        telefoon, email, geboortedatum,
        straat, huisnummer, postcode, woonplaats,
        geboorteplaats, bovenkleding_maat,
        noodcontact_naam, noodcontact_tel,
        loonheffingskorting: !!loonheffingskorting,
        ...(lhk_datum ? { lhk_datum } : {}),
        iban, bsn,
        ...(geslacht ? { geslacht } : {}),
        ...(id_kopie_url ? { id_kopie_url } : {}),
        ...(id_kopie_achterzijde_url ? { id_kopie_achterzijde: id_kopie_achterzijde_url } : {}),
        ...(loonheffing_pdf ? { loonheffing_pdf } : {}),
      };

      await fetch(`${SB_URL}/rest/v1/medewerker_gegevens?token=eq.${token}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ gegevens, ingediend_op: new Date().toISOString() }),
      });

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );

    } catch (err: any) {
      console.error("[medewerker-gegevens]", err.message);
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
