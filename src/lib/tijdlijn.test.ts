import { describe, expect, it } from 'vitest'
import { balk, dagtijdlijn, naarMinuten, naarTijd, uurstreepjes, venster } from './tijdlijn'
import type { Shift } from './rooster'

function shift(anders: Partial<Shift> = {}): Shift {
  return {
    bron_id: 'a',
    datum: '2026-10-01',
    voornaam: 'Willem',
    achternaam: 'Doorn',
    medewerker_id: null,
    team: 'Snackerie',
    soort: null,
    begint: '12:00',
    eindigt: '20:00',
    minuten: 480,
    pauze_minuten: 0,
    ...anders,
  }
}

describe('tijden omrekenen', () => {
  it('rekent een klok om naar minuten', () => {
    expect(naarMinuten('12:00')).toBe(720)
    expect(naarMinuten('00:00')).toBe(0)
    expect(naarMinuten('20:45')).toBe(1245)
  })

  it('weigert wat geen tijd is', () => {
    expect(naarMinuten(null)).toBeNull()
    expect(naarMinuten('')).toBeNull()
    expect(naarMinuten('25:00')).toBeNull()
    expect(naarMinuten('12:99')).toBeNull()
  })

  it('rekent terug', () => {
    expect(naarTijd(720)).toBe('12:00')
    expect(naarTijd(1245)).toBe('20:45')
  })
})

describe('het venster', () => {
  const d = (begint: number, eindigt: number) => ({
    sleutel: 'x', naam: 'X', open: false, begint, eindigt, team: null, opent: false,
  })

  it('rondt af op hele uren', () => {
    expect(venster([d(11 * 60 + 30, 19 * 60 + 45)])).toEqual({ van: 11 * 60, tot: 20 * 60 })
  })

  it('laat niemand buiten beeld vallen', () => {
    const v = venster([d(10 * 60, 20 * 60), d(17 * 60, 21 * 60 + 15)])
    expect(v.van).toBeLessThanOrEqual(10 * 60)
    expect(v.tot).toBeGreaterThanOrEqual(21 * 60 + 15)
  })

  it('neemt de openingstijd mee, ook als er niemand voor staat', () => {
    expect(venster([d(17 * 60, 20 * 60)], [12 * 60, 20 * 60]).van).toBeLessThanOrEqual(12 * 60)
  })

  it('wordt nooit smaller dan vier uur', () => {
    const v = venster([d(12 * 60, 13 * 60)])
    expect(v.tot - v.van).toBeGreaterThanOrEqual(4 * 60)
  })

  it('valt terug op een gewone dag als er niets is', () => {
    expect(venster([])).toEqual({ van: 600, tot: 1260 })
  })
})

describe('de balken', () => {
  const v = { van: 10 * 60, tot: 22 * 60 } // twaalf uur breed

  it('zet een dienst op de goede plek', () => {
    const b = balk(12 * 60, 20 * 60, v)
    expect(b.links).toBeCloseTo((2 / 12) * 100)
    expect(b.breedte).toBeCloseTo((8 / 12) * 100)
  })

  it('begint aan de linkerkant als de dienst bij het venster begint', () => {
    expect(balk(10 * 60, 14 * 60, v).links).toBe(0)
  })

  it('loopt nooit buiten het venster', () => {
    const b = balk(21 * 60, 23 * 60, v)
    expect(b.links + b.breedte).toBeLessThanOrEqual(100)
  })

  it('geeft ook een heel korte dienst nog iets breedte', () => {
    expect(balk(12 * 60, 12 * 60 + 1, v).breedte).toBeGreaterThan(0)
  })
})

describe('de uurstreepjes', () => {
  it('zet er een op elk heel uur', () => {
    expect(uurstreepjes({ van: 10 * 60, tot: 13 * 60 })).toEqual([600, 660, 720, 780])
  })
})

describe('de dag', () => {
  it('zet wie opent bovenaan', () => {
    const t = dagtijdlijn(
      [
        shift({ bron_id: '1', voornaam: 'Noor', begint: '17:00', eindigt: '20:00' }),
        shift({ bron_id: '2', voornaam: 'Willem', begint: '11:00', eindigt: '20:00' }),
      ],
      '12:00',
      '20:00',
    )
    expect(t.diensten.map((d) => d.naam)).toEqual(['Willem Doorn', 'Noor Doorn'])
  })

  it('merkt aan wie er is als de zaak opengaat', () => {
    const t = dagtijdlijn(
      [
        shift({ bron_id: '1', begint: '11:00' }),
        shift({ bron_id: '2', begint: '12:00' }),
        shift({ bron_id: '3', begint: '17:00' }),
      ],
      '12:00',
      '20:00',
    )
    expect(t.diensten.map((d) => d.opent)).toEqual([true, true, false])
  })

  it('merkt niemand aan als de zaak dicht is', () => {
    const t = dagtijdlijn([shift()], null, null)
    expect(t.diensten.every((d) => !d.opent)).toBe(true)
  })

  it('herkent een dienst waar nog niemand op staat', () => {
    const t = dagtijdlijn([shift({ voornaam: null, achternaam: null })], '12:00', '20:00')
    expect(t.diensten[0]).toMatchObject({ open: true, naam: 'Open dienst' })
  })

  it('zet een dienst zonder tijden apart', () => {
    const t = dagtijdlijn([shift({ begint: null, eindigt: null })], '12:00', '20:00')
    expect(t.diensten).toHaveLength(0)
    expect(t.zonderTijd).toHaveLength(1)
  })

  it('houdt een uur aanloop vóór de opening in beeld', () => {
    const t = dagtijdlijn([shift({ begint: '12:00', eindigt: '20:00' })], '12:00', '20:00')
    expect(t.venster.van).toBeLessThanOrEqual(11 * 60)
  })

  it('zet een dienst die eerder eindigt dan hij begint ook apart', () => {
    const t = dagtijdlijn([shift({ begint: '20:00', eindigt: '12:00' })], '12:00', '20:00')
    expect(t.zonderTijd).toHaveLength(1)
  })
})
