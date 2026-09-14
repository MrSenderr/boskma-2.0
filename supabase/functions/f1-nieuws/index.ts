import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Haalt Nederlandstalig F1-nieuws op en levert het als JSON.
// Nodig omdat nieuwsfeeds geen CORS-headers meesturen en de browser ze
// daardoor niet rechtstreeks mag ophalen.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FEED = "https://nl.motorsport.com/rss/f1/news/";

function schoon(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function veld(blok: string, tag: string): string {
  const m = blok.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? schoon(m[1]) : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "BoskmaSignage/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`feed gaf status ${res.status}`);

    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, 12)
      .map((m) => {
        const blok = m[1];
        const datum = veld(blok, "pubDate");
        return {
          titel: veld(blok, "title"),
          link: veld(blok, "link"),
          gepubliceerd: datum ? new Date(datum).toISOString() : null,
        };
      })
      .filter((i) => i.titel);

    return new Response(JSON.stringify({ items }), {
      headers: {
        ...cors,
        "Content-Type": "application/json",
        // Kort cachen: het scherm vraagt vaak, de bron hoeft dat niet te merken.
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg, items: [] }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
