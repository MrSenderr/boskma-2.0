/* Het rekenwerk achter de kostprijs van een product. Hier komt alles samen:
   de verpakking van een inkoopartikel, een recept dat in een ander recept zit,
   en het doel waartegen je het afmeet. Een fout hier zie je terug op je
   menubord. */

import { describe, expect, it } from 'vitest'
import { bereken, geraaktDoorArtikel, type Samenstelling, type SamenstellingRegel } from './foodcost'
import { metKostprijzen, type Artikel, type LaatstePrijs } from './stuksprijzen'

const DOELEN = { algemeen: 0.28, vetOpslag: 0.03, perGroep: { Burgers: 0.3 } }

const prijs = (p: Partial<LaatstePrijs>): LaatstePrijs => ({
  leverancier_id: 1,
  leveranciernaam: 'Veldboer Eenhoorn',
  artikelnr: '000',
  naam: 'Iets',
  merk: null,
  inhoud: 'Per kilo',
  eenheid: 'Kilo',
  prijs: '10.00',
  factuurdatum: '2026-10-09',
  factuurnummer: 'F1',
  op_bestellijst: true,
  groep: null,
  ...p,
})

const artikelen = (lijst: Partial<LaatstePrijs>[]): Artikel[] =>
  metKostprijzen(lijst.map(prijs)).bekend.concat(metKostprijzen(lijst.map(prijs)).onbekend)

const product = (s: Partial<Samenstelling>): Samenstelling => ({
  id: 1,
  naam: 'Classic burger',
  groep: 'Burgers',
  opbrengst: '1',
  eenheidnaam: 'portie',
  verkoopprijs: '9.95',
  btw_pct: 9,
  prijs_bron: 'handmatig',
  vet_opslag: false,
  doel_foodcost: null,
  notitie: null,
  ...s,
})

const regel = (r: Partial<SamenstellingRegel>): SamenstellingRegel => ({
  id: 1,
  samenstelling_id: 1,
  volgorde: 0,
  leverancier_id: 1,
  artikelnr: '000',
  onderdeel_id: null,
  hoeveelheid: '1',
  eenheid: 'stuk',
  notitie: null,
  ...r,
})

describe('de kostprijs van een product', () => {
  it('telt de regels op en deelt door de opbrengst', () => {
    const uit = bereken(
      [product({ opbrengst: '2' })],
      [
        regel({ id: 1, artikelnr: 'brood', hoeveelheid: '2', eenheid: 'stuk' }),
        regel({ id: 2, artikelnr: 'vlees', hoeveelheid: '400', eenheid: 'gram' }),
      ],
      artikelen([
        { artikelnr: 'brood', naam: 'Broodje', inhoud: '12 stuks', prijs: '6.00' },
        { artikelnr: 'vlees', naam: 'Rundergehakt', inhoud: 'Per kilo', prijs: '12.00' },
      ]),
      DOELEN,
    )
    // 2 broodjes à € 0,50 + 400 gram à € 0,012 = € 1,00 + € 4,80, gedeeld door 2
    expect(uit[0].ingredienten).toBeCloseTo(5.8, 4)
    expect(uit[0].kostprijs).toBeCloseTo(2.9, 4)
  })

  /* Foodcost rekent over de prijs zonder btw: de btw is niet van jou. */
  it('rekent de foodcost over de prijs zonder btw', () => {
    const uit = bereken(
      [product({ verkoopprijs: '10.90', btw_pct: 9 })],
      [regel({ artikelnr: 'brood', hoeveelheid: '1', eenheid: 'stuk' })],
      artikelen([{ artikelnr: 'brood', naam: 'Broodje', inhoud: '10 stuks', prijs: '20.00' }]),
      DOELEN,
    )
    expect(uit[0].exclBtw).toBeCloseTo(10, 2)
    expect(uit[0].percentage).toBeCloseTo(0.2, 3)
  })

  it('gebruikt het doel van de groep, en het eigen doel gaat daar nog boven', () => {
    const [metGroep] = bereken([product({})], [], [], DOELEN)
    expect(metGroep.doel).toBe(0.3)

    const [metEigen] = bereken([product({ doel_foodcost: '0.45' })], [], [], DOELEN)
    expect(metEigen.doel).toBe(0.45)

    const [zonder] = bereken([product({ groep: 'Snacks' })], [], [], DOELEN)
    expect(zonder.doel).toBe(0.28)
  })

  it('telt de opslag voor frituurvet alleen mee als die aanstaat', () => {
    const regels = [regel({ artikelnr: 'frites', hoeveelheid: '1', eenheid: 'kilo' })]
    const lijst = artikelen([
      { artikelnr: 'frites', naam: 'Frites', inhoud: 'Per kilo', prijs: '2.00' },
    ])
    expect(bereken([product({ vet_opslag: false })], regels, lijst, DOELEN)[0].kostprijs).toBeCloseTo(2, 4)
    expect(bereken([product({ vet_opslag: true })], regels, lijst, DOELEN)[0].kostprijs).toBeCloseTo(2.06, 4)
  })

  /* Naar boven op vijf cent: € 10,39 zet je niet op een menubord, en naar
     beneden afronden kost je marge. */
  it('adviseert een prijs die op vijf cent uitkomt', () => {
    const uit = bereken(
      [product({ doel_foodcost: '0.3', btw_pct: 9, verkoopprijs: '9.95' })],
      [regel({ artikelnr: 'x', hoeveelheid: '1', eenheid: 'stuk' })],
      artikelen([{ artikelnr: 'x', naam: 'Iets', inhoud: 'Per stuk', prijs: '3.00' }]),
      DOELEN,
    )
    // 3,00 / 0,30 = 10,00 excl → 10,90 incl → al rond, blijft 10,90
    expect(uit[0].advies).toBeCloseTo(10.9, 2)
    expect(uit[0].adviesVerschil).toBeCloseTo(0.95, 2)
    expect(uit[0].teDuur).toBe(true)
  })
})

