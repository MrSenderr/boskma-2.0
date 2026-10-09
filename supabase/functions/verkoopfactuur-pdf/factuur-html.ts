// De opmaak van de factuur, los van het versturen.
//
// Apart bestand zodat de pdf lokaal te bekijken is zonder hem te moeten
// versturen: wat de klant ziet moet je kunnen nakijken voordat het de deur
// uitgaat. index.ts haalt het hier vandaan.

export type Regel = {
  omschrijving: string; aantal: number; prijs_incl: number; btw_tarief: number;
};

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

/** Wat voor papier dit is. Een concept is nog geen factuur, een testfactuur is
 *  er een die nooit bij een klant hoort te belanden. Allebei herkenbaar, want
 *  een pdf die je later terugvindt moet zichzelf kunnen uitleggen. */
import { LOGO_SVG } from "./logo.ts";

export type Soort = "definitief" | "concept" | "test";

export function bouwHtml(f: any, klant: any, regels: Regel[], bedrijf: any, soort: Soort) {
  /* Een testfactuur ziet eruit zoals de klant hem krijgt — dat is het hele
     punt ervan. Alleen het nummer en het watermerk verraden het. Een concept
     is wel anders: dat is nog geen factuur en heeft dus geen betaalzin. */
  const alsEchteFactuur = soort !== "concept";
  const adresKlant = [
    `<strong>${veilig(klant?.naam)}</strong>`,
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

  const nummer =
    soort === "definitief" ? String(f.nummer ?? "")
    : soort === "test"     ? `TEST-${f.nummer ?? f.id ?? 1}`
    : "CONCEPT";
  const watermerk = soort === "test" ? "TEST" : soort === "concept" ? "CONCEPT" : "";
  const onderschrift =
    soort === "definitief" ? datum(f.factuurdatum)
    : soort === "test"     ? "testfactuur, niet verstuurd"
    : "nog niet verstuurd";

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Factuur ${veilig(nummer)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1e; font-size: 10.5pt; margin: 0; }
  .kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .logo { width: 26mm; margin-bottom: 5px; }
  .logo svg { width: 100%; height: auto; display: block; }
  /* Smal houden, anders leest het als een losse band over de hele pagina. */
  .bedrijf-sub { color: #6b7280; font-size: 7.5pt; line-height: 1.55; max-width: 92mm; }
  .doc { text-align: right; }
  .doc-label { color: #9ca3af; font-size: 7pt; letter-spacing: .16em; text-transform: uppercase; }
  .doc-titel { font-size: 22pt; font-weight: 700; line-height: 1.1; }
  .doc-datum { color: #6b7280; font-size: 7.5pt; margin-top: 2px; }
  .meta { margin-top: 8px; font-size: 8.5pt; color: #6b7280; }
  .meta b { color: #1c1c1e; }
  .streep { height: 3px; background: #003a41; margin: 10px 0 16px; }
  .aan { margin: 0 0 6px; }
  .aan-label { color: #9ca3af; font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; }
  .levering { color: #6b7280; font-size: 9pt; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .totalen, .betalen { break-inside: avoid; }
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
  ${watermerk ? `<div class="watermerk">${watermerk}</div>` : ""}

  <div class="kop">
    <div>
      <div class="logo">${LOGO_SVG}</div>
      <div class="bedrijf-sub">
        ${veilig(bedrijf.naam)} &nbsp;·&nbsp; ${veilig(bedrijf.adres)}, ${veilig(bedrijf.postcode)} ${veilig(bedrijf.plaats)}<br>
        KvK ${veilig(bedrijf.kvk)} &nbsp;·&nbsp; Btw-nummer ${veilig(bedrijf.btw)}
        ${bedrijf.telefoon || bedrijf.email ? `<br>${[bedrijf.telefoon, bedrijf.email].filter(Boolean).map(veilig).join(" &nbsp;·&nbsp; ")}` : ""}
      </div>
    </div>
    <div class="doc">
      <div class="doc-label">Factuur</div>
      <div class="doc-titel">${veilig(nummer)}</div>
      <div class="doc-datum">${onderschrift}</div>
      ${alsEchteFactuur ? `<div class="meta">
        Factuurdatum <b>${datum(f.factuurdatum)}</b><br>
        Vervaldatum <b>${datum(f.vervaldatum)}</b>
      </div>` : ""}
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

  ${alsEchteFactuur ? `<div class="betalen">
    Graag betalen vóór ${datum(f.vervaldatum)} op ${veilig(bedrijf.iban)}
    t.n.v. ${veilig(bedrijf.naam)} o.v.v. factuurnummer ${veilig(nummer)}.
  </div>` : ""}

  ${f.notitie_op_factuur ? `<div class="notitie">${veilig(f.notitie_op_factuur)}</div>` : ""}

  <div class="voet">
    <span>${veilig(bedrijf.naam)} &nbsp;·&nbsp; ${veilig(bedrijf.adres)}, ${veilig(bedrijf.postcode)} ${veilig(bedrijf.plaats)}</span>
    <span>KvK ${veilig(bedrijf.kvk)} &nbsp;·&nbsp; ${veilig(bedrijf.iban)}</span>
  </div>
</body></html>`;
}

