// eitje-uren
//
// POST { sleutel, modus, van?, tot?, stukken? }
//
// Haalt de gewerkte uren uit eitje op via hun API en zet ze in dezelfde
// tabellen waar de Excel-import ze ook neerzet. De Excel-route blijft naast
// deze bestaan: er gaat niets weg voordat dit bewezen heeft dat het loopt.
//
// Vier modi:
//
//   verken   Haalt alleen de medewerkerslijst op en vertelt vanaf wanneer eitje
//            gegevens heeft. Schrijft niets.
//
//   proef    Haalt één week op die hier al in de administratie staat en kijkt of
//            de nummers van eitje dezelfde zijn als de nummers uit de Excel.
//            Schrijft niets. Dit is de belangrijkste controle — zie hieronder.
//
//   periode  Haalt van..tot op in stukken van een week en schrijft weg. Stopt na
//            `stukken` weken (standaard acht) en vertelt waar hij gebleven is,
//            zodat een jaar terughalen niet op een tijdslimiet stuk loopt.
//
//   bij      Haalt op wat er de laatste twee dagen in eitje is gewijzigd. Dit is
//            wat er elke nacht draait. Correcties komen zo automatisch mee.
//
// WAAROM 'proef' BESTAAT
//
// De urenregels worden bewaard onder het nummer dat eitje eraan geeft. Dezelfde
// week twee keer ophalen overschrijft dan, in plaats van te stapelen. De Excel
// gebruikte daarvoor het "support ID", en de nummers die daaruit kwamen (zoals
// 32932404) zien eruit als dezelfde nummers die de API geeft — maar dat is een
// aanname, en ik kon hem niet nameten zonder sleutels.
//
// Klopt die aanname niet, dan komt elke dienst er een tweede keer in en
// verdubbelt elk urentotaal. Dat levert geen foutmelding op: het levert een
// twaalfmaandsgemiddelde op dat twee keer te hoog is, en dat gemiddelde gaat
// mee in een aanbod voor vaste uren dat vijf jaar opeisbaar blijft. Daarom
// wordt er niets geschreven voordat 'proef' heeft laten zien dat de nummers op
// elkaar passen.
//
// De module in ./gedeeld is een kopie van src/lib, gemaakt door
// scripts/kopieer-lezers.mjs. Niet met de hand wijzigen.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  alsKaart,
  koppelEitjeUsers,
  naarUrenrij,
  namenKaart,
  splitsInStukken,
  type ApiShift,
  type ApiUser,
  type AppKandidaat,
  type Persoonskoppeling,
} from "./gedeeld/eitjeApi.ts";
import { type Afspraak } from "./gedeeld/koppelen.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLEUTEL = Deno.env.get("ROOSTER_SLEUTEL") ?? "";

const EITJE = Deno.env.get("EITJE_URL") ?? "https://open-api.eitje.app/open_api";
const EITJE_SLEUTELS = {
  "Partner-Username": Deno.env.get("EITJE_PARTNER_USERNAME") ?? "",
  "Partner-Password": Deno.env.get("EITJE_PARTNER_PASSWORD") ?? "",
  "Api-Username": Deno.env.get("EITJE_API_USERNAME") ?? "",
  "Api-Password": Deno.env.get("EITJE_API_PASSWORD") ?? "",
};

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

/* --------------------------------------------------------------- supabase --- */

