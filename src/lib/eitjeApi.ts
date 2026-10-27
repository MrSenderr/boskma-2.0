/* Wat er uit de API van eitje komt, omgezet naar wat de administratie bewaart.
 *
 * Hier zit geen netwerk in en geen database: alleen het omrekenen. Dat is met
 * opzet, want dit is de plek waar het stil fout gaat. Een urenregel die
 * binnenkomt maar voor nul meetelt, levert geen foutmelding op — die levert een
 * twaalfmaandsgemiddelde op dat te laag is, en dat gemiddelde belandt in een
 * aanbod voor vaste uren dat vijf jaar opeisbaar blijft (art. 7:628a BW).
 *
 * Drie dingen die daarom precies zo moeten:
 *
 * **De soort.** De API noemt het `gewerkte_uren`, met een liggend streepje. In
 * de database staat `gewerkte uren`, met een spatie, en de regel die bepaalt
 * wat als verloond meetelt kijkt naar die spatie-versie (zie
 * `VERLOOND` in gewerkteUren.ts). Eén op één overnemen laat de uren binnenkomen
 * en voor nul meetellen.
 *
 * **De klok.** De API geeft volledige tijdstippen met de zone erbij
 * ("2026-10-22T17:00:00+02:00"). De database bewaart de klok zoals hij in de
 * zaak aan de muur hing: 17:00. Zou je die tijdstippen door een datumfunctie
 * halen op een server die in UTC staat — en dat doen de serverfuncties — dan
 * komt er 15:00 uit en staat het hele rooster twee uur verschoven. Daarom
 * wordt de klok letterlijk uit de tekst gelezen.
 *
 * **De duur.** Die wordt juist wél gerekend, met de zones erbij. Een dienst die
 * om 23:00 begint en om 01:00 eindigt is twee uur, niet min tweeëntwintig. En
 * de nacht waarin de klok verzet wordt is een uur korter of langer dan de
 * klokstanden suggereren. Het verschil tussen de twee tijdstippen weet dat
 * allemaal; aftrekken van twee klokstanden niet.
 */

import { koppel, naamSleutel, type Afspraak, type Kandidaat, type Reden } from './koppelen'

/* ------------------------------------------------------------ wat er komt --- */

/** Een urenregel zoals `GET /open_api/time_registration_shifts` hem geeft. */
export type ApiShift = {
  id: number
  date: string
  start?: string | null
  end?: string | null
  break_minutes?: number | null
  user?: { id: number; name?: string | null } | null
  team?: { id?: number; name?: string | null } | null
  approved?: boolean | null
  type?: { name?: string | null } | null
  meals?: { name?: string | null }[] | null
}

/** Een medewerker zoals `GET /open_api/users` hem geeft. */
export type ApiUser = {
  id: number
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  date_of_birth?: string | null
  active?: boolean | null
  out_of_service_date?: string | null
}

/* ----------------------------------------------------------- wat er blijft --- */

export type Urenrij = {
  bron_id: string
  datum: string
  voornaam: string | null
  achternaam: string | null
  soort: string | null
  begint: string | null
  eindigt: string | null
  minuten: number
  pauze_minuten: number
  maaltijden: string | null
  goedgekeurd: boolean | null
  eitje_user_id: number | null
  medewerker_id: string | null
}

/* --------------------------------------------------------------- omrekenen --- */

/** De soort zoals de database hem kent: `gewerkte_uren` wordt `gewerkte uren`. */
export function soortUit(shift: ApiShift): string | null {
  const ruw = (shift.type?.name ?? '').replace(/_/g, ' ').toLowerCase().trim().replace(/\s+/g, ' ')
  return ruw || null
}

/* De klok uit een tijdstip, letterlijk uit de tekst. Niet door een
   datumfunctie: die rekent naar de zone van de server en dan verschuift het
   hele rooster. */
export function klokUit(tijdstip: string | null | undefined): string | null {
  const m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(tijdstip ?? '')
  return m ? `${m[1]}:${m[2]}:${m[3] ?? '00'}` : null
}

/** De dag uit een tijdstip, ook letterlijk: anders valt een dienst die om
 *  01:00 eindigt in UTC op de verkeerde dag. */
export function dagUit(tijdstip: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(tijdstip ?? '')
  return m ? m[1] : null
}

/* Een dienst van meer dan zestien uur bestaat niet in een snackbar. Komt die
   er toch uit, dan is er iets mis met de tijdstippen en is geen getal beter
   dan een verzonnen getal: dan blijft het 0 en valt het op als lege regel. */
const MAX_MINUTEN = 16 * 60

