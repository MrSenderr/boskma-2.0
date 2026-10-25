// teken-contract
// POST { ondertekening: uuid }
// → maakt de getekende PDF: het originele contract met een blad erachter waarop
//   staat wie wanneer heeft getekend en met welke controlecode, zet hem in het
//   dossier en laat het origineel vervallen.
//
// Waarom dit op de server gebeurt en niet in de browser: de controlecode moet
// over de bytes gaan zoals ze in de opslag staan. Een browser die zegt dat de
// code klopt, zegt dat over wat hij zelf heeft gedownload.
//
// De code wordt hier opnieuw uitgerekend en vergeleken met wat bij het starten
// is vastgelegd. Lopen ze uiteen, dan is er na het tekenen een ander bestand
// komen te staan en gaat er niets door. Dat is het hele punt van de code: je
// moet kunnen laten zien dat er getekend is wát er gelezen is.
//
// Versturen naar het loonbureau zit hier niet in. Dat doet de app daarna met
// stuur-getekend-contract, dezelfde weg als bij een gescand contract — één
// plek waar het adres, de testmodus en de cc staan.

import { wieBelt } from "../_shared/beller.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL")!;
const BAK = "Documenten";

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Van(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** De code in blokjes van acht, zodat je hem met het oog kunt vergelijken. */
function inBlokjes(code: string): string {
  return (code.match(/.{1,8}/g) ?? []).join(" ");
}

function ontsnap(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tijdstip(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

function veiligeNaam(naam: string): string {
  return naam.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
}

type Blok = { rol: string; naam: string | null; extra?: string | null; op: string | null; krabbel: string | null };

function tekenBlok(b: Blok): string {
  /* Een lege lijn waar de krabbel zou staan als er geen is. Het blad moet er
     hetzelfde uitzien voor wie met een muis tekent als voor wie een telefoon
     heeft; de naam en het tijdstip zijn wat telt. */
  const krabbel = b.krabbel
    ? `<img class="krabbel" src="${b.krabbel}" alt="">`
    : `<div class="geen-krabbel">met de naam getekend</div>`;
  return `<div class="blok">
    <div class="rol">${ontsnap(b.rol)}</div>
    ${krabbel}
    <div class="lijn"></div>
    <div class="naam">${ontsnap(b.naam)}</div>
    ${b.extra ? `<div class="extra">${ontsnap(b.extra)}</div>` : ""}
    <div class="op">${ontsnap(tijdstip(b.op))}</div>
  </div>`;
}

function bouwBlad(o: {
  medewerker: string;
  bestand: string;
  code: string;
  blokken: Blok[];
}): string {
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Ondertekening</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1e; font-size: 10.5pt; margin: 0; }
  .kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .bedrijf { color: #003a41; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .bedrijf-sub { color: #6b7280; font-size: 7.5pt; margin-top: 4px; }
  .doc { text-align: right; }
  .doc-label { color: #9ca3af; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; }
  .doc-titel { font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .streep { height: 3px; background: #003a41; margin: 12px 0 18px; }
  .sectie { background: #f1efe6; color: #5c5342; font-size: 7.5pt; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase; padding: 6px 10px; margin: 22px 0 0; }
  p { margin: 10px 0; }
  .blokken { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 14px; }
  .blok { flex: 1 1 220px; min-width: 200px; }
  .rol { color: #6b7280; font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase; }
  .krabbel { display: block; height: 56px; width: auto; max-width: 100%; margin: 8px 0 0; }
  .geen-krabbel { height: 56px; display: flex; align-items: flex-end; color: #9ca3af;
                  font-size: 8pt; font-style: italic; }
  .lijn { border-bottom: 1px solid #1c1c1e; margin-top: 2px; }
  .naam { font-weight: 700; margin-top: 5px; }
  .extra { color: #6b7280; font-size: 8.5pt; }
  .op { color: #6b7280; font-size: 8.5pt; margin-top: 2px; }
  .code { font-family: "Courier New", Courier, monospace; font-size: 9pt; word-break: break-all;
          background: #f6f5f1; padding: 8px 10px; border-radius: 4px; margin-top: 6px; }
  .uitleg { color: #6b7280; font-size: 8.5pt; }
  .voet { margin-top: 36px; border-top: 1px solid #e8e6e0; padding-top: 8px;
          display: flex; justify-content: space-between; gap: 20px; color: #9ca3af; font-size: 7pt; }
</style></head>
<body>
  <div class="kop">
    <div>
      <div class="bedrijf">Boskma Foodservice V.O.F.</div>
      <div class="bedrijf-sub">Snackerie 't Zonnetje &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof &nbsp;·&nbsp; KvK 42020563</div>
    </div>
    <div class="doc">
      <div class="doc-label">Document</div>
      <div class="doc-titel">Ondertekening</div>
    </div>
  </div>

  <div class="streep"></div>

  <p>Dit blad hoort bij het contract van <strong>${ontsnap(o.medewerker)}</strong> op de
  voorgaande pagina's. Beide partijen hebben dat stuk digitaal in de app van
  Boskma Foodservice ondertekend.</p>

  <div class="sectie">Ondertekend door</div>
  <div class="blokken">${o.blokken.map(tekenBlok).join("")}</div>

  <div class="sectie">Controlecode van het ondertekende stuk</div>
  <p class="uitleg">Bestand: ${ontsnap(o.bestand)}</p>
  <div class="code">${ontsnap(inBlokjes(o.code))}</div>
  <p class="uitleg">Dit is de SHA-256 van het contract zoals het bij het tekenen voorlag,
  zonder dit blad. Verandert er één letter aan dat stuk, dan komt er een andere code uit.
  Daarmee is na te gaan dat er getekend is wat er gelezen is.</p>

  <div class="voet">
    <span>Boskma Foodservice V.O.F. &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof</span>
    <span>Vertrouwelijk</span>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    // Een contract getekend verklaren is niets voor wie alleen de publieke
    // sleutel uit de webapp heeft.
    if (!(await wieBelt(req))) return json({ ok: false, error: "hier mag je niet bij" }, 403);

    const { ondertekening } = await req.json().catch(() => ({}));
    if (typeof ondertekening !== "string" || !ondertekening) {
      return json({ ok: false, error: "geen ondertekening meegegeven" }, 400);
    }

    const velden =
      "*,dossier_documenten!ondertekeningen_document_id_fkey(id,naam,pad,medewerker_id)," +
      "sollicitaties(voornaam,achternaam)";
    const r = await fetch(
      `${SB_URL}/rest/v1/ondertekeningen?id=eq.${ondertekening}&select=${encodeURIComponent(velden)}`,
      { headers: h },
    );
    if (!r.ok) return json({ ok: false, error: `lezen mislukt: ${await r.text()}` }, 500);
    const o = (await r.json())?.[0];
    if (!o) return json({ ok: false, error: "ondertekening niet gevonden" }, 404);

    // Al eerder gedaan: hetzelfde antwoord, geen tweede document.
    if (o.afgerond_op && o.getekend_document_id) {
      return json({ ok: true, document_id: o.getekend_document_id, al_gemaakt: true });
    }

    if (o.ingetrokken_op) return json({ ok: false, error: "deze ondertekening is ingetrokken" }, 409);
    if (!o.medewerker_op) return json({ ok: false, error: "de medewerker heeft nog niet getekend" }, 409);
    if (!o.werkgever_op) return json({ ok: false, error: "de werkgever heeft nog niet getekend" }, 409);

    const doc = o.dossier_documenten;
    if (!doc?.pad) return json({ ok: false, error: "het contract staat niet meer in het dossier" }, 404);

    // 1. Het origineel ophalen en de code nameten.
    const bestand = await fetch(`${SB_URL}/storage/v1/object/${BAK}/${doc.pad}`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    if (!bestand.ok) {
      return json({ ok: false, error: `het contract kon niet worden opgehaald (${bestand.status})` }, 502);
    }
    const origineel = await bestand.arrayBuffer();
    const code = await sha256Van(origineel);

    if (code !== o.origineel_sha256) {
      return json(
        {
          ok: false,
          error:
            "Het contract is veranderd nadat er getekend is. Er is dus niet getekend wat er nu staat. " +
            "Trek deze ondertekening in en begin opnieuw met het stuk dat er nu ligt.",
        },
        409,
      );
    }

    // 2. Het blad met de handtekeningen.
    const naam = [o.sollicitaties?.voornaam, o.sollicitaties?.achternaam].filter(Boolean).join(" ");
    const blokken: Blok[] = [
      {
        rol: "Medewerker",
        naam: o.medewerker_naam,
        op: o.medewerker_op,
        krabbel: o.medewerker_krabbel,
      },
    ];
    if (o.ouder_naam) {
      blokken.push({
        rol: "Ouder of verzorger",
        naam: o.ouder_naam,
        extra: o.ouder_relatie,
        op: o.ouder_op,
        krabbel: o.ouder_krabbel,
      });
    }
    blokken.push({
      rol: "Werkgever",
      naam: o.werkgever_naam,
      extra: "Boskma Foodservice V.O.F.",
      op: o.werkgever_op,
      krabbel: o.werkgever_krabbel,
    });

    const blad = bouwBlad({ medewerker: naam, bestand: o.origineel_naam, code, blokken });

    const naarPdf = new FormData();
    naarPdf.append("files", new Blob([blad], { type: "text/html; charset=utf-8" }), "index.html");
    naarPdf.append("emulatedMediaType", "print");
    naarPdf.append("preferCssPageSize", "true");
    naarPdf.append("printBackground", "true");

    const gRes = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
      method: "POST",
      body: naarPdf,
      signal: AbortSignal.timeout(30000),
    });
    if (!gRes.ok) {
      return json({ ok: false, error: `het ondertekeningsblad kon niet gemaakt worden: ${await gRes.text()}` }, 502);
    }
    const bladPdf = await gRes.arrayBuffer();

    /* 3. Samenvoegen. Gotenberg zet de bestanden op naam op volgorde, dus de
       nummers vooraan bepalen wat er voorop komt. */
    const samen = new FormData();
    samen.append("files", new Blob([origineel], { type: "application/pdf" }), "1-contract.pdf");
    samen.append("files", new Blob([bladPdf], { type: "application/pdf" }), "2-ondertekening.pdf");

    const mRes = await fetch(`${GOTENBERG_URL}/forms/pdfengines/merge`, {
      method: "POST",
      body: samen,
      signal: AbortSignal.timeout(30000),
    });
    if (!mRes.ok) {
      return json({ ok: false, error: `samenvoegen mislukt: ${await mRes.text()}` }, 502);
    }
    const getekend = await mRes.arrayBuffer();
    const getekendCode = await sha256Van(getekend);

    // 4. In het dossier zetten, onder de map van de medewerker.
    const bestandsnaam = `getekend_contract_${veiligeNaam(naam || "medewerker")}.pdf`;
    const pad = `dossier/${o.medewerker_id}/${Date.now()}-${bestandsnaam}`;
    const op = await fetch(`${SB_URL}/storage/v1/object/${BAK}/${pad}`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "Content-Type": "application/pdf",
        "x-upsert": "false",
      },
      body: getekend,
    });
    if (!op.ok) return json({ ok: false, error: `opslaan mislukt: ${await op.text()}` }, 500);

    const nieuw = await fetch(`${SB_URL}/rest/v1/dossier_documenten`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({
        medewerker_id: o.medewerker_id,
        soort: "contract_getekend",
        naam: bestandsnaam,
        pad,
        toegevoegd_door: o.gestart_door,
        mime_type: "application/pdf",
        bytes: getekend.byteLength,
        sha256: getekendCode,
        notitie: `Digitaal getekend in de app. Controlecode van het originele contract: ${code}`,
      }),
    });
    if (!nieuw.ok) return json({ ok: false, error: `vastleggen mislukt: ${await nieuw.text()}` }, 500);
    const documentId = (await nieuw.json())?.[0]?.id;

    /* 5. Het ongetekende contract laten vervallen, met een verwijzing naar de
       getekende versie. Het bestand blijft staan — het is het stuk waar de
       controlecode over gaat. */
    await fetch(`${SB_URL}/rest/v1/dossier_documenten?id=eq.${doc.id}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ vervallen_op: new Date().toISOString(), vervangen_door: documentId }),
    });

    await fetch(`${SB_URL}/rest/v1/ondertekeningen?id=eq.${ondertekening}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({
        afgerond_op: new Date().toISOString(),
        getekend_document_id: documentId,
        bijgewerkt_op: new Date().toISOString(),
      }),
    });

    return json({ ok: true, document_id: documentId, code });
  } catch (e) {
    const bericht = e instanceof Error ? e.message : "onbekende fout";
    console.error("[teken-contract]", bericht);
    return json({ ok: false, error: bericht }, 500);
  }
});