async function haal(pad: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${pad}`, { headers: h });
  if (!r.ok) throw new Error(`ophalen mislukt: ${r.status} ${await r.text()}`);
  return await r.json();
}

async function schrijf(pad: string, rijen: unknown[], extra: Record<string, string> = {}) {
  if (rijen.length === 0) return;
  const r = await fetch(`${SB_URL}/rest/v1/${pad}`, {
    method: "POST",
    headers: { ...h, Prefer: "return=minimal", ...extra },
    body: JSON.stringify(rijen),
  });
  if (!r.ok) throw new Error(`wegschrijven mislukt: ${r.status} ${await r.text()}`);
}

/* ------------------------------------------------------------------ eitje --- */

/* Eitje vraagt om ongeveer één aanvraag per seconde. Dat is geen harde limiet
   maar een verzoek, en een nieuwe koppeling die meteen staat te rammen is geen
   manier om te beginnen. */
const PAUZE_MS = 1100;
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sleutelsOntbreken(): string[] {
  return Object.entries(EITJE_SLEUTELS)
    .filter(([, waarde]) => !waarde)
    .map(([naam]) => naam);
}

async function eitjeHaal(pad: string, params: Record<string, string> = {}) {
  const url = new URL(`${EITJE}/${pad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const r = await fetch(url, { headers: EITJE_SLEUTELS });
  const tekst = await r.text();
  if (!r.ok) {
    throw new Error(`eitje gaf ${r.status} op ${pad}: ${tekst.slice(0, 300)}`);
  }
  const body = tekst ? JSON.parse(tekst) : {};
  return (body.items ?? []) as unknown[];
}

const vandaag = () => new Date().toISOString().slice(0, 10);

function schuif(datum: string, dagen: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

async function haalShifts(van: string, tot: string, opGewijzigd = false): Promise<ApiShift[]> {
  const params: Record<string, string> = {
    "filters[start_date]": van,
    "filters[end_date]": tot,
  };
  if (opGewijzigd) params["filters[date_filter_type]"] = "updated";
  return (await eitjeHaal("time_registration_shifts", params)) as ApiShift[];
}

/* ----------------------------------------------------------- wie is wie --- */

async function koppelPersonen(users: ApiUser[]): Promise<Persoonskoppeling[]> {
  const afspraken = new Map<string, Afspraak>(
    (await haal("rooster_namen?select=naam,medewerker_id,negeren")).map(
      (r: { naam: string; medewerker_id: string | null; negeren: boolean }) => [
        r.naam,
        { medewerker_id: r.medewerker_id, negeren: r.negeren },
      ],
    ),
  );
  const kandidaten: AppKandidaat[] = await haal(
    "sollicitaties?select=id,voornaam,achternaam,uit_dienst_op,email,geboortedatum,eitje_user_id" +
      "&fase=eq.medewerker&is_apparaat=eq.false",
  );
  return koppelEitjeUsers(users, kandidaten, afspraken);
}

/* Welke koppelingen stevig genoeg zijn om vast te leggen.
 *
 * Een koppeling op alleen een voornaam blijft er expres buiten. Die staat in de
 * lijst en wordt gemeld, maar wordt niet vastgeschroefd: het nummer is daarna
 * de waarheid, en een verkeerd vastgelegd nummer zet jaren uren op de verkeerde
 * persoon zonder dat iemand het ziet. */
const STEVIG = new Set([
  "e-mailadres",
  "geboortedatum",
  "volledige naam",
  "deel van de achternaam",
  "handmatig",
]);

async function legNummersVast(koppelingen: Persoonskoppeling[]): Promise<number> {
  const nieuw = koppelingen.filter((k) => k.medewerker_id && STEVIG.has(k.reden));
  for (const k of nieuw) {
    const r = await fetch(`${SB_URL}/rest/v1/sollicitaties?id=eq.${k.medewerker_id}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ eitje_user_id: k.eitje_user_id }),
    });
    if (!r.ok) throw new Error(`nummer vastleggen mislukt: ${r.status} ${await r.text()}`);
  }
  return nieuw.length;
}

/* ------------------------------------------------------------ wegschrijven --- */

async function welkeBestaan(bronIds: string[]): Promise<Set<string>> {
  const bestaand = new Set<string>();
  for (let i = 0; i < bronIds.length; i += 200) {
    const lijst = bronIds.slice(i, i + 200).map((id) => `"${id}"`).join(",");
    const rijen = await haal(`gewerkte_uren?select=bron_id&bron_id=in.(${lijst})`);
    for (const r of rijen as { bron_id: string }[]) bestaand.add(r.bron_id);
  }
  return bestaand;
}

/* De regels wegschrijven, in twee stapels.
 *
 * Regels waarvan we de medewerker niet weten gaan zonder die kolom mee. Anders
 * zou een lege waarde een koppeling overschrijven die iemand met de hand heeft
 * gelegd — en dan is dat werk weg zonder melding. PostgREST wil per aanvraag
 * dezelfde kolommen, vandaar twee stapels. */
async function schrijfUren(rijen: ReturnType<typeof naarUrenrij>[], importId: number) {
  const merge = { Prefer: "return=minimal,resolution=merge-duplicates" };
  const metPersoon = rijen
    .filter((r) => r.medewerker_id)
    .map((r) => ({ ...r, import_id: importId, bijgewerkt_op: new Date().toISOString() }));
  const zonderPersoon = rijen
    .filter((r) => !r.medewerker_id)
    .map(({ medewerker_id: _weg, ...rest }) => ({
      ...rest,
      import_id: importId,
      bijgewerkt_op: new Date().toISOString(),
    }));

  for (let i = 0; i < metPersoon.length; i += 200) {
    await schrijf("gewerkte_uren?on_conflict=bron_id", metPersoon.slice(i, i + 200), merge);
  }
  for (let i = 0; i < zonderPersoon.length; i += 200) {
    await schrijf("gewerkte_uren?on_conflict=bron_id", zonderPersoon.slice(i, i + 200), merge);
  }
}

async function logboek(regel: Record<string, unknown>): Promise<number> {
  const r = await fetch(`${SB_URL}/rest/v1/rooster_imports`, {
    method: "POST",
    headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify([{ soort: "gewerkt", door: "eitje-api", ...regel }]),
  });
  if (!r.ok) throw new Error(`logboek mislukt: ${r.status} ${await r.text()}`);
  const [rij] = await r.json();
  return rij.id as number;
}

/* ------------------------------------------------------------------- doen --- */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { sleutel, modus = "bij", van, tot, stukken = 8 } = body ?? {};

    if (!SLEUTEL || sleutel !== SLEUTEL) {
      return json({ ok: false, error: "sleutel klopt niet" }, 401);
    }

    const mist = sleutelsOntbreken();
    if (mist.length > 0) {
      return json(
        {
          ok: false,
          error:
            `De sleutels van eitje staan er nog niet: ${mist.join(", ")}. ` +
            "Zet ze in Supabase bij de serverfuncties onder Secrets.",
        },
        503,
      );
    }

    /* Altijd eerst de medewerkerslijst: die geeft het vaste nummer per persoon,
       en zonder dat nummer is er niets om uren aan te hangen. Eén aanvraag. */
    const users = (await eitjeHaal("users")) as ApiUser[];
    const koppelingen = await koppelPersonen(users);
    const open = koppelingen.filter((k) => !k.medewerker_id);

    /* ---- verken: alleen vertellen wat er is ---- */
    if (modus === "verken") {
      const gemaakt = users
        .map((u) => (u as ApiUser & { created_at?: string }).created_at)
        .filter((d): d is string => Boolean(d))
        .sort();
      return json({
        ok: true,
        modus,
        medewerkers_in_eitje: users.length,
        gekoppeld: koppelingen.length - open.length,
        /* Het oudste medewerker-record is de ondergrens van wat eitje kan
           hebben: eerder dan de eerste medewerker zijn er geen uren. Of er
           daarvoor nog mensen zijn verwijderd weet deze kant niet. */
        oudste_medewerker_vanaf: gemaakt[0]?.slice(0, 10) ?? null,
        niet_gekoppeld: open.map((k) => ({ naam: k.naam, reden: k.reden })),
        koppelingen: koppelingen.map((k) => ({ naam: k.naam, reden: k.reden })),
      });
    }

    /* ---- proef: passen de nummers op elkaar? ---- */
    if (modus === "proef") {
      const laatste = await haal(
        "gewerkte_uren?select=datum&order=datum.desc&limit=1&eitje_user_id=is.null",
      );
      const peildag = van ?? (laatste as { datum: string }[])[0]?.datum ?? null;
      if (!peildag) {
        return json({
          ok: true,
          modus,
          uitkomst: "niets om mee te vergelijken",
          uitleg:
            "Er staan nog geen urenregels uit de Excel-import, dus er is geen " +
            "oude nummering om tegenaan te houden. Dan kan de koppeling gewoon " +
            "beginnen; dubbele regels kunnen niet ontstaan.",
        });
      }

      const weekVan = schuif(peildag, -6);
      const shifts = await haalShifts(weekVan, peildag);
      const ids = shifts.map((s) => String(s.id));
      const bestaand = await welkeBestaan(ids);
      const alHier = await haal(
        `gewerkte_uren?select=bron_id&datum=gte.${weekVan}&datum=lte.${peildag}`,
      );

      const passen = bestaand.size;
      const uitkomst =
        shifts.length === 0
          ? "eitje heeft geen uren in deze week"
          : (alHier as unknown[]).length === 0
            ? "deze week staat hier nog niet, dus niets om te vergelijken"
            : passen > 0
              ? "dezelfde nummering — veilig"
              : "ANDERE NUMMERING — niet wegschrijven";

      return json({
        ok: true,
        modus,
        week: { van: weekVan, tot: peildag },
        uit_eitje: shifts.length,
        staat_hier_al: (alHier as unknown[]).length,
        nummers_die_passen: passen,
        uitkomst,
        uitleg:
          passen > 0
            ? "De nummers van de API zijn dezelfde als die uit de Excel. Dezelfde " +
              "week opnieuw ophalen overschrijft dus, en stapelt niet."
            : "Geen enkel nummer uit de API komt overeen met wat hier staat. Zou er " +
              "nu weggeschreven worden, dan komt elke dienst er een tweede keer in " +
              "en verdubbelt elk urentotaal. Eerst uitzoeken, niet importeren.",
        niet_gekoppeld: open.map((k) => ({ naam: k.naam, reden: k.reden })),
      });
    }

    /* ---- periode en bij: ophalen en wegschrijven ---- */
    const namen = namenKaart(users);
    const kaart = alsKaart(koppelingen);
    const vastgelegd = await legNummersVast(koppelingen);

    const opGewijzigd = modus === "bij";
    const reeks = opGewijzigd
      ? [{ van: schuif(vandaag(), -2), tot: vandaag() }]
      : splitsInStukken(van ?? schuif(vandaag(), -6), tot ?? vandaag());

    if (reeks.length === 0) {
      return json({ ok: false, error: "die periode bestaat niet" }, 400);
    }

    const tedoen = reeks.slice(0, Math.max(1, Math.min(60, Number(stukken) || 8)));
    const alles: ApiShift[] = [];
    for (let i = 0; i < tedoen.length; i++) {
      if (i > 0) await wacht(PAUZE_MS);
      const stuk = tedoen[i];
      alles.push(...(await haalShifts(stuk.van, stuk.tot, opGewijzigd)));
    }

    /* Eitje kan dezelfde dienst in twee stukken teruggeven wanneer er op
       gewijzigd gefilterd wordt. Het laatste exemplaar wint; wegschrijven zou
       anders op zichzelf botsen binnen één aanvraag. */
    const perId = new Map<string, ApiShift>();
    for (const s of alles) perId.set(String(s.id), s);
    const rijen = [...perId.values()].map((s) => naarUrenrij(s, namen, kaart));

    const bestaand = await welkeBestaan(rijen.map((r) => r.bron_id));
    const nieuw = rijen.filter((r) => !bestaand.has(r.bron_id)).length;

    const dagen = rijen.map((r) => r.datum).sort();
    const importId = await logboek({
      periode_van: opGewijzigd ? (dagen[0] ?? null) : tedoen[0].van,
      periode_tot: opGewijzigd ? (dagen[dagen.length - 1] ?? null) : tedoen[tedoen.length - 1].tot,
      geexporteerd_op: new Date().toISOString(),
      aantal_regels: rijen.length,
      aantal_nieuw: nieuw,
      aantal_gewijzigd: rijen.length - nieuw,
    });

    /* Het logboek staat er nu, de regels nog niet. Lukt het wegschrijven niet,
       dan haalt die logregel weg: hij zegt namelijk dat deze weken zijn
       ingelezen, en dat is precies waarop het twaalfmaandsgemiddelde zijn
       dekking baseert. Een logregel zonder uren eronder laat weken als "wel
       ingelezen, niet gewerkt" meetellen, en dan komt het gemiddelde te laag
       uit. */
    try {
      await schrijfUren(rijen, importId);
    } catch (e) {
      await fetch(`${SB_URL}/rest/v1/rooster_imports?id=eq.${importId}`, {
        method: "DELETE",
        headers: { ...h, Prefer: "return=minimal" },
      }).catch(() => {});
      throw e;
    }

    const rest = reeks.slice(tedoen.length);
    return json({
      ok: true,
      modus,
      periode: { van: tedoen[0].van, tot: tedoen[tedoen.length - 1].tot },
      weken: tedoen.length,
      regels: rijen.length,
      nieuw,
      bijgewerkt: rijen.length - nieuw,
      nummers_vastgelegd: vastgelegd,
      import_id: importId,
      /* Niet alles in één keer: een jaar is drieënvijftig aanvragen met een
         seconde ertussen, en dan loopt de functie op zijn tijdslimiet. Dit is
         waar hij gebleven is. */
      volgende: rest.length > 0 ? rest[0].van : null,
      nog_te_gaan: rest.length,
      niet_gekoppeld: open.map((k) => ({ naam: k.naam, reden: k.reden })),
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message ?? e) }, 500);
  }
});