/** De gewerkte tijd in minuten, pauze er al af. */
export function minutenVan(shift: ApiShift): number {
  const pauze = Math.max(0, Math.round(shift.break_minutes ?? 0))
  const van = Date.parse(shift.start ?? '')
  const tot = Date.parse(shift.end ?? '')
  if (!Number.isFinite(van) || !Number.isFinite(tot)) return 0

  const duur = Math.round((tot - van) / 60000)
  if (duur < 0 || duur > MAX_MINUTEN) return 0
  return Math.max(0, duur - pauze)
}

export function splitsNaam(naam: string | null | undefined): {
  voornaam: string | null
  achternaam: string | null
} {
  const delen = (naam ?? '').trim().split(/\s+/).filter(Boolean)
  if (delen.length === 0) return { voornaam: null, achternaam: null }
  return {
    voornaam: delen[0],
    achternaam: delen.length > 1 ? delen.slice(1).join(' ') : null,
  }
}

/** Eén urenregel, klaar om weg te schrijven.
 *
 *  `namen` komt uit de medewerkerslijst van eitje. De urenregel geeft alleen
 *  een volledige naam in één veld; de medewerkerslijst geeft voornaam en
 *  achternaam apart, en die scheiding is betrouwbaarder dan zelf knippen bij
 *  "van Beurden". */
export function naarUrenrij(
  shift: ApiShift,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }> = new Map(),
  koppelingen: Map<number, string | null> = new Map(),
): Urenrij {
  const userId = shift.user?.id ?? null
  const uitLijst = userId === null ? undefined : namen.get(userId)
  const naam = uitLijst ?? splitsNaam(shift.user?.name)

  const maaltijden = (shift.meals ?? [])
    .map((m) => (m?.name ?? '').trim())
    .filter(Boolean)
    .join(', ')

  return {
    bron_id: String(shift.id),
    /* De dag van het begintijdstip, niet `date`. Bij een dienst over
       middernacht zijn die gelijk — eitje houdt de dienst op de dag waarop hij
       begon — maar als ze ooit uiteenlopen is de klok leidend, want daar staan
       `begint` en `eindigt` ook op. */
    datum: dagUit(shift.start) ?? shift.date,
    voornaam: naam.voornaam,
    achternaam: naam.achternaam,
    soort: soortUit(shift),
    begint: klokUit(shift.start),
    eindigt: klokUit(shift.end),
    minuten: minutenVan(shift),
    pauze_minuten: Math.max(0, Math.round(shift.break_minutes ?? 0)),
    maaltijden: maaltijden || null,
    goedgekeurd: shift.approved ?? null,
    eitje_user_id: userId,
    medewerker_id: userId === null ? null : koppelingen.get(userId) ?? null,
  }
}

/* ------------------------------------------------------------ in stukken --- */

function schuif(datum: string, dagen: number): string {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dagen)
  return d.toISOString().slice(0, 10)
}

/* Een periode opdelen in stukken die de API aanneemt.
 *
 * Eitje geeft maximaal zeven dagen per aanvraag. Een jaar terughalen is dus een
 * kleine zestig aanvragen, en die moeten één voor één met een pauze ertussen —
 * eitje vraagt om ongeveer één aanvraag per seconde.
 *
 * De stukken overlappen met één dag, en dat is geen slordigheid. In de
 * documentatie staat voor contracten uitdrukkelijk dat de einddatum er níet bij
 * hoort; voor deze datumfilters staat het er niet bij. Rekent eitje de
 * einddatum wel mee, dan halen we één dag dubbel op en overschrijft die
 * zichzelf — dat kost niets. Rekent hij hem niet mee en lagen de stukken tegen
 * elkaar aan, dan valt er van elke week een dag weg. Dat geeft geen
 * foutmelding: dat geeft een urentotaal dat een zevende te laag is, en dat
 * totaal gaat mee in een aanbod voor vaste uren.
 *
 * Een dag dubbel ophalen is goedkoop. Een dag missen is dat niet.
 */
export function splitsInStukken(
  van: string,
  tot: string,
  dagen = 7,
  stap = dagen - 1,
): { van: string; tot: string }[] {
  if (!van || !tot || van > tot || dagen < 1 || stap < 1) return []
  const uit: { van: string; tot: string }[] = []
  let begin = van
  // Een jaar is een kleine zestig stukken; duizend is ruim genoeg en voorkomt
  // een eindeloze lus als er ooit een onmogelijke datum binnenkomt.
  for (let i = 0; i < 1000 && begin <= tot; i++) {
    const eind = schuif(begin, dagen - 1)
    uit.push({ van: begin, tot: eind > tot ? tot : eind })
    if (eind >= tot) break
    begin = schuif(begin, stap)
  }
  return uit
}

/* ---------------------------------------------------------- wie is wie --- */

export type KoppelReden = 'nummer' | 'e-mailadres' | 'geboortedatum' | Reden

export type Persoonskoppeling = {
  eitje_user_id: number
  medewerker_id: string | null
  reden: KoppelReden
  /** Zoals eitje de naam schrijft; voor het melden van wat niet lukte. */
  naam: string
}

