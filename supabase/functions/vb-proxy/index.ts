import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Strip HTML tags and decode common entities
function strip(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/gi, (_: string, n: string) =>
      String.fromCharCode(parseInt(n, 10))
    )
    .replace(/\s+/g, " ")
    .trim();
}

const ALLERGEN_MAP: Record<string, string> = {
  "glutenbevattende granen": "gluten",
  gluten: "gluten",
  schaaldieren: "schaaldieren",
  ei: "ei",
  eieren: "ei",
  vis: "vis",
  vissen: "vis",
  "pinda's": "pinda",
  pinda: "pinda",
  soja: "soja",
  melk: "melk",
  lactose: "melk",
  noten: "noten",
  boomvruchten: "noten",
  selderij: "selderij",
  mosterd: "mosterd",
  sesam: "sesamzaad",
  sesamzaad: "sesamzaad",
  sulfiet: "sulfiet",
  sulfieten: "sulfiet",
  "sulfiet en sulfieten": "sulfiet",
  zwaveldioxide: "sulfiet",
  lupine: "lupine",
  weekdieren: "weekdieren",
  "schelp- en weekdieren": "weekdieren",
};

function parse(html: string) {
  // ── naam ──────────────────────────────────────────────────────────────────
  const naam = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");

  // ── specs (dl/dt/dd) ──────────────────────────────────────────────────────
  // Use a step-by-step approach: find each <dt>…</dt> then grab the next <dd>
  const specs: Record<string, string> = {};
  const dtPattern = /<dt[^>]*>([\s\S]*?)<\/dt>/gi;
  let dtMatch;
  while ((dtMatch = dtPattern.exec(html)) !== null) {
    const key = strip(dtMatch[1]).toLowerCase();
    if (!key) continue;
    // Find the next <dd> after this <dt>
    const afterDt = html.slice(dtMatch.index + dtMatch[0].length);
    const ddMatch = afterDt.match(/^[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/i);
    if (ddMatch) {
      const val = strip(ddMatch[1]);
      if (val) specs[key] = val;
    }
  }

  // Fallback: table rows th/td
  for (const m of html.matchAll(
    /<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
  )) {
    const k = strip(m[1]).toLowerCase();
    const v = strip(m[2]);
    if (k && v && !specs[k]) specs[k] = v;
  }

  // Fallback: <div class="label">…</div><div class="value">…</div> (Veldboer product detail page)
  for (const m of html.matchAll(/<div[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)) {
    const k = strip(m[1]).toLowerCase();
    const v = strip(m[2]);
    if (k && v && !specs[k]) specs[k] = v;
  }

  const merk = specs["merk"] ?? "";
  const eenheid = specs["eenheid"] ?? "";
  const inhoud = specs["inhoud"] ?? "";
  const bewaarconditie = specs["bewaarconditie"] ?? "";
  const artnr = specs["artikel"] ?? specs["artnr"] ?? "";

  // ── aantalPerVerpakking ───────────────────────────────────────────────────
  // inhoud examples: "13x75 gram", "75 x 10 gr", "6 x 2,5 kg"
  let aantalPerVerpakking: number | null = null;
  if (inhoud) {
    const m = inhoud.match(/^(\d+)\s*[xX×]/);
    if (m) aantalPerVerpakking = parseInt(m[1], 10);
  }

  // ── allergenen ────────────────────────────────────────────────────────────
  // Pattern: <img ...psinfood... alt="Name"> ... <span class="status">Aanwezig</span>
  // The img and status span are siblings inside a small wrapper element (~600 chars apart)
  const allergenen: string[] = [];
  for (const m of html.matchAll(
    /<img[^>]+psinfood[^>]+alt="([^"]*)"[^>]*>[\s\S]{0,600}?<span[^>]*class="[^"]*status[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  )) {
    const name = m[1].toLowerCase().trim();
    const status = strip(m[2]).toLowerCase();
    if (status === "aanwezig" || status === "+") {
      const id = ALLERGEN_MAP[name];
      if (id && !allergenen.includes(id)) allergenen.push(id);
    }
  }

  // ── categorieBreadcrumb ───────────────────────────────────────────────────
  // Breadcrumb links: /nl/producten/{categorie}/...
  // Pick the first segment after /producten/ that isn't a special path
  let categorieBreadcrumb = "";
  for (const m of html.matchAll(/href="\/nl\/producten\/([^/"?+\s]+)/gi)) {
    const seg = m[1];
    // Skip generic segments
    if (seg && seg !== "groups" && seg !== "g" && seg !== "c") {
      categorieBreadcrumb = seg;
      break;
    }
  }

  // ── ingrediënten ──────────────────────────────────────────────────────────
  let ingredienten = "";
  const ingMatch = html.match(
    /[Ii]ngredi[eë]nten[^<]{0,60}<(?:p|dd|div|span|td)[^>]*>([\s\S]{0,1000}?)<\//
  );
  if (ingMatch) ingredienten = strip(ingMatch[1]);

  return {
    naam,
    merk,
    eenheid,
    inhoud,
    aantalPerVerpakking,
    bewaarconditie,
    artnr,
    allergenen,
    ingredienten,
    categorieBreadcrumb,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const artnr = new URL(req.url).searchParams.get("artnr");
  if (!artnr) {
    return new Response(JSON.stringify({ error: "artnr required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(
      `https://veldboereenhoorn.nl/nl/artnr/${encodeURIComponent(artnr)}`,
      { signal: AbortSignal.timeout(10000) }
    );

    // Alleen harde 404 direct afwijzen; andere statuscodes (incl. 403) gewoon parsen —
    // Veldboer stuurt soms 403 maar levert de HTML wél mee.
    if (res.status === 404) {
      return new Response(
        JSON.stringify({ error: "Product not found", http_code: 404 }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const html = await res.text();
    const product = parse(html);

    if (!product.naam) {
      // Naam ontbreekt — stuur debug-info terug zodat we kunnen zien wat Veldboer retourneert
      return new Response(
        JSON.stringify({
          error: "Product not found",
          http_code: res.status,
          debug_preview: html.slice(0, 500),
        }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(product), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
