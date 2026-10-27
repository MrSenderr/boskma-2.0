/* Een conceptrooster maken.
 *
 * Alles wat hiervoor is gebouwd komt hier samen: het weeksjabloon zegt hoeveel
 * plekken er per dag te vullen zijn, de vaste diensten liggen al vast, eitje
 * weet wie er kan, en de vaste dagen zeggen wat iemand liever wil.
 *
 * Vier regels, in deze volgorde, en die volgorde is de hele module:
 *
 * 1. **Een afspraak gaat voor.** Wie een vaste dienst heeft staat erop,
 *    zonder dat er iets te kiezen valt.
 * 2. **Wie er niet is, wordt niet ingepland.** Verlof, ziekte, of zelf
 *    opgegeven dat hij niet kan. Dat is een harde grens en geen weging — ook
 *    niet voor iemand met een vaste dienst. Een afspraak is geen aanwezigheid.
 * 3. **De rest wordt verdeeld op punten**, en wie het meest heeft opgegeven
 *    dat hij kan, komt het eerst.
 * 4. **Wat overblijft wordt een open dienst.** Geen gok. Een lege plek op het
 *    rooster is een vraag die je ziet; een verkeerde naam is een fout die je
 *    pas merkt als er niemand staat.
 *
 * **Niet iedereen vult beschikbaarheid in.** Een paar mensen doen dat nooit;
 * die regelen het via hun vaste dagen. Voor hen betekent zwijgen niet "ik kan
 * niet" maar "zoals altijd". Zou de app ze hetzelfde behandelen als iemand die
 * het wel bijhoudt en deze dag openliet, dan kwamen ze nooit meer aan een
 * extra dienst - en dat zijn juist de mensen die er altijd staan.
 *
 * Elke toewijzing draagt zijn reden mee. Een voorstel dat niet kan uitleggen
 * waarom iemand ergens staat, is een voorstel dat je niet kunt nakijken — en
 * dan keur je het goed omdat de computer het zei.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { loopt, wieSleutel, type Afwezig, type Opgave } from './beschikbaarheid'
import type { Sjabloonregel, Soort, VasteDienst } from './weeksjabloon'

export type Inplannen = 'verdelen' | 'alleen_vast'

export type Persoon = {
  id: string
  voornaam: string | null
  achternaam: string | null
  uit_dienst_op: string | null
  /* Hoe deze persoon aan diensten komt. `alleen_vast` doet niet mee in de
     verdeling: Ilona en Lenthe draaien in principe hun vaste dagen en worden
     voor de rest gebeld, Joost is pure invalkracht. Zouden die meedoen, dan
     vullen juist zij het rooster — ze geven immers nooit door dat ze niet
     kunnen — en wordt wie wél doorgeeft eruit gedrukt. */
  inplannen?: Inplannen
  /* Of hij de mep kan draaien. Drie mensen doen dat: Sander, Daan en Justin.
     Een kunnen en geen voorkeur, dus een harde grens. */
  kan_voorbereiding?: boolean
}

/** Wat iemand van een weekdag vindt, uit het overzicht vaste dagen. */
export type Wens = 'graag' | 'liever_niet' | 'nee'

export type Wensen = Map<string, Partial<Record<number, Wens>>>

export type Reden = 'afspraak' | 'verdeeld' | 'open'

export type Dienstvoorstel = {
  datum: string
  soort: Soort
  begint: string
  eindigt: string
  medewerker_id: string | null
  naam: string | null
  reden: Reden
  /** Waarom deze persoon, of waarom niemand. In gewone taal. */
  uitleg: string
  /** Iets dat je moet weten maar dat niet tegenhoudt. */
  waarschuwing: string | null
  /* Wie je kunt bellen voor deze open plek: de mensen die alleen hun vaste
     dagen draaien en die dag verder vrij zijn. Dat is wat Sander nu met de
     hand doet — open plekken rondappen — dus hoort de lijst erbij te staan in
     plaats van dat hij hem zelf bij elkaar zoekt. */
  teVragen?: string[]
}

