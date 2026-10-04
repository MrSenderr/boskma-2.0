/* Geld telt niet half. Daarom staat het rekenwerk los van het scherm en wordt
   het hier getoetst, inclusief de weergave in euro's. */

import { describe, expect, it } from 'vitest'
import {
  COUPURES,
  LEEG,
  bedrag,
  coupureNaam,
  ergensTeveel,
  euro,
  inLade,
  telOp,
  teveelNaarKluis,
  totalen,
  vandaagInWoorden,
  type Aantallen,
} from './kas'

const telling = (stuks: Record<number, number>): Aantallen => ({ ...LEEG, ...stuks })

describe('de coupures', () => {
  it('staan van groot naar klein', () => {
    const centen = COUPURES.map((c) => c.centen)
    expect(centen).toEqual([5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5])
  })

  it('zijn vier biljetten en zes munten', () => {
    expect(COUPURES.filter((c) => c.soort === 'biljet')).toHaveLength(4)
    expect(COUPURES.filter((c) => c.soort === 'munt')).toHaveLength(6)
  })

  it('heten zoals je ze noemt', () => {
    expect(coupureNaam(5000)).toBe('€ 50')
    expect(coupureNaam(100)).toBe('€ 1')
    expect(coupureNaam(50)).toBe('€ 0,50')
    expect(coupureNaam(5)).toBe('€ 0,05')
  })
})

describe('bedragen in euro', () => {
  /* Tussen het euroteken en het bedrag staat een vaste spatie (U+00A0), geen
     gewone. Dat is met opzet: zo breekt "€ 1.234,55" nooit over twee regels.
     Ze zien er hetzelfde uit, dus hier staat hij expliciet. */
  const E = '\u00A0'

  it('zet een vaste spatie achter het euroteken', () => {
    expect(euro(100)).toBe(`€${E}1,00`)
    expect(euro(100)).not.toBe('€ 1,00')
  })

  it('schrijft Nederlands, met een punt voor de duizendtallen', () => {
    expect(euro(123455)).toBe(`€${E}1.234,55`)
  })

  it('houdt twee cijfers achter de komma', () => {
    expect(euro(500)).toBe(`€${E}5,00`)
    expect(euro(5)).toBe(`€${E}0,05`)
    expect(euro(0)).toBe(`€${E}0,00`)
  })
})

describe('optellen', () => {
  it('rekent een coupure om naar een bedrag', () => {
    expect(bedrag(telling({ 5000: 3 }), 5000)).toBe(15000)
  })

  it('negeert een leeg of onzinnig aantal', () => {
    expect(bedrag(telling({ 5000: -2 }), 5000)).toBe(0)
    expect(bedrag({} as Aantallen, 5000)).toBe(0)
  })

  it('telt alleen de biljetten als je daarom vraagt', () => {
    const t = telling({ 5000: 2, 200: 3 })
    expect(telOp(t, 'biljet')).toBe(10000)
    expect(telOp(t, 'munt')).toBe(600)
    expect(telOp(t)).toBe(10600)
  })
})

describe('wat er naar de kluis gaat', () => {
  it('trekt de kluis van de telling af', () => {
    const t = totalen(telling({ 5000: 10 }), telling({ 5000: 6 }))
    expect(t).toEqual({ geteld: 50000, kluis: 30000, lade: 20000 })
  })

  it('laat per coupure zien wat er in de lade blijft', () => {
    expect(inLade(telling({ 1000: 5 }), telling({ 1000: 2 }), 1000)).toBe(3000)
  })

  it('merkt op als er meer naar de kluis gaat dan er geteld is', () => {
    const geteld = telling({ 2000: 3 })
    const kluis = telling({ 2000: 4 })
    expect(teveelNaarKluis(geteld, kluis, 2000)).toBe(true)
    expect(ergensTeveel(geteld, kluis)).toBe(true)
  })

  it('vindt evenveel naar de kluis als geteld gewoon goed', () => {
    const t = telling({ 2000: 3 })
    expect(teveelNaarKluis(t, t, 2000)).toBe(false)
    expect(totalen(t, t).lade).toBe(0)
  })

  it('kijkt naar elke coupure, niet alleen de eerste', () => {
    expect(ergensTeveel(telling({ 5000: 5, 5: 1 }), telling({ 5000: 5, 5: 2 }))).toBe(true)
  })
})

describe('een echte telling', () => {
  // 3×50 + 7×20 + 4×10 + 2×5 = 150 + 140 + 40 + 10 = 340 euro aan biljetten
  // 9×2 + 14×1 + 23×0,50 + 11×0,20 + 7×0,10 + 3×0,05 = 18 + 14 + 11,50 + 2,20 + 0,70 + 0,15
  const geteld = telling({ 5000: 3, 2000: 7, 1000: 4, 500: 2, 200: 9, 100: 14, 50: 23, 20: 11, 10: 7, 5: 3 })
  const kluis = telling({ 5000: 3, 2000: 5 })

  it('telt de biljetten goed op', () => {
    expect(telOp(geteld, 'biljet')).toBe(34000)
  })

  it('telt de munten goed op', () => {
    expect(telOp(geteld, 'munt')).toBe(4655)
  })

  it('komt op het juiste eindbedrag', () => {
    expect(euro(telOp(geteld))).toBe('€\u00A0386,55')
  })

  it('houdt over wat er niet naar de kluis gaat', () => {
    const t = totalen(geteld, kluis)
    expect(euro(t.kluis)).toBe('€\u00A0250,00')
    expect(euro(t.lade)).toBe('€\u00A0136,55')
    expect(t.geteld).toBe(t.kluis + t.lade)
  })
})

describe('de datum bovenaan', () => {
  it('schrijft hem voluit in het Nederlands', () => {
    expect(vandaagInWoorden(new Date('2026-10-04T12:00:00'))).toBe('zondag 4 oktober 2026')
  })
})
