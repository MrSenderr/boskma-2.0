/* Verpakkingsinhoud omrekenen naar aantallen, kilo's en liters.

   De kern: het laatste getal is de maat van de kleinste eenheid, alles ervoor
   telt op tot het aantal eenheden. "4x6x33 cl" is dus 24 flesjes van 33 cl.

   Let op bulk. "2x5 kilo" is niet tien losse dingen maar twee zakken van vijf
   kilo. Per stuk is hier dus per zák, en dat is zelden het getal dat je wilt —
   daar hoort de kilokolom bij.

   Overgenomen uit de losse inkoop-app, inclusief de gevallen die daar als
   zelftest in het bestand stonden. */

type Eenheidsoort = 'massa' | 'volume' | 'aantal' | 'lengte'

type Eenheid = { soort: Eenheidsoort; naarKilo?: number; naarLiter?: number }

const EENHEDEN: Record<string, Eenheid> = {
  gram: { soort: 'massa', naarKilo: 0.001 },
  kg: { soort: 'massa', naarKilo: 1 },
  kilo: { soort: 'massa', naarKilo: 1 },
  ml: { soort: 'volume', naarLiter: 0.001 },
  cl: { soort: 'volume', naarLiter: 0.01 },
  l: { soort: 'volume', naarLiter: 1 },
  liter: { soort: 'volume', naarLiter: 1 },
  stuk: { soort: 'aantal' },
  stuks: { soort: 'aantal' },
  zakken: { soort: 'aantal' },
  vaks: { soort: 'aantal' },
  meter: { soort: 'lengte' },
}

const getal = (s: string) => Number(String(s).replace(',', '.'))

export type Verpakking = {
  /** Hoeveel losse eenheden er in de verpakking zitten. */
  eenheden: number | null
  kilo: number | null
  liter: number | null
  /** De maat van één eenheid, zoals "85 gram". */
  perEenheid: string | null
  eenheidnaam: string | null
  /** Waar als één eenheid zelf een kilo of liter of meer is: dan is de prijs
   *  per stuk de prijs van een hele zak of emmer, niet van een portie. */
  bulk: boolean
  /** Gezet bij "Per kilo" of "Per stuk": dan valt er niets om te rekenen. */
  losverkocht?: 'kilo' | 'stuk'
  losnaam?: string
}

export function ontleed(inhoud: string | null | undefined): Verpakking | null {
  if (!inhoud) return null
  const tekst = String(inhoud).trim().toLowerCase()

  /* "Per kilo", "Per stuk", "Per bos": de prijs op de factuur is al de prijs
     per eenheid. Alles wat geen kilo is telt als stuk — een bos bieslook is
     nu eenmaal een bos. */
  const los = tekst.match(/^per\s+([a-z]+)$/)
  if (los) {
    return {
      eenheden: null,
      kilo: null,
      liter: null,
      perEenheid: null,
      eenheidnaam: null,
      bulk: false,
      losverkocht: /^(kilo|kg)$/.test(los[1]) ? 'kilo' : 'stuk',
      losnaam: los[1],
    }
  }

  const m = tekst.match(
    /^(\d+(?:[.,]\d+)?)(?:\s*x\s*(\d+(?:[.,]\d+)?))?(?:\s*x\s*(\d+(?:[.,]\d+)?))?\s*([a-z]+)\.?$/,
  )
  if (!m) return null

  const eenheid = EENHEDEN[m[4]]
  if (!eenheid) return null

  const getallen = [m[1], m[2], m[3]].filter(Boolean).map((g) => getal(g as string))
  const maat = getallen[getallen.length - 1]
  const stuks = getallen.slice(0, -1).reduce((a, b) => a * b, 1)

  // Bij "500 stuks" of "15 zakken" is het getal zelf het aantal, geen maat.
  if (eenheid.soort === 'aantal') {
    return {
      eenheden: getallen.reduce((a, b) => a * b, 1),
      kilo: null,
      liter: null,
      perEenheid: null,
      eenheidnaam: m[4],
      bulk: false,
    }
  }

  if (eenheid.soort === 'lengte') {
    return {
      eenheden: stuks,
      kilo: null,
      liter: null,
      perEenheid: `${maat} meter`,
      eenheidnaam: 'meter',
      bulk: false,
    }
  }

  const kilo = eenheid.naarKilo ? stuks * maat * eenheid.naarKilo : null
  const liter = eenheid.naarLiter ? stuks * maat * eenheid.naarLiter : null
  const maatPerStuk = eenheid.naarKilo ? maat * eenheid.naarKilo : maat * (eenheid.naarLiter ?? 0)

  return {
    eenheden: stuks,
    kilo,
    liter,
    perEenheid: `${String(maat).replace('.', ',')} ${m[4]}`,
    eenheidnaam: m[4],
    bulk: maatPerStuk >= 1,
  }
}

export type Kostprijzen = {
  perStuk: number | null
  perKilo: number | null
  perLiter: number | null
  verpakking: Verpakking | null
}

/** Kostprijzen uit een verpakkingsprijs. */
export function kostprijzen(
  prijs: number | null | undefined,
  inhoud: string | null | undefined,
): Kostprijzen {
  const v = ontleed(inhoud)
  if (prijs === null || prijs === undefined || !v) {
    return { perStuk: null, perKilo: null, perLiter: null, verpakking: v }
  }
  if (v.losverkocht === 'kilo') {
    return { perStuk: null, perKilo: prijs, perLiter: null, verpakking: v }
  }
  if (v.losverkocht === 'stuk') {
    return { perStuk: prijs, perKilo: null, perLiter: null, verpakking: v }
  }
  return {
    perStuk: v.eenheden ? prijs / v.eenheden : null,
    perKilo: v.kilo ? prijs / v.kilo : null,
    perLiter: v.liter ? prijs / v.liter : null,
    verpakking: v,
  }
}

/* Wat zou je voor één stuk moeten vragen om je foodcost-doel te halen.

   Inclusief btw en naar boven afgerond op vijf cent — je hangt geen prijs van
   € 2,37 aan de muur. Bij bulk heeft dit geen betekenis: de prijs per stuk is
   daar de prijs van een hele emmer. */
export function adviesprijs(
  perStuk: number | null,
  doel: number,
  btw: number,
): number | null {
  if (perStuk === null || doel <= 0) return null
  return Math.ceil((perStuk / doel) * (1 + btw) * 20) / 20
}
