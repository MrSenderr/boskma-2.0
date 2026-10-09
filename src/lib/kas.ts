/* Kas tellen: een rekenhulp, meer niet.

   Je telt de kas, geeft aan wat er naar de kluis gaat, en neemt de bedragen
   over in de kassa. De telling blijft op dit toestel staan en je kunt hem
   vastzetten; de database komt er niet aan te pas, geen geschiedenis.

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

export type Kluisregel = { centen: number; stuks: number }

/** Het lijstje dat je bij de kassa afleest: alleen de coupures die meegaan. */
export function kluisregels(kluis: Aantallen): Kluisregel[] {
  return COUPURES.map((c) => ({ centen: c.centen, stuks: aantal(kluis, c.centen) })).filter(
    (r) => r.stuks > 0,
  )
}

export function vandaagInWoorden(datum = new Date()): string {
  return datum.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------- bewaren --- */

/* De telling blijft op dit apparaat staan, zodat je in kantoor kunt tellen en
   bij de kassa je telefoon weer openmaakt. Niet in de database: deze telling is
   van jou en van dit toestel, en hoort nergens anders thuis. */

const SLEUTEL = 'zonnetje-kastelling'

export type Telling = {
  geteld: Aantallen
  kluis: Aantallen
  /** Gezet zodra je de telling vastzet. Dan kun je er niet meer in typen. */
  vastgezetOp?: string
  /** Gezet als je een vastgezette telling weer hebt opengemaakt. Dat blijft
   *  staan, zodat je later ziet dat er na het vastzetten nog aan gezeten is. */
  opengemaaktOp?: string
}

export type BewaardeTelling = Telling & { bewaardOp: string }

/** Alleen de coupures die we kennen, en alleen hele getallen vanaf nul. Wat er
 *  in de opslag staat is oud of aangepast tot het tegendeel blijkt. */
function schoonAantallen(ruw: unknown): Aantallen {
  const uit: Aantallen = { ...LEEG }
  if (!ruw || typeof ruw !== 'object') return uit
  for (const c of COUPURES) {
    const n = Number((ruw as Record<string, unknown>)[String(c.centen)])
    uit[c.centen] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }
  return uit
}

/** Een bruikbaar tijdstip, of niets. Bij een onleesbare datum staat de telling
 *  liever open dan op slot om een reden die niemand kan nazien. */
function tijdstempel(ruw: unknown): string | undefined {
  return typeof ruw === 'string' && !Number.isNaN(new Date(ruw).getTime()) ? ruw : undefined
}

/** Wat er uit de opslag komt omzetten naar een telling, of niets. */
export function uitOpslag(tekst: string | null): BewaardeTelling | null {
  if (!tekst) return null
  try {
    const ruw = JSON.parse(tekst) as Record<string, unknown>
    const bewaardOp = tijdstempel(ruw.bewaardOp)
    if (!bewaardOp) return null
    return {
      geteld: schoonAantallen(ruw.geteld),
      kluis: schoonAantallen(ruw.kluis),
      vastgezetOp: tijdstempel(ruw.vastgezetOp),
      opengemaaktOp: tijdstempel(ruw.opengemaaktOp),
      bewaardOp,
    }
  } catch {
    return null
  }
}

export function naarOpslag(t: BewaardeTelling): string {
  return JSON.stringify(t)
}

/** Is deze telling van vandaag? Zo niet, dan hoort hij niet stilletjes terug te
 *  komen alsof je net geteld hebt. */
export function isVanVandaag(bewaardOp: string, nu = new Date()): boolean {
  const d = new Date(bewaardOp)
  if (Number.isNaN(d.getTime())) return false
  return d.toLocaleDateString('sv-SE') === nu.toLocaleDateString('sv-SE')
}

export function tijdstip(bewaardOp: string): string {
  const d = new Date(bewaardOp)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

/* De browser mag opslag weigeren — een privévenster, of site-gegevens die
   geblokkeerd zijn. Dan werkt het scherm gewoon door, maar bewaart het niets,
   en dat moet je weten in plaats van je telling kwijtraken. */

export function leesTelling(): BewaardeTelling | null {
  try {
    return uitOpslag(window.localStorage.getItem(SLEUTEL))
  } catch {
    return null
  }
}

/** Geeft false als bewaren niet lukte. */
export function bewaarTelling(t: Telling): boolean {
  try {
    window.localStorage.setItem(SLEUTEL, naarOpslag({ ...t, bewaardOp: new Date().toISOString() }))
    return true
  } catch {
    return false
  }
}

export function wisTelling(): void {
  try {
    window.localStorage.removeItem(SLEUTEL)
  } catch {
    // Niets te doen: als je het er niet in krijgt, staat het er ook niet in.
  }
}
