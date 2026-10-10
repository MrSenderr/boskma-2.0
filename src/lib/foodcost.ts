/* Kostprijs en foodcost van samenstellingen.

   Een samenstelling verwijst naar inkoopartikelen en naar andere
   samenstellingen, dus dit rekent van onderaf omhoog: eerst de
   gekarameliseerde ui, dan de burger waar hij in zit, dan het menu waar die
   burger in zit.

   Alles wordt in één keer ingeladen en daarna hier doorgerekend. Dat is niet
   alleen sneller, het maakt ook het opsporen van een kringetje mogelijk — een
   salade die zichzelf bevat zou anders eindeloos doorrekenen.

   Overgenomen uit de losse inkoop-app. */

import { getal } from './inkoop'
import type { Artikel } from './stuksprijzen'

export type Eenheid = 'stuk' | 'gram' | 'kilo' | 'ml' | 'liter' | 'verpakking' | 'portie'

export type Samenstelling = {
  id: number
  naam: string
  groep: string | null
  opbrengst: string
  eenheidnaam: string
  verkoopprijs: string | null
  btw_pct: number
  prijs_bron: string
  vet_opslag: boolean
  doel_foodcost: string | null
  notitie: string | null
}

export type SamenstellingRegel = {
  id: number
  samenstelling_id: number
  volgorde: number
  leverancier_id: number | null
  artikelnr: string | null
  onderdeel_id: number | null
  hoeveelheid: string
  eenheid: Eenheid
  notitie: string | null
}

export type Uitgewerkt = SamenstellingRegel & {
  naam: string
  isOnderdeel: boolean
  inhoud: string | null
  eenheidsprijs: number | null
  kosten: number | null
}

export type Berekend = Samenstelling & {
  regels: Uitgewerkt[]
  fouten: string[]
  ingredienten: number | null
  opslag: number
  kostprijs: number | null
  exclBtw: number | null
  percentage: number | null
  advies: number | null
  adviesVerschil: number | null
  marge: number | null
  doel: number
  teDuur: boolean
  gebruiktIn: { id: number; naam: string }[]
}

export type Doelen = {
  algemeen: number
  vetOpslag: number
  perGroep: Record<string, number>
}

/** Prijs per eenheid van een inkoopartikel, of niets als die niet te bepalen is. */
function artikelprijs(artikel: Artikel | undefined, eenheid: Eenheid): number | null {
  if (!artikel) return null
  if (eenheid === 'verpakking') return getal(artikel.prijs)
  if (eenheid === 'stuk') return artikel.perStuk
  if (eenheid === 'kilo') return artikel.perKilo
  if (eenheid === 'liter') return artikel.perLiter
  // Gram en ml rekenen op dezelfde kilo- en literprijs; alleen de schaal verschilt.
  if (eenheid === 'gram') return artikel.perKilo === null ? null : artikel.perKilo / 1000
  if (eenheid === 'ml') return artikel.perLiter === null ? null : artikel.perLiter / 1000
  return null
}

const REDEN: Partial<Record<Eenheid, string>> = {
  stuk: 'geen aantal per verpakking bekend',
  kilo: 'geen gewicht op de verpakking',
  gram: 'geen gewicht op de verpakking',
  liter: 'geen inhoud op de verpakking',
  ml: 'geen inhoud op de verpakking',
}

const KRINGETJE = 'verwijst naar zichzelf'

export function sleutelVan(leverancierId: number | null, artikelnr: string | null): string {
  return `${leverancierId}|${artikelnr}`
}

/* Het eigen doel van het product gaat voor, dan dat van de groep, dan het
   algemene. Een frikandel en een Magnum horen niet op hetzelfde percentage. */
function doelVan(s: Samenstelling, doelen: Doelen): number {
  if (s.doel_foodcost !== null) return getal(s.doel_foodcost)
  if (s.groep && doelen.perGroep[s.groep] !== undefined) return doelen.perGroep[s.groep]
  return doelen.algemeen
}

