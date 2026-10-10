/* Het rekenwerk achter de prijsmutaties. Hier wordt bepaald wat er bovenaan
   komt te staan, dus hier mag niets scheef gaan. */

import { describe, expect, it } from 'vitest'
import {
  GRAFIEK,
  grafiek,
  normalePrijs,
  procent,
  verdeel,
  verschil,
  type Meting,
  type Prijsmutatie,
} from './prijzen'

const mutatie = (m: Partial<Prijsmutatie>): Prijsmutatie => ({
  leverancier_id: 1,
  leveranciernaam: 'Veldboer Eenhoorn',
  artikelnr: '603845',
  omschrijving: 'Tomaten maat B',
  merk: null,
  eerste: '1.95',
  laatste: '3.95',
  laagste: '1.95',
  hoogste: '3.95',
  van: '2026-07-03',
  tot: '2026-10-09',
  keer_gekocht: 8,
  laatste_was_actie: false,
  eerste_was_actie: false,
  normale_prijs: null,
  keer_op_actie: 0,
  totaal_aantal: '10',
  impact: '20.00',
  ...m,
})

const meting = (m: Partial<Meting>): Meting => ({
  id: 1,
  factuurdatum: '2026-07-03',
  factuurnummer: 'F628288',
  prijs: '1.95',
  aantal: '1',
  bedrag: '1.95',
  eenheid: 'Per kilo',
  artikelnaam: 'Tomaten maat B',
  merk: null,
  artikelinhoud: null,
  artikelnr: '603845',
  op_bestellijst: true,
  leverancier_id: 1,
  actie: false,
  ...m,
})

describe('het verschil tussen toen en nu', () => {
  it('rekent in euro en in procent', () => {
    const m = mutatie({ eerste: '1.95', laatste: '3.95' })
    expect(verschil(m)).toBeCloseTo(2, 2)
    expect(procent(m)).toBeCloseTo(102.56, 1)
  })

  it('gaat niet onderuit op een beginprijs van nul', () => {
    expect(procent(mutatie({ eerste: '0', laatste: '2.00' }))).toBe(0)
  })
})

describe('duurder en goedkoper uit elkaar halen', () => {
  const lijst = [
    mutatie({ artikelnr: 'klein', impact: '3.00' }),
    mutatie({ artikelnr: 'groot', impact: '120.00' }),
    mutatie({ artikelnr: 'korting', impact: '-80.00' }),
  ]

  /* Op impact, niet op percentage: frites die een dubbeltje stijgen kosten je
     meer dan een zeldzaam artikel dat 40% duurder wordt. */
  it('zet de zwaarste bovenaan, ook bij goedkoper', () => {
    const { omhoog, omlaag } = verdeel(lijst)
    expect(omhoog.map((m) => m.artikelnr)).toEqual(['groot', 'klein'])
    expect(omlaag.map((m) => m.artikelnr)).toEqual(['korting'])
  })

  it('telt het saldo over alles bij elkaar', () => {
    expect(verdeel(lijst).saldo).toBeCloseTo(43, 2)
  })

  it('laat de meegegeven lijst met rust', () => {
    const origineel = [...lijst]
    verdeel(lijst)
    expect(lijst).toEqual(origineel)
  })
})

describe('de gewone prijs', () => {
  it('is het gemiddelde van de keren zonder actie', () => {
    expect(
      normalePrijs([
        meting({ prijs: '2.00' }),
        meting({ prijs: '1.00', actie: true }),
        meting({ prijs: '3.00' }),
      ]),
    ).toBeCloseTo(2.5, 2)
  })

  /* Alleen maar actieprijzen gezien: dan weten we niet waar hij naartoe
     springt als de actie afloopt, en dat verzinnen we niet. */
  it('is onbekend als je het artikel alleen in de actie kocht', () => {
    expect(normalePrijs([meting({ prijs: '1.00', actie: true })])).toBeNull()
    expect(normalePrijs([])).toBeNull()
  })
})

describe('de grafiek van het prijsverloop', () => {
  const metingen = [meting({ id: 1, prijs: '2.00' }), meting({ id: 2, prijs: '4.00' })]

  it('zet het eerste punt links en het laatste rechts', () => {
    const g = grafiek(metingen, null)
    expect(g.punten[0].x).toBeCloseTo(GRAFIEK.rand, 1)
    expect(g.punten[1].x).toBeCloseTo(GRAFIEK.breedte - GRAFIEK.rand, 1)
  })

  it('zet een hogere prijs hoger in beeld', () => {
    const g = grafiek(metingen, null)
    expect(g.punten[1].y).toBeLessThan(g.punten[0].y)
  })

  it('schrijft een lijn die bij het eerste punt begint', () => {
    expect(grafiek(metingen, null).lijn).toMatch(/^M26\.0,/)
  })

  /* Met marge boven en onder, anders plakt een vlakke lijn tegen de rand en
     lijkt een cent verschil een aardverschuiving. */
  it('houdt lucht boven en onder', () => {
    const g = grafiek(metingen, null)
    expect(g.punten[1].y).toBeGreaterThan(GRAFIEK.rand - 0.001)
    expect(g.punten[0].y).toBeLessThan(GRAFIEK.hoogte - GRAFIEK.rand + 0.001)
  })

  it('legt de gewone prijs op dezelfde schaal', () => {
    const g = grafiek(metingen, 2)
    expect(g.normaalY).toBeCloseTo(g.punten[0].y, 1)
  })

  it('laat de lijn van de gewone prijs weg als die onbekend is', () => {
    expect(grafiek(metingen, null).normaalY).toBeNull()
  })

  it('struikelt niet over één enkele meting', () => {
    const g = grafiek([meting({ prijs: '2.00' })], null)
    expect(g.punten).toHaveLength(1)
    expect(Number.isFinite(g.punten[0].x)).toBe(true)
    expect(Number.isFinite(g.punten[0].y)).toBe(true)
  })

  it('struikelt niet over helemaal geen metingen', () => {
    const g = grafiek([], null)
    expect(g.punten).toEqual([])
    expect(g.lijn).toBe('')
  })
})
