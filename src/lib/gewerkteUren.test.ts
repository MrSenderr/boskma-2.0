/* Het gemiddelde over twaalf maanden.
 *
 * Dit getal belandt in een aanbod voor vaste uren dat juridisch bindend is, en
 * te laag aanbieden kost geld tot vijf jaar terug. Twee dingen worden hier
 * daarom hard nagerekend: dat verlof meetelt, en dat er géén getal uitkomt
 * zolang de gegevens het niet dragen. */

import { describe, expect, it } from 'vitest'
import {
  dekkingVan,
  gemiddeldeUren,
  telMee,
  twaalfMaandenVoor,
  voegSamen,
  type Periode,
  type Urenregel,
} from './gewerkteUren'

const heelJaar: Periode = { van: '2025-10-25', tot: '2026-10-25' }
const uur = (datum: string, uren: number, soort = 'gewerkte uren'): Urenregel => ({
  datum,
  minuten: uren * 60,
  soort,
})

describe('wat telt als verloonde uren', () => {
  it('telt gewerkte uren en betaald verlof mee', () => {
    expect(telMee('gewerkte uren')).toBe(true)
    expect(telMee('verlof')).toBe(true)
    expect(telMee('bijzonder verlof')).toBe(true)
  })

  it('telt niets mee wat we niet kennen', () => {
    expect(telMee('onbetaald verlof')).toBe(false)
    expect(telMee(null)).toBe(false)
  })

  it('kijkt niet naar hoofdletters of spaties', () => {
    expect(telMee('  Verlof ')).toBe(true)
  })
})

describe('welke weken zijn ingelezen', () => {
  it('voegt aansluitende weken samen tot één periode', () => {
    expect(
      voegSamen([
        { van: '2026-10-05', tot: '2026-10-11' },
        { van: '2026-10-12', tot: '2026-10-18' },
      ]),
    ).toEqual([{ van: '2026-10-05', tot: '2026-10-18' }])
  })

  it('houdt een gat ertussen apart', () => {
    expect(
      voegSamen([
        { van: '2026-10-05', tot: '2026-10-11' },
        { van: '2026-10-19', tot: '2026-10-25' },
      ]),
    ).toHaveLength(2)
  })

  it('laat zich niet in de war brengen door dubbele imports', () => {
    expect(
      voegSamen([
        { van: '2026-10-05', tot: '2026-10-11' },
        { van: '2026-10-05', tot: '2026-10-11' },
        { van: '2026-10-07', tot: '2026-10-09' },
      ]),
    ).toEqual([{ van: '2026-10-05', tot: '2026-10-11' }])
  })

  it('wijst de gaten aan binnen het venster', () => {
    const d = dekkingVan([{ van: '2026-10-05', tot: '2026-10-11' }], heelJaar)
    expect(d.volledig).toBe(false)
    expect(d.gaten).toEqual([
      { van: '2025-10-25', tot: '2026-10-04' },
      { van: '2026-10-12', tot: '2026-10-25' },
    ])
    expect(d.dagenGedekt).toBe(7)
  })

  it('snijdt af op de randen van het venster', () => {
    const d = dekkingVan([{ van: '2020-01-01', tot: '2030-01-01' }], heelJaar)
    expect(d.volledig).toBe(true)
    expect(d.gedekt).toEqual([heelJaar])
  })
})

describe('het gemiddelde zelf', () => {
  it('rekent uit wat er per week en per maand is verloond', () => {
    // 52 weken lang 10 uur, met het hele jaar ingelezen.
    const regels = Array.from({ length: 52 }, (_, i) => {
      const d = new Date('2025-10-27T12:00:00')
      d.setDate(d.getDate() + i * 7)
      return uur(d.toLocaleDateString('sv-SE'), 10)
    })
    const uit = gemiddeldeUren({ regels, periodes: [heelJaar], venster: heelJaar })
    expect(uit.totaalUren).toBe(520)
    expect(uit.urenPerWeek).toBeCloseTo(9.94, 1)
    expect(uit.urenPerMaand).toBeCloseTo(43.1, 0)
  })

  it('telt betaald verlof mee in het gemiddelde', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2026-01-05', 8), uur('2026-01-06', 8, 'verlof')],
      periodes: [heelJaar],
      venster: heelJaar,
    })
    expect(uit.totaalUren).toBe(16)
  })

  it('laat zien wat er buiten de telling viel', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2026-01-05', 8), uur('2026-01-06', 4, 'onbetaald verlof')],
      periodes: [heelJaar],
      venster: heelJaar,
    })
    expect(uit.totaalUren).toBe(8)
    expect(uit.nietMeegeteld).toEqual([{ soort: 'onbetaald verlof', uren: 4 }])
  })

  /* De kern. Eén week ingelezen is geen jaar, en dan hoort er geen getal uit
     te komen — ook niet een laag getal. Dat zou als "gemiddeld 2 uur per week"
     in een aanbod belanden terwijl iemand er misschien twintig werkt. */
  it('geeft géén gemiddelde als niet het hele jaar is ingelezen', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2026-10-06', 8), uur('2026-10-07', 8)],
      periodes: [{ van: '2026-10-05', tot: '2026-10-11' }],
      venster: heelJaar,
    })
    expect(uit.urenPerWeek).toBeNull()
    expect(uit.urenPerMaand).toBeNull()
    // Wat er wél bekend is blijft zichtbaar.
    expect(uit.totaalUren).toBe(16)
    expect(uit.dekking.dagenGedekt).toBe(7)
    expect(uit.dekking.dagenTotaal).toBe(366)
  })

  it('negeert uren van buiten het venster', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2024-01-01', 40), uur('2026-01-05', 8)],
      periodes: [heelJaar],
      venster: heelJaar,
    })
    expect(uit.totaalUren).toBe(8)
  })

  it('geeft nul uren als er niets gewerkt is, mits het jaar is ingelezen', () => {
    const uit = gemiddeldeUren({ regels: [], periodes: [heelJaar], venster: heelJaar })
    expect(uit.urenPerWeek).toBe(0)
  })
})

describe('het venster', () => {
  it('loopt twaalf maanden terug', () => {
    expect(twaalfMaandenVoor('2026-10-25')).toEqual({ van: '2025-10-25', tot: '2026-10-25' })
  })
})