export function bereken(
  samenstellingen: Samenstelling[],
  regels: SamenstellingRegel[],
  artikelen: Artikel[],
  doelen: Doelen,
): Berekend[] {
  const perArtikel = new Map(artikelen.map((a) => [sleutelVan(a.leverancier_id, a.artikelnr), a]))

  const perId = new Map<number, Samenstelling & { regels: SamenstellingRegel[] }>(
    samenstellingen.map((s) => [s.id, { ...s, regels: [] }]),
  )
  for (const r of [...regels].sort((a, b) => a.volgorde - b.volgorde || a.id - b.id)) {
    perId.get(r.samenstelling_id)?.regels.push(r)
  }

  const klaar = new Map<number, Berekend>()
  const bezig = new Set<number>()
  /* Wie onderweg zichzelf tegenkwam. Dat moet apart bijgehouden: de uitkomst
     van de buitenste ronde overschrijft straks de markering, en dan blijft er
     "X heeft zelf geen kostprijs" staan — waar is dat heen is dan niet te
     zien. */
  const kringen = new Set<number>()

  function reken(id: number): Berekend | null {
    const gereed = klaar.get(id)
    if (gereed) return gereed
    const s = perId.get(id)
    if (!s) return null

    // Kringetje: een samenstelling die zichzelf via een omweg bevat.
    if (bezig.has(id)) {
      kringen.add(id)
      const uit: Berekend = {
        ...s,
        regels: [],
        fouten: [KRINGETJE],
        ingredienten: null,
        opslag: 0,
        kostprijs: null,
        exclBtw: null,
        percentage: null,
        advies: null,
        adviesVerschil: null,
        marge: null,
        doel: doelVan(s, doelen),
        teDuur: false,
        gebruiktIn: [],
      }
      klaar.set(id, uit)
      return uit
    }
    bezig.add(id)

    const fouten: string[] = []
    const uitgewerkt: Uitgewerkt[] = s.regels.map((r) => {
      const hoeveel = getal(r.hoeveelheid)

      if (r.onderdeel_id !== null) {
        const onder = reken(r.onderdeel_id)
        const perPortie = onder?.kostprijs ?? null
        if (perPortie === null) {
          fouten.push(`${onder?.naam ?? 'onderdeel'} heeft zelf geen kostprijs`)
        }
        return {
          ...r,
          naam: onder?.naam ?? '(onbekend)',
          isOnderdeel: true,
          inhoud: null,
          eenheidsprijs: perPortie,
          kosten: perPortie === null ? null : hoeveel * perPortie,
        }
      }

      const artikel = perArtikel.get(sleutelVan(r.leverancier_id, r.artikelnr))
      const eenheidsprijs = artikelprijs(artikel, r.eenheid)
      if (!artikel) fouten.push(`${r.artikelnr} is niet op een factuur teruggevonden`)
      else if (eenheidsprijs === null) {
        fouten.push(`${artikel.naam}: ${REDEN[r.eenheid] ?? 'prijs onbekend'}`)
      }
      return {
        ...r,
        naam: artikel?.naam ?? r.artikelnr ?? '(onbekend)',
        isOnderdeel: false,
        inhoud: artikel?.inhoud ?? null,
        eenheidsprijs,
        kosten: eenheidsprijs === null ? null : hoeveel * eenheidsprijs,
      }
    })

    const compleet = uitgewerkt.length > 0 && uitgewerkt.every((r) => r.kosten !== null)
    const ingredienten = compleet ? uitgewerkt.reduce((a, r) => a + (r.kosten as number), 0) : null
    const opslag = ingredienten !== null && s.vet_opslag ? ingredienten * doelen.vetOpslag : 0
    const kostprijs = ingredienten === null ? null : (ingredienten + opslag) / getal(s.opbrengst)

    // Foodcost rekent over de prijs zonder btw: de btw is niet van jou.
    const exclBtw =
      s.verkoopprijs === null ? null : getal(s.verkoopprijs) / (1 + s.btw_pct / 100)
    const percentage = kostprijs === null || !exclBtw ? null : kostprijs / exclBtw

    /* Adviesprijs: wat moet dit kosten om je doel te halen. Naar boven op vijf
       cent, want € 10,39 zet je niet op een menubord — en naar beneden afronden
       zou je marge kosten. */
    const doel = doelVan(s, doelen)
    const advies =
      kostprijs === null ? null : Math.ceil((kostprijs / doel) * (1 + s.btw_pct / 100) * 20) / 20

    const uit: Berekend = {
      ...s,
      regels: uitgewerkt,
      fouten,
      ingredienten,
      opslag,
      kostprijs,
      exclBtw,
      percentage,
      advies,
      // Positief betekent: je vraagt te weinig ten opzichte van je doel.
      adviesVerschil:
        advies === null || s.verkoopprijs === null ? null : advies - getal(s.verkoopprijs),
      marge: kostprijs === null || exclBtw === null ? null : exclBtw - kostprijs,
      doel,
      teDuur: percentage !== null && percentage > doel,
      gebruiktIn: [],
    }
    bezig.delete(id)
    klaar.set(id, uit)
    return uit
  }

  const alles = samenstellingen.map((s) => reken(s.id)).filter((s): s is Berekend => s !== null)

  for (const s of alles) {
    if (kringen.has(s.id) && !s.fouten.includes(KRINGETJE)) s.fouten.unshift(KRINGETJE)
  }

  /* Waar wordt een samenstelling in gebruikt? Dat is wat een prijsverhoging
     raakt: gaat ui omhoog, dan zie je meteen welke producten dat voelen. */
  const gebruikt = new Map<number, { id: number; naam: string }[]>()
  for (const s of alles) {
    for (const r of s.regels) {
      if (r.onderdeel_id === null) continue
      const lijst = gebruikt.get(r.onderdeel_id) ?? []
      lijst.push({ id: s.id, naam: s.naam })
      gebruikt.set(r.onderdeel_id, lijst)
    }
  }
  for (const s of alles) s.gebruiktIn = gebruikt.get(s.id) ?? []

  return alles
}

/* Welke producten raakt een prijsverhoging van dit artikel? Loopt de boom van
   onderaf omhoog, dus ook via tussenstappen: ui zit in gekarameliseerde ui, en
   die zit in de burger. */
export function geraaktDoorArtikel(
  alles: Berekend[],
  leverancierId: number,
  artikelnr: string,
): Berekend[] {
  const geraakt = new Set<number>()
  for (const s of alles) {
    for (const r of s.regels) {
      if (!r.isOnderdeel && r.leverancier_id === leverancierId && r.artikelnr === artikelnr) {
        geraakt.add(s.id)
      }
    }
  }

  let gegroeid = true
  while (gegroeid) {
    gegroeid = false
    for (const s of alles) {
      if (geraakt.has(s.id)) continue
      if (s.regels.some((r) => r.isOnderdeel && r.onderdeel_id !== null && geraakt.has(r.onderdeel_id))) {
        geraakt.add(s.id)
        gegroeid = true
      }
    }
  }
  return alles.filter((s) => geraakt.has(s.id))
}
