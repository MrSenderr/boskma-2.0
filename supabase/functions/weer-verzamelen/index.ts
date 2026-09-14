import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Vult de weerreeks in dagboek_dagen aan uit het Open-Meteo-archief.
 *
 * Draait op een schema, niet in een browser. De vorige versie hing in de oude
 * app: die vulde de reeks alleen als iemand het scherm openhad, en toen dat
 * stopte viel de reeks stil zonder dat iets het meldde.
 *
 * Zoekt elke keer de hele reeks na, niet alleen de laatste dag. Een gat dat om
 * welke reden dan ook ontstaat wordt bij de volgende ronde vanzelf gedicht.
 * Dat is het verschil tussen bijhouden en verzamelen.
 */

const BREEDTE = 52.729591; // Wervershoof
const LENGTE = 5.159620;
const ARCHIEF = "https://archive-api.open-meteo.com/v1/archive";
const DAGVELDEN =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max,sunshine_duration";

/** Hoe ver terug we kijken als de tabel nog leeg zou zijn. */
const STARTDAGEN = 60;

/* Dezelfde vertaling als de oude app gebruikte, zodat oude en nieuwe rijen
   dezelfde woorden bevatten. Verander je dit, dan verandert de betekenis van
   179 bestaande rijen mee. */
function wmoNaarNL(code: number | null): string {
  if (code === null || code === undefined) return "Onbekend";
  if (code === 0) return "Helder";
  if (code === 1) return "Overwegend helder";
  if (code === 2) return "Gedeeltelijk bewolkt";
  if (code === 3) return "Bewolkt";
  if (code === 45 || code === 48) return "Mist";
  if (code >= 51 && code <= 55) return "Motregen";
  if (code >= 61 && code <= 65) return "Regen";
  if (code >= 66 && code <= 67) return "IJsregen";
  if (code >= 71 && code <= 77) return "Sneeuw";
  if (code >= 80 && code <= 82) return "Regenbuien";
  if (code === 85 || code === 86) return "Sneeuwbuien";
  if (code === 95) return "Onweer";
  if (code === 96 || code === 99) return "Onweer met hagel";
  return "Bewolkt";
}

/** Een kalenderdag in Wervershoof, niet in UTC - anders schuift alles een dag. */
function dagInNL(verschuiving = 0): string {
  const nu = new Date();
  nu.setUTCDate(nu.getUTCDate() + verschuiving);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nu);
}

function volgendeDag(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function reeks(van: string, tot: string): string[] {
  const dagen: string[] = [];
  for (let d = van; d <= tot; d = volgendeDag(d)) dagen.push(d);
  return dagen;
}

function antwoord(inhoud: Record<string, unknown>, begonnen: number) {
  console.log("weer-verzamelen:", JSON.stringify(inhoud));
  return new Response(JSON.stringify({ ...inhoud, ms: Date.now() - begonnen }), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (_req: Request) => {
  const begonnen = Date.now();
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Het archief loopt achter op vandaag; gisteren is de laatste dag die
    // betrouwbaar compleet is.
    const gisteren = dagInNL(-1);

    const { data: bestaand, error: leesFout } = await db
      .from("dagboek_dagen")
      .select("datum")
      .order("datum");
    if (leesFout) throw new Error(`lezen mislukt: ${leesFout.message}`);

    const aanwezig = new Set((bestaand ?? []).map((r) => r.datum as string));
    const eerste = bestaand?.length
      ? (bestaand[0].datum as string)
      : dagInNL(-STARTDAGEN);

    const ontbreekt = reeks(eerste, gisteren).filter((d) => !aanwezig.has(d));
    if (ontbreekt.length === 0) {
      return antwoord(
        { nieuw: 0, van: eerste, tot: gisteren, melding: "reeks is dicht" },
        begonnen,
      );
    }

    const url =
      `${ARCHIEF}?latitude=${BREEDTE}&longitude=${LENGTE}` +
      `&start_date=${ontbreekt[0]}&end_date=${gisteren}` +
      `&daily=${DAGVELDEN}&timezone=Europe%2FAmsterdam`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo gaf ${res.status}: ${await res.text()}`);
    }
    const dag = (await res.json()).daily;
    if (!dag?.time) throw new Error("Open-Meteo gaf geen dagelijkse gegevens terug");

    const teSchrijven = dag.time
      .map((datum: string, i: number) => ({
        datum,
        temp_max: dag.temperature_2m_max?.[i] ?? null,
        temp_min: dag.temperature_2m_min?.[i] ?? null,
        neerslag_mm: dag.precipitation_sum?.[i] ?? null,
        wind_kmh: dag.windspeed_10m_max?.[i] ?? null,
        zonuren: dag.sunshine_duration?.[i] != null
          ? +(dag.sunshine_duration[i] / 3600).toFixed(1)
          : null,
        weerstype_code: dag.weathercode?.[i] ?? null,
        weerstype: wmoNaarNL(dag.weathercode?.[i] ?? null),
      }))
      // Alleen wat we misten, en alleen dagen die het archief echt al kent.
      // Een dag zonder temperatuur is aan hun kant nog niet verwerkt; die laten
      // we liggen en pakken we bij de volgende ronde vanzelf weer op.
      .filter((r: { datum: string; temp_max: number | null }) =>
        !aanwezig.has(r.datum) && r.temp_max !== null
      );

    if (teSchrijven.length === 0) {
      return antwoord(
        {
          nieuw: 0,
          gemist: ontbreekt.length,
          melding: "archief heeft deze dagen nog niet",
        },
        begonnen,
      );
    }

    const { error: schrijfFout } = await db
      .from("dagboek_dagen")
      .upsert(teSchrijven, { onConflict: "datum" });
    if (schrijfFout) throw new Error(`schrijven mislukt: ${schrijfFout.message}`);

    return antwoord({
      nieuw: teSchrijven.length,
      van: teSchrijven[0].datum,
      tot: teSchrijven[teSchrijven.length - 1].datum,
      nog_niet_beschikbaar: ontbreekt.length - teSchrijven.length,
    }, begonnen);
  } catch (fout) {
    const tekst = fout instanceof Error ? fout.message : String(fout);
    console.error("weer-verzamelen:", tekst);
    return new Response(JSON.stringify({ fout: tekst }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
