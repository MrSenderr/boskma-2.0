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
// Draait dagelijks om zes uur, via de cron ruim-id-kopieen-op-dagelijks.
//
// Twee plekken worden nagelopen. De personeelskaarten, en daarnaast de oude
// tabel medewerker_gegevens van het invulformulier uit boskma-app. Die tweede
// was jarenlang buiten beeld: deze opruimer werkte via de personeelslijst, en
// wie daar niet in staat — iemand die weer vertrok, of nooit als medewerker is
// aangemaakt — bleef zo met zijn identiteitsbewijs in de opslag staan. Op
// 24 oktober 2026 waren dat er acht, van vier mensen, uit juni en juli.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BEWAARDAGEN = 14;
/* Voor wezen een ruimere marge. Het invulformulier zet eerst het bestand neer
   en bewaart daarna pas de verwijzing; een bestand van vanmiddag is dus even
   een wees zonder dat er iets mis is. Dertig dagen is ruim buiten dat gaatje. */
const WEESDAGEN = 30;

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
  if (r.ok) return true;

  /* Al weg is ook goed. De opslag antwoordt daarop niet altijd met 404: bij een
     bestand dat er niet meer is komt er een 400 terug met "not_found" in de
     tekst. Dat werd hier als mislukking gelezen, en daardoor bleef de
     verwijzing staan naar een bestand dat allang verdwenen was — elke dag
     opnieuw gemeld, veertien keer, zonder dat er iets aan te doen viel. */
  const tekst = await r.text().catch(() => "");
  if (r.status === 404 || /not.?found/i.test(tekst)) return true;

  console.warn("[opruimen] verwijderen mislukt:", deel.bucket, deel.pad, r.status, tekst.slice(0, 120));
  return false;
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

    /* De oude tabel van het invulformulier. Daar hangt geen loonbureau-datum
       aan, dus geldt het moment van indienen: veertien dagen na het invullen
       ligt het bij het loonbureau en hoeven wij het niet meer te bewaren.

       Een pad dat óók nog op een personeelskaart staat blijft met rust. Dat
       komt voor — het formulier en de kaart deelden hun uploads — en dan is de
       kaart de baas; die wordt hierboven al op zijn eigen moment opgeruimd. */
    const nogInGebruik = new Set<string>();
    const kaarten = await fetch(
      `${SB_URL}/rest/v1/sollicitaties?select=onboarding_data&onboarding_data=not.is.null`,
      { headers: h },
    ).then((r) => (r.ok ? r.json() : []));
    for (const k of kaarten) {
      for (const sleutel of KOPIE_SLEUTELS) {
        const w = k.onboarding_data?.[sleutel];
        if (typeof w === "string" && w) nogInGebruik.add(w);
      }
    }

    const oudeGrens = new Date(Date.now() - BEWAARDAGEN * 86_400_000).toISOString();
    const oud = await fetch(
      `${SB_URL}/rest/v1/medewerker_gegevens?select=id,medewerker_naam,gegevens,bestaande_gegevens` +
        `&ingediend_op=lt.${oudeGrens}`,
      { headers: h },
    ).then((r) => (r.ok ? r.json() : []));

    let oudOpgeruimd = 0;
    for (const rij of oud) {
      const gegevens = { ...(rij.gegevens ?? {}) };
      let ietsGedaan = false;

      for (const k of KOPIE_SLEUTELS) {
        const waarde = gegevens[k];
        if (typeof waarde !== "string" || !waarde) continue;
        if (nogInGebruik.has(waarde)) continue;

        if (await verwijderBestand(waarde)) {
          bestanden++;
          delete gegevens[k];
          gegevens.id_kopie_opgeruimd_op = new Date().toISOString();
          ietsGedaan = true;
        } else {
          nietGelukt.push({ naam: rij.medewerker_naam ?? "?", waarde: waarde.slice(0, 90) });
        }
      }

      if (!ietsGedaan) continue;
      const p = await fetch(`${SB_URL}/rest/v1/medewerker_gegevens?id=eq.${rij.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({ gegevens }),
      });
      if (!p.ok) {
        console.error("[opruimen] oude tabel bijwerken mislukt voor", rij.id, await p.text());
        continue;
      }
      oudOpgeruimd++;
      console.log(`[opruimen] ${rij.medewerker_naam}: ID-kopieën weg (oud formulier)`);
    }

    /* Wezen: bestanden in de opslag waar nergens meer een verwijzing naar
       staat. De twee rondes hierboven werken van de administratie naar de
       opslag, en vinden zo'n bestand dus nooit — het staat in geen enkele rij.
       Op 24 oktober 2026 lagen er tweeëntwintig, uit juni en juli: uploads
       waarvan het formulier nooit is afgemaakt, of die bij het overzetten naar
       de nieuwe app zijn losgeraakt.

       Deze ronde kijkt andersom: van de opslag naar de administratie. */
    const genoemd = new Set<string>(nogInGebruik);
    for (const rij of rijen) {
      for (const blok of [rij.onboarding_data, rij.oude_app_data]) {
        for (const k of KOPIE_SLEUTELS) {
          const w = blok?.[k];
          if (typeof w === "string" && w) genoemd.add(w);
        }
      }
    }
    for (const rij of oud) {
      for (const blok of [rij.gegevens, rij.bestaande_gegevens]) {
        for (const k of KOPIE_SLEUTELS) {
          const w = blok?.[k];
          if (typeof w === "string" && w) genoemd.add(w);
        }
      }
    }

    const lijst = await fetch(`${SB_URL}/storage/v1/object/list/${STANDAARD_BUCKET}`, {
      method: "POST", headers: h,
      body: JSON.stringify({ prefix: "id-kopie/", limit: 1000 }),
    }).then((r) => (r.ok ? r.json() : []));

    const weesGrens = Date.now() - WEESDAGEN * 86_400_000;
    let wezen = 0;
    for (const bestand of lijst as { name: string; created_at?: string }[]) {
      const pad = `id-kopie/${bestand.name}`;
      if (genoemd.has(pad)) continue;
      // Een vers bestand met rust laten: de verwijzing kan nog onderweg zijn.
      if (bestand.created_at && new Date(bestand.created_at).getTime() > weesGrens) continue;
      if (await verwijderBestand(pad)) {
        wezen++;
        console.log(`[opruimen] wees weg: ${pad}`);
      } else {
        nietGelukt.push({ naam: "(wees)", waarde: pad.slice(0, 90) });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true, gecontroleerd: rijen.length, opgeruimd, bestanden, nietGelukt,
        oudFormulier: { gecontroleerd: oud.length, opgeruimd: oudOpgeruimd },
        wezen,
      }),
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
