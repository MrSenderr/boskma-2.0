// eitje-uren
//
// POST { modus, van?, tot?, stukken?, sleutel? }
//
// Te starten door een ingelogde beheerder in de app, of door de nachtelijke
// taak met de sleutel uit ROOSTER_SLEUTEL.
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
  naarBeschikbaarheid,
  naarVerlof,
  naarZiek,
  splitsInStukken,
  type ApiBeschikbaarheid,
  type ApiShift,
  type ApiUser,
  type AppKandidaat,
  type ApiVerlof,
  type ApiZiek,
  type Persoonskoppeling,
} from "./gedeeld/eitjeApi.ts";
import { type Afspraak } from "./gedeeld/koppelen.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLEUTEL = Deno.env.get("ROOSTER_SLEUTEL") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

/* Of de beller een ingelogde app-gebruiker is.
 *
 * verify_jwt laat ook de publieke anon-sleutel door. Die staat in de
 * app-bundel en is dus van iedereen; hij zegt niets over wie je bent. Daarom
 * hier dezelfde vraag die de database bij elke tabel stelt: is_app_user(). Die
 * draait met de inlog van de beller, niet met die van de serverfunctie. */
async function isAppGebruiker(auth: string | null): Promise<boolean> {
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_app_user`, {
      method: "POST",
      headers: {
        apikey: SB_ANON || auth.slice(7),
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
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

async function verwijder(pad: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${pad}`, {
    method: "DELETE",
    headers: { ...h, Prefer: "return=minimal" },
  });
  if (!r.ok) throw new Error(`opruimen mislukt: ${r.status} ${await r.text()}`);
}

/* ------------------------------------------------------------------ eitje --- */

/* Eitje vraagt om ongeveer één aanvraag per seconde. Dat is geen harde limiet
   maar een verzoek, en een nieuwe koppeling die meteen staat te rammen is geen
   manier om te beginnen. */
const PAUZE_MS = 1100;
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Hoeveel dagen "bijwerken" terugkijkt.
 *
 * Eitje telt dagen inclusief: eergisteren tot en met vandaag zijn er bij hen
 * drie, niet twee. En bij filteren op gewijzigd ligt de grens op twee. Dit
 * stond eerst op drie dagen en viel daarop om met "the maximum amount of days
 * is 2. You requested 3 days".
 *
 * Twee dagen is genoeg voor een taak die elke nacht draait: slaat hij één
 * nacht over, dan valt die nacht nog binnen het venster van de volgende. Mist
 * hij er meer, dan haal je dat gat op met "Uren terughalen". */
const BIJ_DAGEN = 2;

/* Hoe ver vooruit "wie kan er" wordt opgehaald.
 *
 * Zeven weken voor beschikbaarheid, en dat getal komt uit de instellingen van
 * eitje zelf: Boskma maakt roosters van vier weken, twee weken van tevoren, op
 * dinsdag. Het blok dat op een dinsdag dichtgaat loopt dus van ongeveer dertien
 * tot veertig dagen vooruit. Haal je vier weken op, dan heb je precies de weken
 * die al gepland zíjn en niet die je aan het plannen bent.
 *
 * Verlof kijkt een half jaar vooruit. Dat kost bijna niets — eitje geeft er
 * negentig dagen per aanvraag van, tegen zeven voor beschikbaarheid — en een
 * zomervakantie die in maart wordt aangevraagd wil je in juni niet hoeven
 * ontdekken.
 *
 * Ziekte kijkt even ver als beschikbaarheid: verder vooruit ziek zijn bestaat
 * niet. Een melding die nu nog loopt komt sowieso mee, want eitje geeft lopende
 * periodes terug ook als je een latere week opvraagt. */
const VOORUIT_DAGEN = 49;
const VERLOF_DAGEN = 180;

/* Wat eitje per aanvraag aankan, in dagen en inclusief geteld. Staat niet in
   één tabel in hun documentatie maar per endpoint verspreid, en eraan voorbij
   gaan levert een 400 op met de grens erin. */
const VENSTER = { beschikbaar: 7, verlof: 90, ziek: 30 };

function sleutelsOntbreken(): string[] {
  return Object.entries(EITJE_SLEUTELS)
    .filter(([, waarde]) => !waarde)
    .map(([naam]) => naam);
}

