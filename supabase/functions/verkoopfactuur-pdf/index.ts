// verkoopfactuur-pdf
//
// POST { factuur_id, concept?: boolean }
//
// Maakt de pdf van een verkoopfactuur. Zelfde weg als generate-contract-pdf:
// we bouwen HTML en laten Gotenberg (headless Chrome) er een A4 van maken.
//
// Een definitieve factuur gaat in de prive-bucket 'verkoopfacturen' onder
// <jaar>/<nummer>.pdf en het pad komt in de factuur te staan. Een concept
// krijgt een watermerk en wordt niet bewaard: een concept is geen factuur.

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

/* --------------------------------------------------------------- tekst --- */

const veilig = (t: unknown) =>
  String(t ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const euro = (n: number) =>
  "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const datum = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL",
      { day: "numeric", month: "long", year: "numeric" }) : "";

/** 2,5 wordt "2,5" en 75 wordt "75" — geen 75,00 op een factuur. */
const aantalTekst = (n: number) =>
  Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toLocaleString("nl-NL");

/* ----------------------------------------------------------------- html --- */

type Regel = {
  omschrijving: string; aantal: number; prijs_incl: number; btw_tarief: number;
};

function bouwHtml(f: any, klant: any, regels: Regel[], bedrijf: any, concept: boolean) {
  const adresKlant = [
    veilig(klant?.naam),
    klant?.adres ? veilig(klant.adres) : "",
    [klant?.postcode, klant?.plaats].filter(Boolean).map(veilig).join(" "),
    klant?.btw_nummer ? `Btw-nummer: ${veilig(klant.btw_nummer)}` : "",
  ].filter(Boolean).join("<br>");

  const levering = f.periode
    ? `Periode: ${veilig(f.periode)}`
    : f.leverdatum ? `Geleverd op ${datum(f.leverdatum)}` : "";

  const rijen = regels.map((r) => {
    const bedrag = Math.round(Number(r.aantal) * Math.round(Number(r.prijs_incl) * 100)) / 100;
    return `<tr>
      <td>${veilig(r.omschrijving)}</td>
      <td class="nr">${aantalTekst(r.aantal)}</td>
      <td class="nr">${euro(Number(r.prijs_incl))}</td>
      <td class="nr">${r.btw_tarief}%</td>
      <td class="nr">${euro(bedrag)}</td>
    </tr>`;
  }).join("");

  // Per tarief wat er excl. btw onder zit; de klant moet dat kunnen narekenen.
  const perTarief = [9, 21, 0].map((t) => {
    const incl = regels.filter((r) => Number(r.btw_tarief) === t)
      .reduce((s, r) => s + Math.round(Number(r.aantal) * Math.round(Number(r.prijs_incl) * 100)), 0);
    if (incl === 0) return "";
    const btw = Math.round((incl * t) / (100 + t));
    return `<tr><td>Btw ${t}% over ${euro((incl - btw) / 100)}</td><td class="nr">${euro(btw / 100)}</td></tr>`;
  }).join("");

  const nummer = concept ? "CONCEPT" : String(f.nummer ?? "");

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Factuur ${veilig(nummer)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1e; font-size: 10.5pt; margin: 0; }
  .kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .bedrijf { color: #003a41; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .bedrijf-sub { color: #6b7280; font-size: 7.5pt; margin-top: 4px; }
  .doc { text-align: right; }
  .doc-label { color: #9ca3af; font-size: 7pt; letter-spacing: .16em; text-transform: uppercase; }
  .doc-titel { font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .doc-datum { color: #6b7280; font-size: 7.5pt; margin-top: 2px; }
  .streep { height: 3px; background: #003a41; margin: 12px 0 18px; }
  .aan { margin: 18px 0 6px; }
  .aan-label { color: #9ca3af; font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; }
  .levering { color: #6b7280; font-size: 9pt; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase;
       color: #6b7280; border-bottom: 1px solid #003a41; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #e8e6e0; vertical-align: top; }
  td.nr, th.nr { text-align: right; white-space: nowrap; }
  .totalen { margin-top: 14px; margin-left: auto; width: 62%; }
  .totalen td { border: none; padding: 3px 8px; color: #6b7280; }
  .totalen tr.eind td { border-top: 2px solid #003a41; padding-top: 8px;
                        font-size: 12pt; font-weight: 700; color: #1c1c1e; }
  .betalen { margin-top: 22px; background: #f1efe6; padding: 10px 12px; font-weight: 600; }
  .notitie { margin-top: 14px; color: #6b7280; white-space: pre-wrap; }
  .voet { margin-top: 34px; border-top: 1px solid #e8e6e0; padding-top: 8px;
          color: #9ca3af; font-size: 7pt; display: flex; justify-content: space-between; gap: 20px; }
  .watermerk { position: fixed; top: 42%; left: 0; right: 0; text-align: center;
               font-size: 70pt; font-weight: 700; color: rgba(0,58,65,.08);
               letter-spacing: .1em; transform: rotate(-20deg); }
</style></head>
<body>
  ${concept ? '<div class="watermerk">CONCEPT</div>' : ""}

  <div class="kop">
    <div>
      <div class="bedrijf">${veilig(bedrijf.handelsnaam || bedrijf.naam)}</div>
      <div class="bedrijf-sub">
        ${veilig(bedrijf.naam)} &nbsp;·&nbsp; ${veilig(bedrijf.adres)}, ${veilig(bedrijf.postcode)} ${veilig(bedrijf.plaats)}<br>
        KvK ${veilig(bedrijf.kvk)} &nbsp;·&nbsp; Btw-nummer ${veilig(bedrijf.btw)}
        ${bedrijf.telefoon ? ` &nbsp;·&nbsp; ${veilig(bedrijf.telefoon)}` : ""}
        ${bedrijf.email ? ` &nbsp;·&nbsp; ${veilig(bedrijf.email)}` : ""}
      </div>
    </div>
    <div class="doc">
      <div class="doc-label">Factuur</div>
      <div class="doc-titel">${veilig(nummer)}</div>
      <div class="doc-datum">${concept ? "nog niet verstuurd" : datum(f.factuurdatum)}</div>
    </div>
  </div>

  <div class="streep"></div>

  <div class="aan">
    <div class="aan-label">Aan</div>
    <div>${adresKlant}</div>
  </div>

  ${f.onderwerp ? `<p style="font-weight:600;margin:14px 0 2px">${veilig(f.onderwerp)}</p>` : ""}
  ${levering ? `<div class="levering">${levering}</div>` : ""}

  <table>
    <thead><tr>
      <th>Omschrijving</th><th class="nr">Aantal</th><th class="nr">Prijs incl.</th>
      <th class="nr">Btw</th><th class="nr">Bedrag incl.</th>
    </tr></thead>
    <tbody>${rijen || '<tr><td colspan="5">Geen regels</td></tr>'}</tbody>
  </table>

  <table class="totalen">
    <tr><td>Totaal excl. btw</td><td class="nr">${euro(Number(f.totaal_excl))}</td></tr>
    ${perTarief}
    <tr class="eind"><td>Totaal incl. btw</td><td class="nr">${euro(Number(f.totaal_incl))}</td></tr>
  </table>

  ${concept ? "" : `<div class="betalen">
    Graag betalen vóór ${datum(f.vervaldatum)} op ${veilig(bedrijf.iban)}
    t.n.v. ${veilig(bedrijf.naam)} o.v.v. factuurnummer ${veilig(nummer)}.
  </div>`}

  ${f.notitie_op_factuur ? `<div class="notitie">${veilig(f.notitie_op_factuur)}</div>` : ""}

  <div class="voet">
    <span>${veilig(bedrijf.naam)} &nbsp;·&nbsp; ${veilig(bedrijf.adres)}, ${veilig(bedrijf.postcode)} ${veilig(bedrijf.plaats)}</span>
    <span>KvK ${veilig(bedrijf.kvk)} &nbsp;·&nbsp; ${veilig(bedrijf.iban)}</span>
  </div>
</body></html>`;
}

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

    const { factuur_id, concept } = await req.json().catch(() => ({}));
    const id = Number(factuur_id);
    if (!Number.isInteger(id) || id <= 0) return fout("ongeldig factuurnummer");

    const f = (await haal(`verkoopfacturen?id=eq.${id}&select=*`))?.[0];
    if (!f) return fout("factuur niet gevonden", 404);

    const isConcept = concept ?? f.nummer === null;
    if (!isConcept && f.nummer === null) return fout("deze factuur heeft nog geen nummer");

    const [klant, regels, inst] = await Promise.all([
      haal(`klanten?id=eq.${f.klant_id}&select=*`).then((r) => r?.[0]),
      haal(`verkoopfactuur_regels?factuur_id=eq.${id}&select=*&order=volgorde`),
      haal(`instellingen?sleutel=eq.bedrijf&select=waarde`).then((r) => r?.[0]?.waarde),
    ]);
    if (!inst) return fout("bedrijfsgegevens ontbreken in de instellingen", 500);

    const html = bouwHtml(f, klant, regels ?? [], inst, isConcept);

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
    if (!isConcept) {
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

    const naam = `Snackerie 't Zonnetje - Factuur ${isConcept ? "concept" : f.nummer}.pdf`;
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
