// rooster-inlezen
//
// POST { sleutel, bestandsnaam, inhoud (base64 van een xlsx) }
//
// Neemt een eitje-export aan die per mail binnenkwam en zet hem in de
// administratie. Het script in Sanders Google-account stuurt hem door; deze
// functie leest hem uit en schrijft weg.
//
// Hetzelfde als wanneer je het bestand met de hand in Rooster → Importeren
// sleept, met twee verschillen:
//
//   - Er is niemand om iets te vragen. Een naam die we niet kennen krijgt geen
//     medewerker toegewezen; de regel komt er wel in en wordt gemeld. Dat is
//     beter dan de hele week laten vallen om één onbekende naam.
//   - Het wordt gelogd in rooster_imports met door = 'eitje'. Zo zie je op het
//     importeerscherm of dit nog loopt. Stilte is anders niet te zien.
//
// De uitlezers in ./gedeeld zijn kopieën van src/lib, gemaakt door
// scripts/kopieer-lezers.mjs. Niet met de hand wijzigen.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { leesWerkboek } from "./gedeeld/xlsx-lezen.ts";
import { leesEitje } from "./gedeeld/eitje.ts";
import { koppel, naamSleutel, type Afspraak, type Kandidaat } from "./gedeeld/koppelen.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLEUTEL = Deno.env.get("ROOSTER_SLEUTEL") ?? "";

const isJwt = SB_SERVICE.split(".").length === 3;
const h: Record<string, string> = {
  apikey: SB_SERVICE,
  "Content-Type": "application/json",
  ...(isJwt ? { Authorization: `Bearer ${SB_SERVICE}` } : {}),
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

async function haal(pad: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${pad}`, { headers: h });
  if (!r.ok) throw new Error(`ophalen mislukt: ${r.status} ${await r.text()}`);
  return await r.json();
}

/** base64 naar bytes, in stukken: een jaar aan shifts is zo een megabyte. */
function uitBase64(tekst: string): ArrayBuffer {
  const schoon = tekst.replace(/\s+/g, "");
  const ruw = atob(schoon);
  const bytes = new Uint8Array(ruw.length);
  for (let i = 0; i < ruw.length; i++) bytes[i] = ruw.charCodeAt(i);
  return bytes.buffer;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    const { sleutel, bestandsnaam, inhoud } = await req.json();

    // Zonder sleutel kan iedereen die het adres kent rijen in je rooster zetten.
    if (!SLEUTEL || sleutel !== SLEUTEL) return json({ ok: false, error: "sleutel klopt niet" }, 401);
    if (!inhoud) return json({ ok: false, error: "geen bestand meegestuurd" }, 400);

    const bestand = leesEitje(await leesWerkboek(uitBase64(inhoud)));
    if (bestand.regels.length === 0) {
      return json({ ok: false, error: "in dit bestand staan geen shifts" }, 400);
    }
    const tabel = bestand.soort === "planning" ? "geplande_shifts" : "gewerkte_uren";

    /* Namen aan mensen koppelen met precies dezelfde module als het scherm.
       Een platte vergelijking werkt niet: in rooster_namen staat de naam
       genormaliseerd ("sander boskma"), en eitje schrijft "Ilona Swagerman"
       waar wij "Swagerman-Honselaar" hebben staan. */
    const afspraken = new Map<string, Afspraak>(
      (await haal("rooster_namen?select=naam,medewerker_id,negeren")).map(
        (r: { naam: string; medewerker_id: string | null; negeren: boolean }) => [
          r.naam,
          { medewerker_id: r.medewerker_id, negeren: r.negeren },
        ],
      ),
    );
    const kandidaten: Kandidaat[] = await haal(
      "sollicitaties?select=id,voornaam,achternaam,uit_dienst_op&fase=eq.medewerker&is_apparaat=eq.false",
    );

    // Welke van deze shifts stonden er al? Daarmee kan het logboek tenminste
    // zeggen hoeveel er nieuw zijn; of de rest ook echt veranderd is weten we
    // niet, en dat laten we dan ook leeg.
    const bronIds = bestand.regels.map((r) => r.bron_id);
    const bestaand = new Set<string>();
    for (let i = 0; i < bronIds.length; i += 200) {
      const lijst = bronIds.slice(i, i + 200).map((id) => `"${id}"`).join(",");
      const rijen = await haal(`${tabel}?select=bron_id&bron_id=in.(${lijst})`);
      for (const r of rijen as { bron_id: string }[]) bestaand.add(r.bron_id);
    }

    const onbekend = new Set<string>();
    const rijen = bestand.regels.map((regel) => {
      const gevonden = koppel(
        { voornaam: regel.voornaam, achternaam: regel.achternaam },
        kandidaten,
        afspraken,
      );
      // Een open dienst heeft geen naam, en een genegeerde naam is met opzet
      // niet gekoppeld. Alleen wat we echt niet thuis kunnen brengen melden we.
      if (gevonden.reden === "onbekend" || gevonden.reden === "meerdere") {
        onbekend.add(naamSleutel(regel.voornaam, regel.achternaam));
      }
      return {
        bron_id: regel.bron_id,
        datum: regel.datum,
        voornaam: regel.voornaam,
        achternaam: regel.achternaam,
        medewerker_id: gevonden.medewerker_id,
        begint: regel.begint,
        eindigt: regel.eindigt,
        minuten: regel.minuten,
        bijgewerkt_op: new Date().toISOString(),
        ...(bestand.soort === "planning"
          ? { team: regel.team }
          : {
              pauze_minuten: regel.pauze_minuten,
              soort: regel.soort,
              maaltijden: regel.maaltijden,
            }),
      };
    });

    // Eerst het logboek, dan de regels: gaat het schrijven mis, dan staat er in
    // elk geval dat er iets binnenkwam en wanneer.
    const logRes = await fetch(`${SB_URL}/rest/v1/rooster_imports`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({
        soort: bestand.soort,
        bestandsnaam: bestandsnaam ?? "per mail",
        export_nummer: bestand.exportNummer,
        geexporteerd_op: bestand.geexporteerdOp,
        periode_van: bestand.periode?.van ?? null,
        periode_tot: bestand.periode?.tot ?? null,
        aantal_regels: rijen.length,
        aantal_nieuw: bronIds.filter((id) => !bestaand.has(id)).length,
        aantal_gewijzigd: null,
        door: "eitje",
      }),
    });
    if (!logRes.ok) throw new Error(`logboek mislukt: ${await logRes.text()}`);
    const importId = (await logRes.json())?.[0]?.id ?? null;

    for (let i = 0; i < rijen.length; i += 500) {
      const deel = rijen.slice(i, i + 500).map((r) => ({ ...r, import_id: importId }));
      const r = await fetch(`${SB_URL}/rest/v1/${tabel}?on_conflict=bron_id`, {
        method: "POST",
        headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(deel),
      });
      if (!r.ok) throw new Error(`wegschrijven mislukt: ${r.status} ${await r.text()}`);
    }

    return json({
      ok: true,
      soort: bestand.soort,
      aantal: rijen.length,
      periode: bestand.periode,
      onbekendeNamen: [...onbekend],
    });
  } catch (err) {
    const reden = err instanceof Error ? err.message : String(err);
    console.error("[rooster-inlezen]", reden);
    return json({ ok: false, error: "inlezen mislukt", reden }, 500);
  }
});
