/* Kas tellen: een rekenhulp, meer niet.

   Je telt de kas, geeft aan wat er naar de kluis gaat, en neemt de bedragen
   over in de kassa. Er wordt niets bewaard — geen database, geen geschiedenis.

   Alles in hele centen. Met kommagetallen loopt een telling vroeg of laat een
   cent uit de pas, en bij geld is dat precies het verschil dat je zoekt. */

export type Soort = 'biljet' | 'munt'

export type Coupure = { centen: number; soort: Soort }

/** In de volgorde waarin je telt: van groot naar klein. */
export const COUPURES: Coupure[] = [
  { centen: 5000, soort: 'biljet' },
  { centen: 2000, soort: 'biljet' },
  { centen: 1000, soort: 'biljet' },
  { centen: 500, soort: 'biljet' },
  { centen: 200, soort: 'munt' },
  { centen: 100, soort: 'munt' },
  { centen: 50, soort: 'munt' },
  { centen: 20, soort: 'munt' },
  { centen: 10, soort: 'munt' },
  { centen: 5, soort: 'munt' },
]

/** Per coupure hoeveel stuks. De sleutel is het bedrag in centen. */
export type Aantallen = Record<number, number>

export const LEEG: Aantallen = Object.fromEntries(COUPURES.map((c) => [c.centen, 0]))

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

/** 123455 wordt "€ 1.234,55". */
export function euro(centen: number): string {
  return nl.format(centen / 100)
}

/** Het opschrift van een coupure: "€ 50" of "€ 0,05". */
export function coupureNaam(centen: number): string {
  return centen >= 100 ? `€ ${centen / 100}` : `€ 0,${String(centen).padStart(2, '0')}`
}

/** Wat erbij hoort te staan, of 0 als er niets is ingevuld. */
export function aantal(a: Aantallen, centen: number): number {
  const n = a[centen]
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function bedrag(a: Aantallen, centen: number): number {
  return aantal(a, centen) * centen
}

/** Je kunt niet meer naar de kluis doen dan je geteld hebt. */
export function teveelNaarKluis(geteld: Aantallen, kluis: Aantallen, centen: number): boolean {
  return aantal(kluis, centen) > aantal(geteld, centen)
}

export function ergensTeveel(geteld: Aantallen, kluis: Aantallen): boolean {
  return COUPURES.some((c) => teveelNaarKluis(geteld, kluis, c.centen))
}

/** Het totaal over een deel van de coupures, bijvoorbeeld alleen de munten. */
export function telOp(a: Aantallen, soort?: Soort): number {
  return COUPURES.filter((c) => !soort || c.soort === soort).reduce(
    (som, c) => som + bedrag(a, c.centen),
    0,
  )
}

export type Totalen = { geteld: number; kluis: number; lade: number }

export function totalen(geteld: Aantallen, kluis: Aantallen, soort?: Soort): Totalen {
  const g = telOp(geteld, soort)
  const k = telOp(kluis, soort)
  return { geteld: g, kluis: k, lade: g - k }
}

/** Wat er van deze coupure in de lade achterblijft. */
export function inLade(geteld: Aantallen, kluis: Aantallen, centen: number): number {
  return (aantal(geteld, centen) - aantal(kluis, centen)) * centen
}

export function vandaagInWoorden(datum = new Date()): string {
  return datum.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