describe('wat er misgaat', () => {
  /* Eén regel zonder prijs maakt de hele kostprijs onbetrouwbaar. Dan liever
     geen getal dan een getal dat te laag is. */
  it('geeft geen kostprijs als één regel geen prijs heeft', () => {
    const uit = bereken(
      [product({})],
      [
        regel({ id: 1, artikelnr: 'bekend', hoeveelheid: '1', eenheid: 'stuk' }),
        regel({ id: 2, artikelnr: 'onbekend', hoeveelheid: '1', eenheid: 'stuk' }),
      ],
      artikelen([{ artikelnr: 'bekend', naam: 'Iets', inhoud: 'Per stuk', prijs: '1.00' }]),
      DOELEN,
    )
    expect(uit[0].kostprijs).toBeNull()
    expect(uit[0].fouten).toContain('onbekend is niet op een factuur teruggevonden')
  })

  it('zegt waaróm een eenheid niet uit te rekenen is', () => {
    const uit = bereken(
      [product({})],
      [regel({ artikelnr: 'x', hoeveelheid: '100', eenheid: 'gram' })],
      artikelen([{ artikelnr: 'x', naam: 'Losse bos', inhoud: 'Per bos', prijs: '2.00' }]),
      DOELEN,
    )
    expect(uit[0].fouten[0]).toContain('geen gewicht op de verpakking')
  })

  it('geeft geen kostprijs aan een product zonder regels', () => {
    expect(bereken([product({})], [], [], DOELEN)[0].kostprijs).toBeNull()
  })
})

describe('een recept in een recept', () => {
  const lijst = artikelen([
    { artikelnr: 'ui', naam: 'Uien', inhoud: 'Per kilo', prijs: '2.00' },
    { artikelnr: 'brood', naam: 'Broodje', inhoud: '10 stuks', prijs: '5.00' },
  ])

  const gekarameliseerd = product({ id: 2, naam: 'Gekarameliseerde ui', opbrengst: '10', verkoopprijs: null })
  const burger = product({ id: 1, naam: 'Classic burger' })

  const regels = [
    regel({ id: 1, samenstelling_id: 2, artikelnr: 'ui', hoeveelheid: '1', eenheid: 'kilo' }),
    regel({ id: 2, samenstelling_id: 1, artikelnr: 'brood', hoeveelheid: '1', eenheid: 'stuk' }),
    regel({ id: 3, samenstelling_id: 1, artikelnr: null, onderdeel_id: 2, hoeveelheid: '2', eenheid: 'portie' }),
  ]

  it('rekent van onderaf omhoog', () => {
    const uit = bereken([burger, gekarameliseerd], regels, lijst, DOELEN)
    const ui = uit.find((s) => s.id === 2)!
    const b = uit.find((s) => s.id === 1)!
    expect(ui.kostprijs).toBeCloseTo(0.2, 4) // 1 kilo à € 2,00, tien porties
    expect(b.kostprijs).toBeCloseTo(0.5 + 0.4, 4) // broodje € 0,50 + 2 × € 0,20
  })

  it('onthoudt waar een onderdeel in gebruikt wordt', () => {
    const uit = bereken([burger, gekarameliseerd], regels, lijst, DOELEN)
    expect(uit.find((s) => s.id === 2)!.gebruiktIn).toEqual([{ id: 1, naam: 'Classic burger' }])
  })

  it('wijst aan welke producten een duurder artikel raakt, ook via een omweg', () => {
    const uit = bereken([burger, gekarameliseerd], regels, lijst, DOELEN)
    const geraakt = geraaktDoorArtikel(uit, 1, 'ui').map((s) => s.naam)
    expect(geraakt).toContain('Gekarameliseerde ui')
    expect(geraakt).toContain('Classic burger')
  })

  /* Een salade die zichzelf bevat zou eindeloos doorrekenen. Dan liever een
     nette melding. */
  it('loopt niet vast op een product dat zichzelf bevat', () => {
    const a = product({ id: 1, naam: 'A' })
    const b = product({ id: 2, naam: 'B' })
    const uit = bereken(
      [a, b],
      [
        regel({ id: 1, samenstelling_id: 1, artikelnr: null, onderdeel_id: 2, eenheid: 'portie' }),
        regel({ id: 2, samenstelling_id: 2, artikelnr: null, onderdeel_id: 1, eenheid: 'portie' }),
      ],
      [],
      DOELEN,
    )
    expect(uit.some((s) => s.fouten.includes('verwijst naar zichzelf'))).toBe(true)
    expect(uit.every((s) => s.kostprijs === null)).toBe(true)
  })
})
