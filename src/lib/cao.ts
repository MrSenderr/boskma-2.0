/* Het uurloon volgens de horeca-cao.
 *
 * Waarom dit in de app staat en niet in je hoofd: het jeugdloon hangt aan de
 * leeftijd, en die verandert op een verjaardag. Een bedrag dat je met de hand
 * invult is een bedrag dat je met de hand verkeerd kunt invullen, en te weinig
 * betalen merk je pas bij een controle — of helemaal niet.
 *
 * WAAR DEZE CIJFERS VANDAAN KOMEN
 * De loontabel van Koninklijke Horeca Nederland per 1 juli 2026, het blok
 * "Lonen niet-vakkrachten en BBL-studenten", functiegroep I+II, kolom "per
 * arbeidsuur". Te vinden op khn.nl onder de loontabellen bij de horeca-cao.
 *
 * WAT DEZE TABEL NIET WEET
 * — Een vakkracht (met horecadiploma of genoeg ervaring) heeft een hógere
 *   bodem: € 11,99 bij 18 jaar, € 13,49 bij 19, € 14,99 vanaf 20. De app weet
 *   niet wie vakkracht is, dus hij rekent met de gewone tabel. Voor iemand die
 *   wél vakkracht is ligt het werkelijke minimum dus hoger dan hier staat.
 * — Functiegroep V en hoger. Boskma kent twee functies: "Medewerker
 *   fastservice I" staat in de app als groep 2 en "II" als groep 3 — dus
 *   functiegroep II en III, niet alleen I+II. Dat mag hier samenvallen omdat
 *   het basisloon van groep I tot en met IV in deze tabel hetzelfde is
 *   (€ 14,99 per uur bij 21 jaar), zodat dezelfde jeugdpercentages op
 *   dezelfde bedragen uitkomen. Vanaf groep V loopt het uiteen (€ 15,21) en
 *   klopt deze tabel niet meer. Komt er ooit een functie in een hogere groep,
 *   dan moet dat hier eerst worden ingebouwd.
 * — De uurbedragen horen bij een week van 38 uur. Werkt iemand in een jaar
 *   meer uren dan de jaaruren waarop de cao rekent, dan moeten die uren
 *   minstens op het niveau van het wettelijk minimumloon worden betaald.
 *
 * WANNEER DIT WEER MOET WORDEN BIJGEWERKT
 * Bij elke nieuwe loontabel. Zet er dan een nieuwe TABEL bij met zijn eigen
 * `vanaf`; de oude blijft staan, zodat een contract van vorig jaar nog steeds
 * tegen het toen geldende bedrag wordt gelezen. Niet de bedragen in een
 * bestaande tabel overschrijven — dan verandert met terugwerkende kracht wat
 * er destijds hoorde te worden betaald.
 */

import { alsDag } from './datums'

export type Loontabel = {
  /** Vanaf welke dag deze bedragen gelden (JJJJ-MM-DD). */
  vanaf: string
  /** Waar de bedragen vandaan komen, in één regel. */
  bron: string
  /** Uurloon per leeftijd. De hoogste sleutel geldt ook voor alles erboven. */
  perLeeftijd: Record<number, number>
}

export const TABELLEN: Loontabel[] = [
  {
    vanaf: '2026-07-01',
    bron: 'KHN-loontabel per 1 juli 2026, niet-vakkrachten functiegroep I+II',
    perLeeftijd: {
      15: 5.25,
      16: 6.75,
      17: 8.24,
      18: 9.74,
      19: 11.24,
      20: 12.74,
      21: 14.99,
    },
  },
]

/** De tabel die op deze dag gold. Null als die dag vóór de oudste tabel ligt. */
export function tabelOp(datum: string): Loontabel | null {
  const kandidaten = TABELLEN.filter((t) => t.vanaf <= datum.slice(0, 10)).sort((a, b) =>
    b.vanaf.localeCompare(a.vanaf),
  )
  return kandidaten[0] ?? null
}

/** Hoe oud iemand is op een bepaalde dag — niet vandaag, maar op die dag. */
export function leeftijdOp(geboortedatum: string, datum: string): number | null {
  const g = alsDag(geboortedatum)
  const d = alsDag(datum)
  if (Number.isNaN(g.getTime()) || Number.isNaN(d.getTime())) return null
  let jaren = d.getFullYear() - g.getFullYear()
  const maanden = d.getMonth() - g.getMonth()
  if (maanden < 0 || (maanden === 0 && d.getDate() < g.getDate())) jaren--
  return jaren >= 0 && jaren < 130 ? jaren : null
}

export type CaoLoon = {
  bedrag: number
  leeftijd: number
  tabel: Loontabel
}

/* Wat de cao op een bepaalde dag voorschrijft.
 *
 * De dag doet ertoe en is daarom geen bijzaak die je mag vergeten: bij een
 * contract dat over drie weken ingaat telt de leeftijd op die ingangsdatum,
 * niet die van vandaag. Wie volgende week zestien wordt hoort niet nog een
 * jaar op het tarief van vijftien te blijven staan. */
export function caoUurloon(
  geboortedatum: string | null | undefined,
  opDatum: string,
): CaoLoon | null {
  if (!geboortedatum) return null
  const tabel = tabelOp(opDatum)
  if (!tabel) return null
  const leeftijd = leeftijdOp(geboortedatum, opDatum)
  if (leeftijd === null) return null

  const leeftijden = Object.keys(tabel.perLeeftijd).map(Number).sort((a, b) => a - b)
  const jongste = leeftijden[0]
  const oudste = leeftijden[leeftijden.length - 1]

  /* Onder de jongste trede zegt de cao niets. Dat is geen reden om maar iets
     te noemen: onder de vijftien hoort er een heel ander gesprek te worden
     gevoerd dan over een uurtarief. */
  if (leeftijd < jongste) return null

  const trede = Math.min(leeftijd, oudste)
  return { bedrag: tabel.perLeeftijd[trede], leeftijd, tabel }
}

/** Ligt dit bedrag onder wat de cao voorschrijft? */
export function onderCao(
  uurloon: number | null | undefined,
  geboortedatum: string | null | undefined,
  opDatum: string,
): CaoLoon | null {
  if (uurloon === null || uurloon === undefined || !Number.isFinite(uurloon)) return null
  const cao = caoUurloon(geboortedatum, opDatum)
  /* Een halve cent speling. Een tabel van € 8,24 tegenover een contract van
     € 8,2399 is geen onderbetaling maar een afronding, en een melding daarover
     leert je alleen om meldingen weg te klikken. */
  if (!cao || uurloon >= cao.bedrag - 0.005) return null
  return cao
}

/** € 8,24 — met een komma, zoals je het opschrijft. */
export function euro(bedrag: number): string {
  return `€ ${bedrag.toFixed(2).replace('.', ',')}`
}
