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
 * TWEE BODEMS VANAF ACHTTIEN
 * Een vakkracht heeft recht op het basisloon van zijn functiegroep, wie dat
 * niet is valt onder de lagere staffel. Bij 18 jaar scheelt dat € 9,74 tegen
 * € 11,99, bij 19 € 11,24 tegen € 13,49, bij 20 € 12,74 tegen € 14,99. Vanaf
 * 21 lopen ze weer gelijk en doet het onderscheid er niet meer toe; onder de
 * 18 bestaat een vakkracht niet.
 *
 * WAT DEZE TABEL NIET WEET
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
  /** Hetzelfde voor wie vakkracht is. Begint bij 18; daaronder bestaat het niet. */
  vakkrachtPerLeeftijd: Record<number, number>
}

export const TABELLEN: Loontabel[] = [
  {
    vanaf: '2026-07-01',
    bron: 'KHN-loontabel per 1 juli 2026, functiegroep I+II',
    perLeeftijd: {
      15: 5.25,
      16: 6.75,
      17: 8.24,
      18: 9.74,
      19: 11.24,
      20: 12.74,
      21: 14.99,
    },
    /* "Basislonen vakkrachten per uur" uit diezelfde tabel: 80% bij 18 jaar,
       90% bij 19, en vanaf 20 het hele basisloon. Onder de 18 staat er niets,
       want dan kun je geen vakkracht zijn. */
    vakkrachtPerLeeftijd: {
      18: 11.99,
      19: 13.49,
      20: 14.99,
    },
  },
]

/** Hoeveel uur ervaring na je achttiende je vakkracht maakt. */
export const VAKKRACHT_UREN = 1976

export type Vakkracht = 'nee' | 'diploma' | 'ervaring'

export const VAKKRACHT_REDEN: Record<Vakkracht, string> = {
  nee: 'Geen vakkracht',
  diploma: 'Vakkracht — erkend vakdiploma',
  ervaring: `Vakkracht — ${VAKKRACHT_UREN.toLocaleString('nl-NL')} uur ervaring`,
}

/* Gold deze persoon op die dag als vakkracht?
 *
 * De dag doet ertoe. Wie in maart zijn diploma haalde was in februari nog
 * geen vakkracht, en een contract uit januari hoort niet met terugwerkende
 * kracht tegen de hogere bodem te worden gelezen. */
export function isVakkracht(
  p: { vakkracht?: string | null; vakkracht_sinds?: string | null },
  opDatum: string,
): boolean {
  if (!p.vakkracht || p.vakkracht === 'nee') return false
  if (!p.vakkracht_sinds) return true
  return p.vakkracht_sinds.slice(0, 10) <= opDatum.slice(0, 10)
}

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
  vakkracht = false,
): CaoLoon | null {
  if (!geboortedatum) return null
  const tabel = tabelOp(opDatum)
  if (!tabel) return null
  const leeftijd = leeftijdOp(geboortedatum, opDatum)
  if (leeftijd === null) return null

  const staffel = vakkracht ? tabel.vakkrachtPerLeeftijd : tabel.perLeeftijd
  const leeftijden = Object.keys(staffel).map(Number).sort((a, b) => a - b)
  const jongste = leeftijden[0]
  const oudste = leeftijden[leeftijden.length - 1]

  /* Onder de jongste trede zegt de cao niets. Dat is geen reden om maar iets
     te noemen: onder de vijftien hoort er een heel ander gesprek te worden
     gevoerd dan over een uurtarief, en onder de achttien bestaat een
     vakkracht niet. */
  if (leeftijd < jongste) return null

  const trede = Math.min(leeftijd, oudste)
  return { bedrag: staffel[trede], leeftijd, tabel }
}

/* Doet het ertoe of deze persoon vakkracht is?
 *
 * Alleen bij 18, 19 en 20. Daaronder bestaat een vakkracht niet, daarboven
 * zijn de twee bodems gelijk. De vraag stellen bij een zestienjarige of bij
 * Ilona van 41 is dus niet voorzichtig maar verwarrend. */
export function vakkrachtDoetErtoe(
  geboortedatum: string | null | undefined,
  opDatum: string,
): boolean {
  if (!geboortedatum) return false
  const gewoon = caoUurloon(geboortedatum, opDatum, false)
  const vak = caoUurloon(geboortedatum, opDatum, true)
  return gewoon !== null && vak !== null && gewoon.bedrag !== vak.bedrag
}

/** Ligt dit bedrag onder wat de cao voorschrijft? */
export function onderCao(
  uurloon: number | null | undefined,
  geboortedatum: string | null | undefined,
  opDatum: string,
  vakkracht = false,
): CaoLoon | null {
  if (uurloon === null || uurloon === undefined || !Number.isFinite(uurloon)) return null
  const cao = caoUurloon(geboortedatum, opDatum, vakkracht)
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