/** Een medewerker uit de app, met wat er nodig is om hem te herkennen. */
export type AppKandidaat = Kandidaat & {
  email?: string | null
  geboortedatum?: string | null
  eitje_user_id?: number | null
}

const schoon = (t: string | null | undefined) => (t ?? '').trim().toLowerCase()
const datum = (t: string | null | undefined) => (t ?? '').slice(0, 10)

/* De medewerkerslijst van eitje naast die van de app leggen.
 *
 * Van hard naar zacht, en alleen aannemen als er precies één overblijft:
 *
 *   1. het nummer staat er al  — dan is het al eens vastgelegd
 *   2. hetzelfde e-mailadres   — dat is in beide systemen hetzelfde veld
 *   3. geboortedatum én voornaam — twee mensen met dezelfde voornaam die ook
 *      op dezelfde dag geboren zijn, komt in een zaak van twintig man niet voor
 *   4. de naam, met dezelfde module als de Excel-import gebruikt
 *
 * Eenmaal gekoppeld is een medewerker vergeven. Zou een tweede eitje-nummer op
 * dezelfde persoon uitkomen, dan is dat geen koppeling maar een vraag: anders
 * belanden de uren van twee mensen op één.
 */
export function koppelEitjeUsers(
  users: ApiUser[],
  kandidaten: AppKandidaat[],
  afspraken: Map<string, Afspraak> = new Map(),
): Persoonskoppeling[] {
  const vergeven = new Set<string>(
    kandidaten.filter((k) => k.eitje_user_id != null).map((k) => k.id),
  )

  const uit: Persoonskoppeling[] = []

  // Eerst de nummers die er al staan, zodat die medewerkers vergeven zijn
  // voordat er op e-mail of naam gezocht wordt.
  const alGekoppeld = new Map<number, string>()
  for (const k of kandidaten) {
    if (k.eitje_user_id != null) alGekoppeld.set(k.eitje_user_id, k.id)
  }

  for (const u of users) {
    const naam = [u.first_name, u.last_name].filter(Boolean).join(' ') || `nummer ${u.id}`

    const bekend = alGekoppeld.get(u.id)
    if (bekend) {
      uit.push({ eitje_user_id: u.id, medewerker_id: bekend, reden: 'nummer', naam })
      continue
    }

    const vrij = kandidaten.filter((k) => !vergeven.has(k.id))

    const enige = (lijst: AppKandidaat[], reden: KoppelReden): Persoonskoppeling | null => {
      if (lijst.length !== 1) return null
      vergeven.add(lijst[0].id)
      return { eitje_user_id: u.id, medewerker_id: lijst[0].id, reden, naam }
    }

    const mail = schoon(u.email)
    const opMail = mail ? vrij.filter((k) => schoon(k.email) === mail) : []
    const viaMail = enige(opMail, 'e-mailadres')
    if (viaMail) {
      uit.push(viaMail)
      continue
    }

    const geboren = datum(u.date_of_birth)
    const voornaam = naamSleutel(u.first_name ?? null)
    const opGeboorte =
      geboren && voornaam
        ? vrij.filter(
            (k) => datum(k.geboortedatum) === geboren && naamSleutel(k.voornaam) === voornaam,
          )
        : []
    const viaGeboorte = enige(opGeboorte, 'geboortedatum')
    if (viaGeboorte) {
      uit.push(viaGeboorte)
      continue
    }

    const opNaam = koppel(
      { voornaam: u.first_name ?? null, achternaam: u.last_name ?? null },
      vrij,
      afspraken,
    )
    if (opNaam.medewerker_id) vergeven.add(opNaam.medewerker_id)
    uit.push({
      eitje_user_id: u.id,
      medewerker_id: opNaam.medewerker_id,
      reden: opNaam.reden,
      naam,
    })
  }

  return uit
}

/** De koppelingen als kaart, om urenregels mee weg te schrijven. */
export function alsKaart(koppelingen: Persoonskoppeling[]): Map<number, string | null> {
  return new Map(koppelingen.map((k) => [k.eitje_user_id, k.medewerker_id]))
}

/** Voornaam en achternaam per eitje-nummer, zoals eitje ze schrijft. */
export function namenKaart(
  users: ApiUser[],
): Map<number, { voornaam: string | null; achternaam: string | null }> {
  return new Map(
    users.map((u) => [
      u.id,
      { voornaam: u.first_name?.trim() || null, achternaam: u.last_name?.trim() || null },
    ]),
  )
}

/* ------------------------------------------------------- wie er kan --- */

