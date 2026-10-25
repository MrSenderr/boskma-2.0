// brief-pdf
// POST { html, bestandsnaam? }
// → maakt er een A4-pdf van en geeft die terug om te downloaden.
//
// Papier is in de hele contractmodule de terugval: wie de app niet opent, geen
// mail leest, of liever met een pen tekent. Tot nu toe zei de app wel "geef het
// op papier mee" maar maakte dat papier niet.
//
// De html komt uit de app en wordt hier niet opnieuw opgebouwd — zelfde reden
// als bij stuur-voorstel en stuur-loonbureau: één plek waar de brief geschreven
// wordt. De pdf wordt niet bewaard. Wat bewaard moet blijven is de brief zoals
// verstuurd, en die staat al bij het voorstel; een los pdf'je ernaast zou een
// tweede waarheid zijn.
//
// Alleen een beheerder mag hier binnen. Wie html naar een pdf kan laten zetten
// kan die pdf ook laten ophalen door de browser van Gotenberg, en dat is niets
// voor wie alleen de publieke sleutel uit de webapp heeft.

import { wieBelt } from "../_shared/beller.ts";

const GOTENBERG = Deno.env.get("GOTENBERG_URL")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fout = (bericht: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: bericht }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function veiligeNaam(naam: string): string {
  return (naam.replace(/\s+/g, "_").replace(/[^\w.-]/g, "") || "brief").slice(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fout("alleen POST", 405);

  try {
    if (!(await wieBelt(req))) return fout("hier mag je niet bij", 403);
    if (!GOTENBERG) return fout("GOTENBERG_URL niet ingesteld", 500);

    const { html, bestandsnaam } = await req.json().catch(() => ({}));
    if (typeof html !== "string" || !html.trim()) return fout("geen html meegegeven");

    const vorm = new FormData();
    vorm.append("files", new Blob([html], { type: "text/html; charset=utf-8" }), "index.html");
    vorm.append("emulatedMediaType", "print");
    vorm.append("preferCssPageSize", "true");
    vorm.append("printBackground", "true");

    const res = await fetch(`${GOTENBERG}/forms/chromium/convert/html`, {
      method: "POST",
      body: vorm,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return fout(`de pdf kon niet gemaakt worden: ${await res.text()}`, 502);

    const pdf = await res.arrayBuffer();
    const naam = veiligeNaam(typeof bestandsnaam === "string" ? bestandsnaam : "brief");

    return new Response(pdf, {
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${naam}.pdf"`,
      },
    });
  } catch (e) {
    const bericht = e instanceof Error ? e.message : "onbekende fout";
    console.error("[brief-pdf]", bericht);
    return fout(bericht, 500);
  }
});
