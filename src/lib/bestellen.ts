/* Een bestelvoorstel per leverdag.
 *
 * De inkoopmodule liet vooral zien wat er ooit is binnengekomen. Dit beantwoordt
 * de vraag die er werkelijk is: wat moet er deze dinsdag besteld worden.
 *
 * Het rust op één vaststelling uit de gegevens zelf: er wordt geleverd op
 * dinsdag en donderdag, en een dinsdaglevering lijkt op andere dinsdagen — niet
 * op de donderdag ervoor. Daarom gaat alles hier per weekdag.
 *
 * Wat deze module níet doet is bestellen. Het levert een lijst die je naloopt,
 * aanpast en doorgeeft langs de weg die je al gebruikt. Een app die zelf
 * bestelt moet weten wat er nog in de vriezer ligt, en dat weet hij niet.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

const inkoop = supabase.schema('inkoop')

export type Bestelregel = {
  dagnr: number
  leverdagen: number
  laatste_dag: string
  leverancier_id: number
  leveranciernaam: string | null
  artikelnr: string
  naam: string | null
  eenheid: string | null
  keer: number
  gemiddeld: number | string | null
  hoe_vaak_pct: number | string | null
  laatst_besteld: string
  laatste_prijs: number | string | null
}

const getal = (w: number | string | null | undefined): number =>
  w === null || w === undefined || w === '' ? 0 : Number(w) || 0

export const DAGNAAM: Record<number, string> = {
  1: 'maandag',
  2: 'dinsdag',
  3: 'woensdag',
  4: 'donderdag',
  5: 'vrijdag',
  6: 'zaterdag',
  7: 'zondag',
}

export type Leverdag = {
  dagnr: number
  naam: string
  leverdagen: number
  laatsteDag: string
  artikelen: number
}

/* Op welke dagen wordt er geleverd?
 *
 * Dinsdag en donderdag, en dat is geen uitkomst van een berekening maar een
 * afspraak met de leverancier. De app telde het eerst zelf uit en hield elke
 * dag over waarop minstens drie keer in twaalf weken iets binnenkwam. Dat
 * leverde ook vrijdag en zondag op — vijf zondagleveringen, veertig artikelen
 * — terwijl dat losse aanvullingen zijn en geen besteldag.
 *
 * Nagerekend wat die inperking kost: van de 244 artikelen komen er 18 nooit op
 * een dinsdag of donderdag binnen, en die zijn op één na allemaal precies één
 * keer besteld. Eenmalige dingen dus; ze haalden de drempel van het voorstel
 * toch niet. */
export const LEVERDAGEN = [2, 4]

export function leverdagenVan(regels: Bestelregel[]): Leverdag[] {
  const per = new Map<number, Leverdag>()
  for (const r of regels) {
    const bestaand = per.get(r.dagnr)
    if (bestaand) {
      bestaand.artikelen += 1
      continue
    }
    per.set(r.dagnr, {
      dagnr: r.dagnr,
      naam: DAGNAAM[r.dagnr] ?? `dag ${r.dagnr}`,
      leverdagen: r.leverdagen,
      laatsteDag: r.laatste_dag,
      artikelen: 1,
    })
  }
  return [...per.values()]
    .filter((d) => LEVERDAGEN.includes(d.dagnr))
    .sort((a, b) => b.leverdagen - a.leverdagen || a.dagnr - b.dagnr)
}

/** Vanaf hoe vaak iets voorkomt hoort het in het voorstel. */
export const DREMPEL_PCT = 50

export type Voorstel = {
  /** Wat je bijna altijd bestelt: staat aangevinkt klaar. */
  vast: Bestelregel[]
  /** Wat je soms bestelt: staat erbij, maar niet aangevinkt. */
  soms: Bestelregel[]
}

export function voorstelVoor(
  regels: Bestelregel[],
  dagnr: number,
  drempel = DREMPEL_PCT,
): Voorstel {
  const vanDieDag = regels.filter((r) => r.dagnr === dagnr)
  const opVolgorde = [...vanDieDag].sort(
    (a, b) =>
      getal(b.hoe_vaak_pct) - getal(a.hoe_vaak_pct) ||
      (a.naam ?? '').localeCompare(b.naam ?? '', 'nl'),
  )
  return {
    vast: opVolgorde.filter((r) => getal(r.hoe_vaak_pct) >= drempel),
    soms: opVolgorde.filter((r) => getal(r.hoe_vaak_pct) < drempel),
  }
}

/* Het aantal dat de app voorstelt.
 *
 * Afgerond op halven en nooit onder één: je bestelt geen 3,3 dozen. Naar boven
 * bij twijfel — te weinig betekent dat je het op zaterdag niet hebt, te veel
 * betekent dat het een week langer ligt. Het precieze gemiddelde staat er
 * naast, zodat je ziet waar het vandaan komt. */
export function voorgesteldAantal(gemiddeld: number | string | null): number {
  const n = getal(gemiddeld)
  if (n <= 0) return 1
  return Math.max(1, Math.ceil(n * 2) / 2)
}

/** Wat de regel kost bij dit aantal, voor zover de prijs bekend is. */
export function regelbedrag(r: Bestelregel, aantal: number): number {
  return getal(r.laatste_prijs) * aantal
}

export type Keuze = { regel: Bestelregel; aantal: number }

/* De lijst als platte tekst, om in een mail of appje te plakken.
 *
 * Per leverancier gegroepeerd: je bestelt bij Veldboer en bij Het Grootslag
 * apart, en één lijst door elkaar moet je dan alsnog uit elkaar trekken. */
export function alsTekst(keuzes: Keuze[], dagnaam: string, datum?: string): string {
  const perLeverancier = new Map<string, Keuze[]>()
  for (const k of keuzes) {
    const naam = k.regel.leveranciernaam ?? 'Onbekende leverancier'
    const lijst = perLeverancier.get(naam) ?? []
    lijst.push(k)
    perLeverancier.set(naam, lijst)
  }

  const kop = datum ? `Bestelling ${dagnaam} ${datum}` : `Bestelling ${dagnaam}`
  const stukken = [...perLeverancier.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'nl'))
    .map(([leverancier, lijst]) => {
      const regels = lijst
        .sort((a, b) => (a.regel.naam ?? '').localeCompare(b.regel.naam ?? '', 'nl'))
        .map((k) => {
          const aantal = String(k.aantal).replace('.', ',')
          const eenheid = k.regel.eenheid ? ` ${k.regel.eenheid}` : ''
          return `- ${aantal}${eenheid} ${k.regel.naam ?? k.regel.artikelnr} (${k.regel.artikelnr})`
        })
      return [leverancier, ...regels].join('\n')
    })

  return [kop, '', ...stukken].join('\n').trim()
}

/* --------------------------------------------------------------- ophalen --- */

export function useBestelpatroon() {
  return useQuery({
    queryKey: ['inkoop', 'bestelpatroon'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Bestelregel[]> => {
      const { data, error } = await inkoop.from('bestelpatroon').select('*')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Bestelregel[]
    },
  })
}

/* De eerstvolgende datum die op deze weekdag valt. Vandaag telt mee: bestel je
   op dinsdagochtend voor diezelfde dag, dan is dat de dag die je bedoelt. */
export function volgendeDatum(dagnr: number, vanaf = new Date()): string {
  const d = new Date(vanaf)
  d.setHours(12, 0, 0, 0)
  const huidig = d.getDay() === 0 ? 7 : d.getDay()
  const erbij = (dagnr - huidig + 7) % 7
  d.setDate(d.getDate() + erbij)
  return d.toLocaleDateString('sv-SE')
}