/* Drie dingen bepalen of iemand op een dag inzetbaar is, en eitje weet ze
 * alle drie: wat hij zelf heeft opgegeven, of hij verlof heeft, en of hij ziek
 * is. De app wist er geen van.
 *
 * Ze komen uit drie verschillende endpoints met drie verschillende vormen, en
 * belanden hier in twee tabellen. Beschikbaarheid is een losse dag met een
 * oordeel erover; verlof en ziekte zijn periodes. Die twee vormen door elkaar
 * husselen levert een tabel op waarin de helft van de kolommen altijd leeg is.
 */

export type ApiBeschikbaarheid = {
  id: number
  date: string
  /** "available" of "unavailable". */
  status?: string | null
  remarks?: string | null
  user?: { id: number; name?: string | null } | null
}

export type ApiVerlof = {
  id: number
  status?: string | null
  reason?: string | null
  start_datetime?: string | null
  end_datetime?: string | null
  user?: { id: number; name?: string | null } | null
}

export type ApiZiek = {
  id: number
  start_date?: string | null
  end_date?: string | null
  finalized_at?: string | null
  user?: { id: number; name?: string | null } | null
}

export type Beschikbaarheidsrij = {
  bron_id: string
  datum: string
  status: string | null
  opmerking: string | null
  naam: string | null
  eitje_user_id: number | null
  medewerker_id: string | null
}

export type Afwezigheidsrij = {
  bron_id: string
  soort: 'verlof' | 'ziek'
  van: string
  /** Leeg betekent: loopt nog, einde onbekend. */
  tot: string | null
  status: string | null
  reden: string | null
  naam: string | null
  eitje_user_id: number | null
  medewerker_id: string | null
}

/* Verlof en ziekte hebben allebei een nummer van eitje, maar uit twee aparte
   lijsten. Verlof 21 en ziekmelding 21 bestaan dus naast elkaar; zonder het
   soort ervoor zou de één de ander overschrijven. */
const sleutel = (soort: string, id: number) => `${soort}:${id}`

function wie(
  user: { id: number; name?: string | null } | null | undefined,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }>,
  koppelingen: Map<number, string | null>,
) {
  const id = user?.id ?? null
  const uitLijst = id === null ? undefined : namen.get(id)
  const naam = uitLijst
    ? [uitLijst.voornaam, uitLijst.achternaam].filter(Boolean).join(' ')
    : (user?.name ?? '').trim()
  return {
    naam: naam || null,
    eitje_user_id: id,
    medewerker_id: id === null ? null : koppelingen.get(id) ?? null,
  }
}

export function naarBeschikbaarheid(
  b: ApiBeschikbaarheid,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }> = new Map(),
  koppelingen: Map<number, string | null> = new Map(),
): Beschikbaarheidsrij {
  return {
    bron_id: sleutel('beschikbaar', b.id),
    datum: dagUit(b.date) ?? b.date,
    status: (b.status ?? '').trim().toLowerCase() || null,
    opmerking: (b.remarks ?? '').trim() || null,
    ...wie(b.user, namen, koppelingen),
  }
}

export function naarVerlof(
  v: ApiVerlof,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }> = new Map(),
  koppelingen: Map<number, string | null> = new Map(),
): Afwezigheidsrij {
  /* De tijdstippen dragen een zone. Alleen de dag telt, en die wordt
     letterlijk uit de tekst gelezen — zou een datumfunctie hem naar UTC
     rekenen, dan begint verlof dat om middernacht ingaat een dag te vroeg. */
  const van = dagUit(v.start_datetime) ?? ''
  const tot = dagUit(v.end_datetime)
  return {
    bron_id: sleutel('verlof', v.id),
    soort: 'verlof',
    van,
    tot: tot && tot < van ? van : tot,
    status: (v.status ?? '').trim().toLowerCase() || null,
    reden: (v.reason ?? '').trim() || null,
    ...wie(v.user, namen, koppelingen),
  }
}

export function naarZiek(
  z: ApiZiek,
  namen: Map<number, { voornaam: string | null; achternaam: string | null }> = new Map(),
  koppelingen: Map<number, string | null> = new Map(),
): Afwezigheidsrij {
  const van = dagUit(z.start_date) ?? ''
  /* Geen einddatum betekent bij eitje dat de ziekmelding nog loopt — zij geven
     lopende periodes ook terug als je een latere week opvraagt. Die blijft hier
     dus leeg, en niet gelijk aan de begindag: dat laatste zou iemand die al
     drie weken ziek thuis zit vanaf dag twee weer als inzetbaar tonen. Wie dat
     uitleest moet een lege einddatum lezen als "loopt nog". */
  const tot = dagUit(z.end_date)
  return {
    bron_id: sleutel('ziek', z.id),
    soort: 'ziek',
    van,
    tot: tot && tot < van ? van : tot,
    status: z.finalized_at ? 'afgerond' : 'loopt',
    reden: null,
    ...wie(z.user, namen, koppelingen),
  }
}
