// verkoopfactuur-pdf
//
// POST { factuur_id, concept?: boolean }
//
// Maakt de pdf van een verkoopfactuur. Zelfde weg als generate-contract-pdf:
// we bouwen HTML en laten Gotenberg (headless Chrome) er een A4 van maken.
//
// Een definitieve factuur gaat in de prive-bucket 'verkoopfacturen' onder
// <jaar>/<nummer>.pdf en het pad komt in de factuur te staan. Een concept en
// een testfactuur krijgen een watermerk en worden niet bewaard: dat zijn geen
// facturen en ze horen niet in het archief.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL  = Deno.env.get("SUPABASE_URL")!;
const SB_KEY  = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOTENBERG = Deno.env.get("GOTENBERG_URL")!;

const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fout = (bericht: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: bericht }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

import { bouwHtml, type Soort } from "./factuur-html.ts";

/* ---------------------------------------------------------------- doen --- */

async function haal(pad: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${pad}`, { headers: h });
  if (!r.ok) throw new Error(`ophalen mislukt: ${await r.text()}`);
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fout("alleen POST", 405);

  try {
    if (!GOTENBERG) return fout("GOTENBERG_URL niet ingesteld", 500);

    const { factuur_id, soort: gevraagd } = await req.json().catch(() => ({}));
    const id = Number(factuur_id);
    if (!Number.isInteger(id) || id <= 0) return fout("ongeldig factuurnummer");

    const f = (await haal(`verkoopfacturen?id=eq.${id}&select=*`))?.[0];
    if (!f) return fout("factuur niet gevonden", 404);

    // Zonder nummer kan het nooit een echte factuur zijn.
    const soort: Soort =
      gevraagd === "test" ? "test"
      : gevraagd === "concept" || f.nummer === null ? "concept"
      : "definitief";

    const [klant, regels, inst] = await Promise.all([
      haal(`klanten?id=eq.${f.klant_id}&select=*`).then((r) => r?.[0]),
      haal(`verkoopfactuur_regels?factuur_id=eq.${id}&select=*&order=volgorde`),
      haal(`instellingen?sleutel=eq.bedrijf&select=waarde`).then((r) => r?.[0]?.waarde),
    ]);
    if (!inst) return fout("bedrijfsgegevens ontbreken in de instellingen", 500);

    const html = bouwHtml(f, klant, regels ?? [], inst, soort);

    const form = new FormData();
    form.append("files", new Blob([html], { type: "text/html" }), "index.html");
    const pdfRes = await fetch(`${GOTENBERG}/forms/chromium/convert/html`, {
      method: "POST", body: form,
    });
    if (!pdfRes.ok) return fout(`pdf maken mislukt: ${await pdfRes.text()}`, 502);
    const pdf = new Uint8Array(await pdfRes.arrayBuffer());

    // Een concept bewaren we niet: dat is geen factuur en hoort niet in het
    // archief terecht te komen.
    let pad: string | null = null;
    if (soort === "definitief") {
      const jaar = String(f.factuurdatum ?? "").slice(0, 4) || String(new Date().getFullYear());
      pad = `${jaar}/${f.nummer}.pdf`;
      const op = await fetch(`${SB_URL}/storage/v1/object/verkoopfacturen/${pad}`, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
                   "Content-Type": "application/pdf", "x-upsert": "true" },
        body: pdf,
      });
      if (!op.ok) return fout(`opslaan mislukt: ${await op.text()}`, 500);

      await fetch(`${SB_URL}/rest/v1/verkoopfacturen?id=eq.${id}`, {
        method: "PATCH", headers: h, body: JSON.stringify({ pdf_pad: pad }),
      });
    }

    const naam = `Snackerie 't Zonnetje - Factuur ${
      soort === "definitief" ? f.nummer : soort === "test" ? `TEST-${f.nummer ?? f.id}` : "concept"
    }.pdf`;
    return new Response(pdf, {
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${naam}"`,
        "X-Factuur-Pad": pad ?? "",
      },
    });
  } catch (e) {
    return fout(e instanceof Error ? e.message : "onbekende fout", 500);
  }
});