/* Een lijst ophalen bij eitje.
 *
 * `optioneel` maakt van een 404 geen fout maar een `null`. Niet elke endpoint
 * is voor elke klant vrijgegeven: ziekmeldingen gaven 404 op onze sleutels
 * terwijl het pad gewoon in hun documentatie staat. Zonder dit onderscheid
 * sleept zo'n endpoint de hele ronde mee de afgrond in, en komt ook de
 * beschikbaarheid die wél binnenkwam niet in de administratie.
 *
 * Alleen 404. Een 400 blijft een fout — dat is een verkeerde vraag van ons,
 * en die hoor je te zien en op te lossen, niet weg te slikken. */
async function eitjeHaal(
  pad: string,
  params: Record<string, string> = {},
  optioneel = false,
): Promise<unknown[] | null> {
  const url = new URL(`${EITJE}/${pad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const r = await fetch(url, { headers: EITJE_SLEUTELS });
  const tekst = await r.text();
  if (r.status === 404 && optioneel) return null;
  if (!r.ok) {
    throw new Error(`eitje gaf ${r.status} op ${pad}: ${tekst.slice(0, 300)}`);
  }
  const body = tekst ? JSON.parse(tekst) : {};
  return (body.items ?? []) as unknown[];
}

/* Iets wegschrijven bij eitje.
 *
 * Tot nu toe werd er alleen gelezen. Schrijven is een ander soort handeling:
 * wat hier misgaat staat bij het personeel op het scherm. Daarom geen stille
 * fouten — elke mislukte aanvraag geeft de melding van eitje zelf terug, want
 * "het lukte niet" is geen bericht waar iemand iets mee kan. */
async function eitjeStuur(
  pad: string,
  methode: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${EITJE}/${pad}`, {
    method: methode,
    headers: { ...EITJE_SLEUTELS, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const tekst = await r.text();
  if (!r.ok) {
    throw new Error(`eitje gaf ${r.status} op ${methode} ${pad}: ${tekst.slice(0, 300)}`);
  }
  return tekst ? (JSON.parse(tekst).item ?? null) : null;
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
  return ((await eitjeHaal("time_registration_shifts", params)) ?? []) as ApiShift[];
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

/* ------------------------------------------------------- wie er kan --- */

/* Beschikbaarheid, verlof en ziekte ophalen voor de weken die nog komen.
 *
 * Alleen vooruit. Of iemand vorige maand verlof had verandert niets meer aan
 * een rooster dat al gedraaid is; wat telt is wie er volgende week kan.
 *
 * Opruimen gaat op tijdstip en niet op lijst. Alles wat eitje teruggaf is
 * zojuist aangeraakt, dus wat in dit venster nog een ouder tijdstip draagt is
 * ingetrokken of verwijderd. Dat scheelt een URL met honderden nummers erin,
 * en het is bestand tegen een aanvraag die halverwege afbreekt: dan blijft het
 * oude gewoon staan. */
async function haalWieKan(
  vanaf: string,
  dagen: number,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }>,
  kaart: Map<number, string | null>,
) {
  const tot = schuif(vanaf, Math.max(1, dagen));
  const verlofTot = schuif(vanaf, Math.max(1, dagen, VERLOF_DAGEN));
  const begonnen = new Date().toISOString();
  let aanvragen = 0;

  /* Geeft `null` terug als eitje deze endpoint niet kent. Dat is iets anders
     dan een lege lijst: bij leeg mag er opgeruimd worden, bij onbekend niet —
     wat je niet hebt nagekeken hoor je niet weg te gooien. */
  const stuksgewijs = async (pad: string, grens: number, eind: string) => {
    const uit: unknown[] = [];
    for (const stuk of splitsInStukken(vanaf, eind, grens)) {
      if (aanvragen > 0) await wacht(PAUZE_MS);
      aanvragen++;
      const deel = await eitjeHaal(
        pad,
        { "filters[start_date]": stuk.van, "filters[end_date]": stuk.tot },
        true,
      );
      if (deel === null) return null;
      uit.push(...deel);
    }
    return uit;
  };

  const opgaven = (await stuksgewijs(
    "availability_shifts",
    VENSTER.beschikbaar,
    tot,
  )) as ApiBeschikbaarheid[] | null;
  const verlof = (await stuksgewijs(
    "leave_requests",
    VENSTER.verlof,
    verlofTot,
  )) as ApiVerlof[] | null;
  const ziek = (await stuksgewijs("sick_periods", VENSTER.ziek, tot)) as ApiZiek[] | null;

  const ontbreekt = [
    opgaven === null ? "beschikbaarheid" : null,
    verlof === null ? "verlof" : null,
    ziek === null ? "ziekmeldingen" : null,
  ].filter(Boolean) as string[];

  /* Overlappende stukken kunnen dezelfde regel twee keer geven. Het laatste
     exemplaar wint; wegschrijven zou anders op zichzelf botsen. */
  const uniek = <T extends { bron_id: string }>(rijen: T[]) => [
    ...new Map(rijen.map((r) => [r.bron_id, r])).values(),
  ];

  const beschikbaar = uniek((opgaven ?? []).map((b) => naarBeschikbaarheid(b, namen, kaart)));
  const afwezig = uniek([
    ...(verlof ?? []).map((v) => naarVerlof(v, namen, kaart)),
    ...(ziek ?? []).map((z) => naarZiek(z, namen, kaart)),
  ]);

  const merge = { Prefer: "return=minimal,resolution=merge-duplicates" };
  const stempel = <T,>(rijen: T[]) => rijen.map((r) => ({ ...r, bijgewerkt_op: begonnen }));

  for (let i = 0; i < beschikbaar.length; i += 200) {
    await schrijf("beschikbaarheid?on_conflict=bron_id", stempel(beschikbaar.slice(i, i + 200)), merge);
  }
  for (let i = 0; i < afwezig.length; i += 200) {
    await schrijf("afwezigheid?on_conflict=bron_id", stempel(afwezig.slice(i, i + 200)), merge);
  }

  /* Wat niet is teruggekomen is ingetrokken. Bij afwezigheid alleen wat in dit
     venster begint: een ziekmelding van vorige maand die nog loopt hoort niet
     te verdwijnen omdat zijn begindag buiten het venster valt. */
  if (opgaven !== null) {
    await verwijder(
      `beschikbaarheid?datum=gte.${vanaf}&datum=lte.${tot}&bijgewerkt_op=lt.${begonnen}`,
    );
  }
  /* Verlof is verder vooruit opgehaald dan ziekte, dus mag er ook verder
     vooruit opgeruimd worden. Ziekte buiten het korte venster laten we met
     rust: daar hebben we deze ronde niet naar gekeken, en wat je niet hebt
     nagekeken hoor je niet weg te gooien. Datzelfde geldt voor een endpoint
     die eitje helemaal niet kent — dan blijft staan wat er stond. */
  if (verlof !== null) {
    await verwijder(
      `afwezigheid?soort=eq.verlof&van=gte.${vanaf}&van=lte.${verlofTot}&bijgewerkt_op=lt.${begonnen}`,
    );
  }
  if (ziek !== null) {
    await verwijder(
      `afwezigheid?soort=eq.ziek&van=gte.${vanaf}&van=lte.${tot}&bijgewerkt_op=lt.${begonnen}`,
    );
  }

  return {
    van: vanaf,
    tot,
    verlof_tot: verlofTot,
    aanvragen,
    beschikbaarheid: beschikbaar.length,
    niet_beschikbaar: beschikbaar.filter((b) => b.status === "unavailable").length,
    verlof: afwezig.filter((a) => a.soort === "verlof").length,
    ziek: afwezig.filter((a) => a.soort === "ziek").length,
    /* Wat eitje niet kent. Staat er expres bij in plaats van stil te blijven:
       een lege lijst omdat niemand ziek is, en een lege lijst omdat we het niet
       mogen vragen, zien er op het scherm hetzelfde uit. */
    ...(ontbreekt.length > 0 ? { niet_opgehaald: ontbreekt } : {}),
  };
}

/* --------------------------------------------------- rooster wegschrijven --- */

/* Een conceptrooster in eitje zetten.
 *
 * Ongepubliceerd. In de documentatie van eitje staat dat ongepubliceerde
 * diensten alleen voor beheerders zichtbaar zijn, dus Sander kijkt het daar na
 * en geeft het zelf vrij. Een rooster dat meteen bij het personeel op het
 * scherm staat is geen voorstel maar een mededeling.
 *
 * **Eerst weghalen, dan schrijven.** Een voorstel wijzigt: iemand meldt zich
 * ziek, er wordt geschoven, je draait het opnieuw. Zou er dan een tweede
 * rooster bijkomen in plaats van eroverheen, dan staat alles dubbel in eitje en
 * mag iemand dat met de hand uit elkaar halen. Daarom houdt `eitje_concept`
 * bij welke diensten de app heeft aangemaakt, en worden precies die eerst
 * verwijderd — een dienst die in eitje met de hand is gezet staat daar niet in
 * en wordt nooit aangeraakt.
 *
 * Per week één aanvraag vanuit de app. Een blok van vier weken is ruim
 * honderd diensten, en die passen met een seconde pauze ertussen niet binnen
 * de tijdslimiet van één serverfunctie. */
async function schrijfRooster(
  van: string,
  tot: string,
  diensten: {
    datum: string;
    begint: string;
    eindigt: string;
    medewerker_id: string | null;
  }[],
  teamId: number,
) {
  // 1. opruimen wat de app hier eerder neerzette
  const eerder: { bron_id: string }[] = await haal(
    `eitje_concept?select=bron_id&datum=gte.${van}&datum=lte.${tot}`,
  );
  let weggehaald = 0;
  for (const rij of eerder) {
    if (weggehaald > 0) await wacht(PAUZE_MS);
    try {
      await eitjeStuur(`planning_shifts/${rij.bron_id}`, "DELETE");
    } catch (e) {
      /* Al weg in eitje, of met de hand omgezet in gewerkte uren. Dat is geen
         reden om te stoppen: de bedoeling was dat hij weg was. */
      if (!String((e as Error).message).includes("404")) throw e;
    }
    weggehaald++;
  }
  if (eerder.length > 0) {
    await verwijder(`eitje_concept?datum=gte.${van}&datum=lte.${tot}`);
  }

  // 2. wie is wie
  const mensen: { id: string; eitje_user_id: number | null }[] = await haal(
    "sollicitaties?select=id,eitje_user_id&fase=eq.medewerker&is_apparaat=eq.false",
  );
  const nummers = new Map(mensen.map((m) => [m.id, m.eitje_user_id]));

  // 3. wegschrijven
  const gemaakt: Record<string, unknown>[] = [];
  let zonderNaam = 0;
  for (const d of diensten) {
    await wacht(PAUZE_MS);
    const userId = d.medewerker_id ? nummers.get(d.medewerker_id) ?? null : null;
    if (d.medewerker_id && !userId) zonderNaam++;

    const item = await eitjeStuur("planning_shifts", "POST", {
      /* Zonder zone, zoals in hun eigen voorbeeld. Eitje staat in Nederland en
         de klok in het sjabloon is de klok aan de muur; een zone meesturen zou
         die juist verschuiven. */
      start: `${d.datum}T${d.begint}`,
      end: `${d.datum}T${d.eindigt}`,
      team_id: teamId,
      ...(userId ? { user_id: userId } : {}),
      published: false,
    });
    if (!item) continue;

    gemaakt.push({
      bron_id: String(item.id),
      datum: d.datum,
      begint: d.begint,
      eindigt: d.eindigt,
      medewerker_id: d.medewerker_id,
      eitje_user_id: userId,
    });
  }

  for (let i = 0; i < gemaakt.length; i += 200) {
    await schrijf("eitje_concept", gemaakt.slice(i, i + 200));
  }

  return {
    van,
    tot,
    weggehaald,
    geschreven: gemaakt.length,
    /* Diensten die aan een persoon hingen die in eitje niet bekend is. Die
       staan er nu als open dienst, en dat hoor je te weten. */
    zonder_naam: zonderNaam,
  };
}

/* ------------------------------------------------------------------- doen --- */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { sleutel, modus = "bij", van, tot, stukken = 8, dagen, diensten, team_id } =
      body ?? {};

    /* Wie mag wat.
     *
     * Een beheerder in de app mag alles: hij stuurt zijn eigen inlog mee. De
     * oude gedeelde sleutel ook, want die hoort al bij de roosteradministratie.
     *
     * De nachtelijke taak heeft geen van beide. Die draait in de database en
     * meldt zich met de publieke sleutel, en die staat in de app-bundel — dus
     * van iedereen. Daarom mag zo'n beller maar drie dingen niet: iets anders
     * dan bijwerken, vaker dan één keer per uur, en namen terugkrijgen.
     *
     * Het uurslot is er omdat elke oproep twee aanvragen bij eitje kost. Zonder
     * dat slot zou iemand met de publieke sleutel eitje kunnen laten rammen met
     * onze koppeling, en dan is het onze toegang die eraan gaat. */
    const beheerder =
      (Boolean(SLEUTEL) && sleutel === SLEUTEL) ||
      (await isAppGebruiker(req.headers.get("Authorization")));

    let zonderNamen = false;
    if (!beheerder) {
      if (modus !== "bij") return json({ ok: false, error: "geen toegang" }, 401);

      const eenUurTerug = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const kortgeleden = await haal(
        `rooster_imports?select=op&door=eq.eitje-api&op=gte.${eenUurTerug}&limit=1`,
      );
      if ((kortgeleden as unknown[]).length > 0) {
        /* Geen fout: er is net al bijgewerkt. Een taak die hierop afknapt zou
           elke nacht als kapot in het logboek staan terwijl er niets aan de
           hand is. */
        return json({ ok: true, modus, overgeslagen: "minder dan een uur geleden al bijgewerkt" });
      }
      zonderNamen = true;
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
    const users = ((await eitjeHaal("users")) ?? []) as ApiUser[];
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
          /* Geen oude regels betekent dat er niets te verdubbelen valt. */
          veilig: true,
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
      /* Alleen groen licht als er daadwerkelijk nummers op elkaar passen.
         Kon er niets vergeleken worden, dan is dat geen bewijs maar een
         onbekende, en een onbekende is hier geen groen licht. */
      const veilig = passen > 0;
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
        veilig,
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

    /* ---- rooster: een concept in eitje zetten ---- */
    if (modus === "rooster") {
      if (!van || !tot || !Array.isArray(diensten)) {
        return json({ ok: false, error: "geef van, tot en diensten mee" }, 400);
      }

      /* Een dienst moet bij een team horen; dat eist eitje. Meestal is er maar
         één en dan hoeft er niets gekozen te worden. Zijn er meer, dan noemt de
         melding ze bij naam in plaats van dat de app er een gokt. */
      const teams = ((await eitjeHaal("teams")) ?? []) as { id: number; name?: string }[];
      const gekozen = team_id
        ? teams.find((t) => t.id === Number(team_id))
        : teams.length === 1
          ? teams[0]
          : undefined;

      if (!gekozen) {
        return json(
          {
            ok: false,
            error:
              teams.length === 0
                ? "eitje geeft geen teams terug; zonder team kan een dienst niet worden aangemaakt"
                : `Er zijn meerdere teams in eitje. Stuur team_id mee: ${teams
                    .map((t) => `${t.name ?? "naamloos"} (${t.id})`)
                    .join(", ")}`,
            teams: teams.map((t) => ({ id: t.id, naam: t.name ?? null })),
          },
          400,
        );
      }

      return json({
        ok: true,
        modus,
        team: { id: gekozen.id, naam: gekozen.name ?? null },
        ...(await schrijfRooster(van, tot, diensten, gekozen.id)),
      });
    }

    /* ---- wiekan: beschikbaarheid, verlof en ziekte ---- */
    const vooruit = () =>
      haalWieKan(van ?? vandaag(), Number(dagen) || VOORUIT_DAGEN, namen, kaart);

    if (modus === "wiekan") {
      return json({
        ok: true,
        modus,
        nummers_vastgelegd: vastgelegd,
        ...(await vooruit()),
        ...(zonderNamen
          ? { niet_gekoppeld_aantal: open.length }
          : { niet_gekoppeld: open.map((k) => ({ naam: k.naam, reden: k.reden })) }),
      });
    }

    const opGewijzigd = modus === "bij";
    const reeks = opGewijzigd
      ? [{ van: schuif(vandaag(), -(BIJ_DAGEN - 1)), tot: vandaag() }]
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

    /* Niet `dagen`: die naam is nu de parameter waarmee je instelt hoe ver
       vooruit er gekeken wordt. Twee keer dezelfde naam in dezelfde scope is
       geen waarschuwing maar een fout, en dan start de hele functie niet. */
    const dagenMetUren = rijen.map((r) => r.datum).sort();
    const importId = await logboek({
      periode_van: opGewijzigd ? (dagenMetUren[0] ?? null) : tedoen[0].van,
      periode_tot: opGewijzigd
        ? (dagenMetUren[dagenMetUren.length - 1] ?? null)
        : tedoen[tedoen.length - 1].tot,
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

    /* De nachtelijke taak doet allebei: de uren van gisteren ophalen en
       vooruitkijken wie er de komende weken kan. Twee taken naast elkaar zou
       betekenen dat er twee dingen stil kunnen vallen in plaats van één. */
    const wiekan = opGewijzigd ? await vooruit() : null;

    const rest = reeks.slice(tedoen.length);
    return json({
      ok: true,
      modus,
      ...(wiekan ? { wiekan } : {}),
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
      // Namen alleen voor wie is ingelogd; zie "Wie mag wat" hierboven.
      ...(zonderNamen
        ? { niet_gekoppeld_aantal: open.length }
        : { niet_gekoppeld: open.map((k) => ({ naam: k.naam, reden: k.reden })) }),
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message ?? e) }, 500);
  }
});