const naamVan = (p: Persoon) => [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Onbekend'

/** De ISO-weekdag van een datum: 1 is maandag, 7 is zondag. */
export function weekdag(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function dagenIn(van: string, tot: string): string[] {
  if (!van || !tot || van > tot) return []
  const uit: string[] = []
  const d = new Date(`${van}T12:00:00Z`)
  // Een roosterblok is vier weken; vijfhonderd is ruim en voorkomt een
  // eindeloze lus bij een onmogelijke datum.
  for (let i = 0; i < 500; i++) {
    const dag = d.toISOString().slice(0, 10)
    if (dag > tot) break
    uit.push(dag)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return uit
}

/* ------------------------------------------------------- wie kan er niet --- */

export type Belemmering = { hard: boolean; tekst: string }

/* Of iemand op een dag inzetbaar is.
 *
 * Hard betekent: niet inplannen, punt. Zacht betekent: wel inplannen, maar met
 * een waarschuwing erbij — "deels beschikbaar" is geen nee, en iemand die om
 * zeven uur weg moet kan de spits nog wel draaien. */
export function belemmering(
  persoon: Persoon,
  datum: string,
  opgaven: Opgave[],
  afwezig: Afwezig[],
): Belemmering | null {
  if (persoon.uit_dienst_op && datum >= persoon.uit_dienst_op.slice(0, 10)) {
    return { hard: true, tekst: 'uit dienst' }
  }

  const sleutel = wieSleutel({ medewerker_id: persoon.id, naam: naamVan(persoon) })

  for (const a of afwezig) {
    if (!loopt(a, datum)) continue
    if (wieSleutel(a) !== sleutel) continue
    if (a.soort === 'ziek') return { hard: true, tekst: 'ziek' }
    /* Verlof dat nog niet is goedgekeurd houdt niemand tegen, maar je hoort het
       wel te zien: keur je het alsnog goed, dan klopt het rooster niet meer. */
    if (a.status === 'accepted') return { hard: true, tekst: 'verlof' }
    return { hard: false, tekst: 'verlof aangevraagd, nog niet goedgekeurd' }
  }

  for (const o of opgaven) {
    if (o.datum !== datum || wieSleutel(o) !== sleutel) continue
    if (o.status === 'unavailable') {
      return { hard: true, tekst: o.opmerking ? `kan niet: ${o.opmerking}` : 'heeft opgegeven niet te kunnen' }
    }
    if (o.status !== 'available') {
      /* Alles wat geen ja en geen nee is. Bij eitje heet dat
         "partly_unavailable": Nathal die school heeft. Die kan wel, maar niet
         de hele dienst — en dat moet je zien, niet wegfilteren. */
      return {
        hard: false,
        tekst: o.opmerking ? `deels beschikbaar: ${o.opmerking}` : 'deels beschikbaar',
      }
    }
  }

  return null
}

/* ----------------------------------------------------------------- punten --- */

/* Wat iemand voor een plek waard is.
 *
 * Geen vernuftige formule maar een optelsom die je kunt navertellen, want dit
 * getal bepaalt wie er werkt. Zodra niemand meer kan uitleggen waarom Evi op
 * zaterdag staat en Daan niet, is het voorstel niets waard.
 */
export const PUNTEN = {
  /** Heeft zelf opgegeven dat hij die dag kan. */
  opgegeven: 50,
  /** Vindt deze weekdag prettig (uit vaste dagen). */
  graag: 20,
  liever_niet: -25,
  /** Per dienst die hij deze week al heeft. Spreidt het werk. */
  perDienstDezeWeek: -12,
  /** Iets waardoor hij er niet de hele dienst is. */
  zacht: -30,
}

export function punten(x: {
  opgegevenBeschikbaar: boolean
  /* Of deze persoon uberhaupt beschikbaarheid bijhoudt. Doet hij dat nooit,
     dan zegt het ontbreken van een opgave niets over deze dag, en mag het hem
     ook niets kosten. Houdt hij het wel bij en liet hij deze dag open, dan is
     dat een stilte die iets betekent. */
  houdtBeschikbaarheidBij: boolean
  wens: Wens | undefined
  dienstenDezeWeek: number
  zachteBelemmering: boolean
}): number {
  let score = 0
  if (x.opgegevenBeschikbaar || !x.houdtBeschikbaarheidBij) score += PUNTEN.opgegeven
  if (x.wens === 'graag') score += PUNTEN.graag
  if (x.wens === 'liever_niet') score += PUNTEN.liever_niet
  score += x.dienstenDezeWeek * PUNTEN.perDienstDezeWeek
  if (x.zachteBelemmering) score += PUNTEN.zacht
  return score
}

/* ------------------------------------------------------------- het voorstel --- */

export type Opdracht = {
  van: string
  tot: string
  sjabloon: Sjabloonregel[]
  vast: VasteDienst[]
  mensen: Persoon[]
  opgaven: Opgave[]
  afwezig: Afwezig[]
  wensen?: Wensen
}

export function maakVoorstel(o: Opdracht): Dienstvoorstel[] {
  const uit: Dienstvoorstel[] = []
  const wensen = o.wensen ?? new Map()

  /* Hoeveel diensten iemand deze week al heeft. Per week opnieuw: dat iemand
     vorige maand veel werkte zegt niets over wat er deze week eerlijk is. */
  const dezeWeek = new Map<string, number>()
  let huidigeWeek = ''

  for (const datum of dagenIn(o.van, o.tot)) {
    const week = maandagVanDatum(datum)
    if (week !== huidigeWeek) {
      huidigeWeek = week
      dezeWeek.clear()
    }

    const dag = weekdag(datum)
    const bezet = new Set<string>()
    /* De open plekken van deze dag, om ze aan het eind pas een belijst te
       geven. Tijdens het verdelen is `bezet` nog niet compleet: de vaste
       diensten worden één voor één afgelopen, en wie verderop in de rij staat
       telt dan nog niet mee. Zo kwam Daan in de lijst "te vragen" terwijl zijn
       eigen vaste dienst een regel later werd neergezet. */
    const openVandaag: Dienstvoorstel[] = []

    /* Wie houdt zijn beschikbaarheid bij? Dat wordt over de hele periode
       bekeken en niet per dag: iemand die deze week drie keer iets opgaf en
       zaterdag oversloeg, heeft zaterdag bewust niet ingevuld. Iemand die in
       vier weken geen enkele opgave heeft staan, doet het gewoon niet. */
    const houdtBij = new Set(
      o.opgaven.map((x) => x.medewerker_id).filter((id): id is string => Boolean(id)),
    )

    /* De plekken van die dag, uit het sjabloon. Een regel met aantal 3 is drie
       plekken; die worden één voor één gevuld. */
    const plekken = o.sjabloon
      .filter((r) => r.dag === dag)
      .flatMap((r) => Array.from({ length: r.aantal }, () => r))
      .sort((a, b) => a.begint.localeCompare(b.begint))

    // ---- 1. de afspraken ----
    const afspraken = o.vast.filter((v) => v.dag === dag)
    const nogTeVullen = [...plekken]

    for (const afspraak of afspraken) {
      const mens = o.mensen.find((m) => m.id === afspraak.medewerker_id)
      if (!mens) continue

      const index = nogTeVullen.findIndex((p) => p.soort === afspraak.soort)
      /* Staat er geen plek meer open voor die soort, dan is het sjabloon
         krapper dan de afspraken. Dat meldt het sjabloonscherm al; hier wordt
         de afspraak gewoon nagekomen — een afspraak met een mens weegt zwaarder
         dan een getal in een tabel. */
      if (index >= 0) nogTeVullen.splice(index, 1)

      const weg = belemmering(mens, datum, o.opgaven, o.afwezig)
      if (weg?.hard) {
        /* Een vaste dienst is een afspraak, geen aanwezigheid. Wie verlof heeft
           staat er niet, en die plek hoort open te blijven zodat je hem ziet. */
        const leeg: Dienstvoorstel = {
          datum,
          soort: afspraak.soort,
          begint: afspraak.begint,
          eindigt: afspraak.eindigt,
          medewerker_id: null,
          naam: null,
          reden: 'open',
          uitleg: `${naamVan(mens)} heeft hier een vaste dienst, maar is er niet: ${weg.tekst}.`,
          waarschuwing: 'vaste dienst niet ingevuld',
        }
        uit.push(leeg)
        openVandaag.push(leeg)
        continue
      }

      bezet.add(mens.id)
      dezeWeek.set(mens.id, (dezeWeek.get(mens.id) ?? 0) + 1)
      uit.push({
        datum,
        soort: afspraak.soort,
        begint: afspraak.begint,
        eindigt: afspraak.eindigt,
        medewerker_id: mens.id,
        naam: naamVan(mens),
        reden: 'afspraak',
        uitleg: 'vaste dienst',
        waarschuwing: weg ? weg.tekst : null,
      })
    }

    // ---- 2. de rest verdelen ----
    for (const plek of nogTeVullen) {
      const kandidaten = o.mensen
        .filter((m) => !bezet.has(m.id))
        /* Wie alleen zijn vaste dagen draait doet hier niet mee; die komt
           hieronder terug als iemand om te bellen. */
        .filter((m) => (m.inplannen ?? 'verdelen') === 'verdelen')
        // De mep kan niet iedereen.
        .filter((m) => plek.soort !== 'voorbereiding' || m.kan_voorbereiding)
        .map((m) => {
          const weg = belemmering(m, datum, o.opgaven, o.afwezig)
          if (weg?.hard) return null
          const opgegeven = o.opgaven.some(
            (x) =>
              x.datum === datum &&
              x.status === 'available' &&
              wieSleutel(x) === wieSleutel({ medewerker_id: m.id, naam: naamVan(m) }),
          )
          const wens = wensen.get(m.id)?.[dag]
          if (wens === 'nee') return null
          const bijhouder = houdtBij.has(m.id)
          return {
            mens: m,
            weg,
            score: punten({
              opgegevenBeschikbaar: opgegeven,
              houdtBeschikbaarheidBij: bijhouder,
              wens,
              dienstenDezeWeek: dezeWeek.get(m.id) ?? 0,
              zachteBelemmering: Boolean(weg),
            }),
            opgegeven,
            bijhouder,
            wens,
          }
        })
        .filter((k): k is NonNullable<typeof k> => k !== null)
        /* Bij gelijke punten op naam, zodat hetzelfde voorstel twee keer
           draaien hetzelfde oplevert. Een rooster dat elke keer anders uitvalt
           kun je niet vergelijken met het vorige. */
        .sort((a, b) => b.score - a.score || naamVan(a.mens).localeCompare(naamVan(b.mens), 'nl'))

      const beste = kandidaten[0]
      if (!beste) {
        const leeg: Dienstvoorstel = {
          datum,
          soort: plek.soort,
          begint: plek.begint,
          eindigt: plek.eindigt,
          medewerker_id: null,
          naam: null,
          reden: 'open',
          uitleg:
            plek.soort === 'voorbereiding'
              ? 'niemand die de mep kan draaien is nog vrij'
              : 'niemand beschikbaar die nog niet staat ingepland',
          waarschuwing: 'open dienst',
        }
        uit.push(leeg)
        openVandaag.push(leeg)
        continue
      }

      bezet.add(beste.mens.id)
      dezeWeek.set(beste.mens.id, (dezeWeek.get(beste.mens.id) ?? 0) + 1)
      uit.push({
        datum,
        soort: plek.soort,
        begint: plek.begint,
        eindigt: plek.eindigt,
        medewerker_id: beste.mens.id,
        naam: naamVan(beste.mens),
        reden: 'verdeeld',
        uitleg: uitlegVan(
          beste.opgegeven,
          beste.bijhouder,
          beste.wens,
          dezeWeek.get(beste.mens.id)! - 1,
        ),
        waarschuwing: beste.weg ? beste.weg.tekst : null,
      })
    }

    /* Nu pas, met de dag helemaal rond: wie je kunt bellen. Eerder gaf dat de
       naam van iemand die verderop diezelfde dag nog werd ingepland. */
    for (const leeg of openVandaag) {
      leeg.teVragen = teVragenOp(o, datum, leeg.soort, bezet)
    }
  }

  return uit
}

/* Wie je kunt bellen voor een open plek.
 *
 * De mensen die alleen hun vaste dagen draaien en die dag verder vrij zijn.
 * Dat is wat Sander nu met de hand doet — open plekken rondappen — dus hoort
 * die lijst erbij te staan in plaats van dat hij hem zelf bij elkaar zoekt.
 *
 * Wie hard verhinderd is staat er niet bij: iemand bellen die met verlof is,
 * is erger dan niemand bellen. */
function teVragenOp(o: Opdracht, datum: string, soort: Soort, bezet: Set<string>): string[] {
  return o.mensen
    .filter((m) => (m.inplannen ?? 'verdelen') === 'alleen_vast')
    .filter((m) => !bezet.has(m.id))
    .filter((m) => soort !== 'voorbereiding' || m.kan_voorbereiding)
    .filter((m) => !belemmering(m, datum, o.opgaven, o.afwezig)?.hard)
    .map(naamVan)
    .sort((a, b) => a.localeCompare(b, 'nl'))
}

function uitlegVan(
  opgegeven: boolean,
  bijhouder: boolean,
  wens: Wens | undefined,
  alDezeWeek: number,
): string {
  const delen: string[] = []
  if (opgegeven) delen.push('heeft opgegeven dat hij kan')
  /* Expres een andere zin dan "heeft opgegeven dat hij kan". De uitkomst is
     dezelfde, de grond niet, en op een blad dat je nakijkt hoor je te zien
     welke van de twee het was. */
  else if (!bijhouder) delen.push('vult geen beschikbaarheid in, dus geldt als beschikbaar')
  if (wens === 'graag') delen.push('werkt graag op deze dag')
  if (wens === 'liever_niet') delen.push('liever niet op deze dag')
  if (alDezeWeek > 0) delen.push(`had al ${alDezeWeek} ${alDezeWeek === 1 ? 'dienst' : 'diensten'} deze week`)
  if (delen.length === 0) return 'niets op tegen, en nog geen diensten deze week'
  return delen.join(', ')
}

/* De maandag van de week waarin een datum valt. Eigen kopie en niet die uit
   rooster.ts: die rekent met de zone van de browser, en een voorstel hoort op
   een server net zo uit te vallen als op een telefoon. */
function maandagVanDatum(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------ samenvatten --- */

export type Samenvatting = {
  diensten: number
  ingevuld: number
  open: number
  metWaarschuwing: number
  perPersoon: { naam: string; diensten: number }[]
}

export function samenvatten(voorstel: Dienstvoorstel[]): Samenvatting {
  const per = new Map<string, number>()
  for (const d of voorstel) {
    if (!d.naam) continue
    per.set(d.naam, (per.get(d.naam) ?? 0) + 1)
  }
  return {
    diensten: voorstel.length,
    ingevuld: voorstel.filter((d) => d.medewerker_id).length,
    open: voorstel.filter((d) => !d.medewerker_id).length,
    metWaarschuwing: voorstel.filter((d) => d.waarschuwing).length,
    perPersoon: [...per]
      .map(([naam, diensten]) => ({ naam, diensten }))
      .sort((a, b) => b.diensten - a.diensten || a.naam.localeCompare(b.naam, 'nl')),
  }
}

/* ------------------------------------------------------------- de wensen --- */

/** Zoals de kolommen in `vaste_dagen_overzicht` heten, per weekdagnummer. */
const WENSKOLOM: Record<number, 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo'> = {
  2: 'di',
  3: 'wo',
  4: 'do',
  5: 'vr',
  6: 'za',
  7: 'zo',
}

const ISWENS = (w: unknown): w is Wens =>
  w === 'graag' || w === 'liever_niet' || w === 'nee'

/* De wenslijst omzetten naar wat het voorstel ervan kan gebruiken.
 *
 * Alleen wat er staat. Van de dertien mensen hebben er twee iets ingevuld, en
 * een lege kolom is geen "maakt niet uit" maar een onbekende — die hoort geen
 * punten te geven en geen punten te kosten. */
export function wensenUit(
  regels: { persoon_id: string | null; [kolom: string]: unknown }[],
): Wensen {
  const uit: Wensen = new Map()
  for (const r of regels) {
    if (!r.persoon_id) continue
    const perDag: Partial<Record<number, Wens>> = {}
    for (const [nr, kolom] of Object.entries(WENSKOLOM)) {
      const w = r[kolom]
      if (ISWENS(w)) perDag[Number(nr)] = w
    }
    if (Object.keys(perDag).length > 0) uit.set(r.persoon_id, perDag)
  }
  return uit
}

/* Het eerstvolgende roosterblok: vier weken, beginnend op de maandag over twee
   weken. Dat is het ritme dat in eitje staat ingesteld — roosters van vier
   weken, twee weken van tevoren, op dinsdag. */
export function volgendBlok(vandaag: string): { van: string; tot: string } {
  const d = new Date(`${vandaag}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 14)
  const van = d.toISOString().slice(0, 10)
  d.setUTCDate(d.getUTCDate() + 27)
  return { van, tot: d.toISOString().slice(0, 10) }
}

/* --------------------------------------------------------------- ophalen --- */

/* De medewerkers zoals het voorstel ze nodig heeft.
 *
 * Een eigen query en niet die van de roosterimport. Die levert `Kandidaat`,
 * en dat type wordt gedeeld met de serverfunctie die namen koppelt — daar twee
 * velden aan toevoegen die alleen hier iets doen, maakt die kopie zwaarder
 * zonder dat er iets mee gebeurt. */
export function useRoosterMensen() {
  return useQuery({
    queryKey: ['rooster-mensen'],
    queryFn: async (): Promise<Persoon[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select('id,voornaam,achternaam,uit_dienst_op,inplannen,kan_voorbereiding')
        .eq('fase', 'medewerker')
        .eq('is_apparaat', false)
        .eq('is_test', false)
        .order('voornaam')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Persoon[]
    },
  })
}

export function useInplannenWijzigen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (x: {
      id: string
      inplannen?: Inplannen
      kan_voorbereiding?: boolean
    }) => {
      const { id, ...rest } = x
      const { error } = await supabase.from('sollicitaties').update(rest).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooster-mensen'] })
    },
  })
}

/* ----------------------------------------------------- naar eitje toe --- */

/* In welk team de diensten komen te staan.
 *
 * Eitje eist een team bij elke dienst, en Boskma heeft er twee: "Snackerie
 * 't Zonnetje" en "Algemeen". De serverfunctie weigert te kiezen — hij noemt ze
 * bij naam en stopt — en die keuze staat daarom hier, in de instellingen, in
 * plaats van in de code. Verandert er iets bij eitje, dan is dat één regel in
 * de database en geen nieuwe uitrol. */
export function useEitjeTeam() {
  return useQuery({
    queryKey: ['instelling', 'eitje_team'],
    queryFn: async (): Promise<{ id: number; naam: string } | null> => {
      const { data, error } = await supabase
        .from('instellingen')
        .select('waarde')
        .eq('sleutel', 'eitje_team')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const w = (data as { waarde?: { id?: number; naam?: string } } | null)?.waarde
      return w?.id ? { id: w.id, naam: w.naam ?? '' } : null
    },
  })
}

export type Weekuitslag = {
  van: string
  tot: string
  weggehaald: number
  geschreven: number
  zonder_naam: number
  team?: { id: number; naam: string | null }
}

/* Het voorstel ongepubliceerd in eitje zetten.
 *
 * Per week één aanvraag. Een blok van vier weken is ruim honderd diensten, en
 * die passen met een seconde pauze ertussen niet binnen de tijdslimiet van één
 * serverfunctie. De app doet de weken dus één voor één en meldt na elke week
 * wat er is gebeurd — anders staat er twee minuten niets op het scherm.
 *
 * Wat de serverfunctie wegschrijft is exact wat je hier hebt zien staan. Hij
 * rekent het voorstel niet opnieuw uit: dan zou er iets anders in eitje kunnen
 * belanden dan wat je hebt goedgekeurd, en precies dat verschil zie je nooit.
 */
export function useNaarEitje() {
  return useMutation({
    mutationFn: async (opdracht: {
      voorstel: Dienstvoorstel[]
      teamId?: number
      onWeek?: (uitslag: Weekuitslag) => void
    }) => {
      const perWeek = new Map<string, Dienstvoorstel[]>()
      for (const d of opdracht.voorstel) {
        const week = maandagVanDatum(d.datum)
        if (!perWeek.has(week)) perWeek.set(week, [])
        perWeek.get(week)!.push(d)
      }

      const uitslagen: Weekuitslag[] = []
      for (const [maandag, diensten] of [...perWeek].sort(([a], [b]) => a.localeCompare(b))) {
        const dagen = diensten.map((d) => d.datum).sort()
        const { data, error } = await supabase.functions.invoke('eitje-uren', {
          body: {
            modus: 'rooster',
            van: dagen[0] ?? maandag,
            tot: dagen[dagen.length - 1] ?? maandag,
            ...(opdracht.teamId ? { team_id: opdracht.teamId } : {}),
            diensten: diensten.map((d) => ({
              datum: d.datum,
              begint: d.begint,
              eindigt: d.eindigt,
              medewerker_id: d.medewerker_id,
            })),
          },
        })
        if (error) throw new Error(await foutTekst(error))
        if (data && data.ok === false) throw new Error(data.error ?? 'Wegschrijven lukte niet.')

        uitslagen.push(data as Weekuitslag)
        opdracht.onWeek?.(data as Weekuitslag)
      }
      return uitslagen
    },
  })
}

/* Wat de serverfunctie zegt als het misgaat, in plaats van "non-2xx status
   code". Die melding zegt niets, en hier gaat het om wat er bij het personeel
   op het scherm komt te staan. */
async function foutTekst(fout: unknown): Promise<string> {
  const antwoord = (fout as { context?: Response } | null)?.context
  if (antwoord && typeof antwoord.json === 'function') {
    try {
      const body = await antwoord.clone().json()
      if (body?.error) return String(body.error)
    } catch {
      // Geen json erin; dan blijft de oorspronkelijke melding over.
    }
  }
  return fout instanceof Error ? fout.message : 'Dit lukte niet.'
}

/* De dagvoorkeuren, uit de bron en niet uit het overzicht.
 *
 * `vaste_dagen_overzicht` sluit de meewerkend eigenaar uit, en met reden: dat
 * overzicht hoort bij het invulformulier en bij het nabellen van wie het nog
 * niet heeft ingevuld. Daar heeft de baas niets te zoeken.
 *
 * Maar een voorkeur voor een weekdag is iets anders dan een invulformulier.
 * Sander wil zijn donderdag zoveel mogelijk vrijhouden voor administratie, en
 * die wens hoort het rooster gewoon te kennen. Vandaar dat het voorstel de
 * onderliggende tabel leest: dezelfde gegevens, zonder de uitzondering die
 * voor een ander doel is gemaakt. */
export function useVoorkeuren() {
  return useQuery({
    queryKey: ['rooster-voorkeuren'],
    queryFn: async (): Promise<{ persoon_id: string | null }[]> => {
      const { data, error } = await supabase
        .from('rooster_voorkeuren_laatste')
        .select('persoon_id,di,wo,do,vr,za,zo')
      if (error) throw new Error(error.message)
      return (data ?? []) as { persoon_id: string | null }[]
    },
  })
}
