// ruim-id-kopieen-op
//
// Gooit kopieën van identiteitsbewijzen weg zodra ze veertien dagen bij het
// loonbureau liggen. Zie docs/modules/personeel/personeelsmodule.md:
// het loonbureau bewaart ze, wij houden ze alleen als vangnet voor het geval
// daar iets misgaat.
//
// Verwijdert het bestand uit de opslag én de verwijzing uit onboarding_data,
// en laat een datum achter zodat je kunt zien dat het gebeurd is.
//
// Draait dagelijks; wordt aangeroepen vanuit daily-digest.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BEWAARDAGEN = 14;

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

/** Haalt bucket en pad uit een opslag-URL. Werkt voor openbare en getekende
 *  links; geeft null terug als het geen opslag-URL van dit project is. */
function splitsOpslagUrl(url: string): { bucket: string; pad: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), pad: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

const STANDAARD_BUCKET = "Documenten";

async function verwijderBestand(waarde: string): Promise<boolean> {
  // Het invulformulier bewaart een pad ("id-kopie/onboarding-….jpg"), oudere
  // gegevens soms een volledig webadres. Allebei moeten werken.
  const deel = waarde.startsWith("http")
    ? splitsOpslagUrl(waarde)
    : { bucket: STANDAARD_BUCKET, pad: waarde.replace(/^\/+/, "") };
  if (!deel) {
    console.warn("[opruimen] onbekende verwijzing, overgeslagen:", waarde.slice(0, 60));
    return false;
  }
  const r = await fetch(`${SB_URL}/storage/v1/object/${deel.bucket}/${deel.pad}`, {
    method: "DELETE",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  // 404 betekent dat hij er al niet meer is; dat is ook goed
  if (!r.ok && r.status !== 404) {
    console.warn("[opruimen] verwijderen mislukt:", deel.bucket, deel.pad, r.status);
    return false;
  }
  return true;
}

serve(async () => {
  const grens = new Date(Date.now() - BEWAARDAGEN * 86_400_000).toISOString();

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/sollicitaties` +
        `?select=id,voornaam,achternaam,onboarding_data,oude_app_data,loonbureau_verstuurd_op` +
        `&loonbureau_verstuurd_op=lt.${grens}`,
      { headers: h },
    );
    if (!r.ok) throw new Error(`ophalen mislukt: ${r.status} ${await r.text()}`);

    const rijen = await r.json();
    let opgeruimd = 0;
    let bestanden = 0;

    const KOPIE_SLEUTELS = ["id_kopie_url", "id_kopie_achterzijde"];
    const nietGelukt: { naam: string; waarde: string }[] = [];

    for (const rij of rijen) {
      const naam = `${rij.voornaam ?? ""} ${rij.achternaam ?? ""}`.trim();
      const nieuwOnboarding = { ...(rij.onboarding_data ?? {}) };
      const nieuwOud = { ...(rij.oude_app_data ?? {}) };
      let ietsGedaan = false;

      // Beide plekken waar een ID-kopie kan staan: het invulformulier van nu,
      // en het gekopieerde blok uit de oude app.
      for (const blok of [nieuwOnboarding, nieuwOud]) {
        for (const k of KOPIE_SLEUTELS) {
          const waarde = (blok as Record<string, unknown>)[k];
          if (typeof waarde !== "string" || !waarde) continue;

          if (await verwijderBestand(waarde)) {
            bestanden++;
            // De verwijzing gaat er alléén uit als het bestand er echt uit is.
            // Anders zou het lijken alsof er opgeruimd is terwijl het er nog staat.
            delete (blok as Record<string, unknown>)[k];
            (blok as Record<string, unknown>).id_kopie_opgeruimd_op = new Date().toISOString();
            ietsGedaan = true;
          } else {
            nietGelukt.push({ naam, waarde: waarde.slice(0, 90) });
          }
        }
      }

      if (!ietsGedaan) continue;

      const p = await fetch(`${SB_URL}/rest/v1/sollicitaties?id=eq.${rij.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({ onboarding_data: nieuwOnboarding, oude_app_data: nieuwOud }),
      });
      if (!p.ok) {
        console.error("[opruimen] bijwerken mislukt voor", rij.id, await p.text());
        continue;
      }
      opgeruimd++;
      console.log(`[opruimen] ${naam}: ID-kopieën weg`);
    }

    return new Response(
      JSON.stringify({ ok: true, gecontroleerd: rijen.length, opgeruimd, bestanden, nietGelukt }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[opruimen]", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "onbekende fout" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
