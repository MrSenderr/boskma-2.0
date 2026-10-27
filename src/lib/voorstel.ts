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

import { loopt, wieSleutel, type Afwezig, type Opgave } from './beschikbaarheid'
import type { Sjabloonregel, Soort, VasteDienst } from './weeksjabloon'

export type Persoon = {
  id: string
  voornaam: string | null
  achternaam: string | null
  uit_dienst_op: string | null
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
        uit.push({
          datum,
          soort: afspraak.soort,
          begint: afspraak.begint,
          eindigt: afspraak.eindigt,
          medewerker_id: null,
          naam: null,
          reden: 'open',
          uitleg: `${naamVan(mens)} heeft hier een vaste dienst, maar is er niet: ${weg.tekst}.`,
          waarschuwing: 'vaste dienst niet ingevuld',
        })
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
        uit.push({
          datum,
          soort: plek.soort,
          begint: plek.begint,
          eindigt: plek.eindigt,
          medewerker_id: null,
          naam: null,
          reden: 'open',
          uitleg: 'niemand beschikbaar die nog niet staat ingepland',
          waarschuwing: 'open dienst',
        })
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
  }

  return uit
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
