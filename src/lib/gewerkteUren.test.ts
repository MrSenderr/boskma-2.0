/* Het gemiddelde over twaalf maanden.
 *
 * Dit getal belandt in een aanbod voor vaste uren dat juridisch bindend is, en
 * te laag aanbieden kost geld tot vijf jaar terug. Twee dingen worden hier
 * daarom hard nagerekend: dat verlof meetelt, en dat er géén getal uitkomt
 * zolang de gegevens het niet dragen. */

import { describe, expect, it } from 'vitest'
import {
  beperkTotMaanden,
  dekkingVan,
  gemiddeldeUren,
  maandenVan,
  periodeTekst,
  telMee,
  twaalfMaandenVoor,
  type Periode,
  type Urenregel,
  voegSamen,
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

  /* De kern. Eén week ingelezen is geen jaar, en dat moet eraf te lezen zijn.
     Het getal wordt wél berekend — over die ene week, niet over het jaar —
     zodat er iets te zien is, maar `volledig` zegt dat je er geen aanbod op
     kunt baseren. Delen door twaalf maanden zou "gemiddeld 0,3 uur per week"
     opleveren terwijl iemand er zestien werkte, en dát getal zou vijf jaar
     lang opeisbaar blijven.

     Veranderd op 25 oktober 2026: tot dan gaf dit null. Dat klopte, maar het
     betekende ook dat er geen enkel aanbod gedaan kon worden zolang Eitje nog
     geen twaalf maanden had geleverd — en géén aanbod doen is duurder dan een
     aanbod met een zichtbare kanttekening. */
  it('rekent over wat er is ingelezen en zegt dat het niet het hele jaar is', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2026-10-06', 8), uur('2026-10-07', 8)],
      periodes: [{ van: '2026-10-05', tot: '2026-10-11' }],
      venster: heelJaar,
    })
    expect(uit.volledig).toBe(false)
    // 16 uur in één ingelezen week.
    expect(uit.urenPerWeek).toBe(16)
    expect(uit.totaalUren).toBe(16)
    expect(uit.dekking.dagenGedekt).toBe(7)
    expect(uit.dekking.dagenTotaal).toBe(366)
  })

  it('zegt bij een volledig jaar dat het volledig is', () => {
    const uit = gemiddeldeUren({
      regels: [uur('2026-01-05', 8)],
      periodes: [heelJaar],
      venster: heelJaar,
    })
    expect(uit.volledig).toBe(true)
    expect(uit.maandenGedekt).toBeCloseTo(12, 0)
  })

  it('geeft niets als er helemaal niets is ingelezen', () => {
    const uit = gemiddeldeUren({ regels: [], periodes: [], venster: heelJaar })
    expect(uit.urenPerWeek).toBeNull()
    expect(uit.volledig).toBe(false)
    expect(uit.maandenGedekt).toBe(0)
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

describe('wat de uitdraai claimt maar niet bevat', () => {
  /* Op 25 oktober 2026 leverde Eitje een uitdraai met het etiket
     1 januari – 31 december 2026, terwijl er alleen uren vanaf juli in zaten.
     Zou de app dat etiket geloven, dan tellen januari tot en met juni als
     maanden zonder werk en komt het gemiddelde veel te laag uit. */
  it('laat alleen de maanden over waar werkelijk uren in staan', () => {
    const maanden = maandenVan([{ datum: '2026-07-04' }, { datum: '2026-08-11' }])
    const uit = beperkTotMaanden([{ van: '2026-01-01', tot: '2026-12-31' }], maanden)
    expect(uit).toEqual([{ van: '2026-07-01', tot: '2026-08-31' }])
  })

  it('knipt niet buiten de ingelezen periode', () => {
    const maanden = maandenVan([{ datum: '2026-07-20' }])
    const uit = beperkTotMaanden([{ van: '2026-07-13', tot: '2026-07-19' }], maanden)
    expect(uit).toEqual([{ van: '2026-07-13', tot: '2026-07-19' }])
  })

  it('houdt niets over als er van niemand uren zijn', () => {
    expect(beperkTotMaanden([{ van: '2026-01-01', tot: '2026-12-31' }], new Set())).toEqual([])
  })

  /* Het gevolg waar het om gaat: met het etiket geloofd zou het gemiddelde
     over twaalf maanden gaan en dus door zes worden gedeeld; nu gaat het over
     de twee maanden die er werkelijk zijn. */
  it('houdt het gemiddelde eerlijk bij een te ruim etiket', () => {
    const regels = [
      { datum: '2026-07-06', minuten: 600, soort: 'gewerkte uren' },
      { datum: '2026-08-10', minuten: 600, soort: 'gewerkte uren' },
    ]
    const geclaimd = [{ van: '2026-01-01', tot: '2026-12-31' }]
    const venster = { van: '2026-01-01', tot: '2026-12-31' }

    const geloofd = gemiddeldeUren({ regels, periodes: geclaimd, venster })
    const eerlijk = gemiddeldeUren({
      regels,
      periodes: beperkTotMaanden(geclaimd, maandenVan(regels)),
      venster,
    })

    expect(eerlijk.urenPerWeek! > geloofd.urenPerWeek!).toBe(true)
    expect(eerlijk.volledig).toBe(false)
    expect(Math.round(eerlijk.maandenGedekt)).toBe(2)
  })
})

describe('waarop het gemiddelde berust', () => {
  const met = (periodes: { van: string; tot: string }[], venster: { van: string; tot: string }) =>
    gemiddeldeUren({ regels: [], periodes, venster })

  it('schrijft een aaneengesloten reeks binnen één jaar kort op', () => {
    const uit = met([{ van: '2026-07-01', tot: '2026-10-31' }], { van: '2025-11-01', tot: '2026-10-31' })
    expect(periodeTekst(uit)).toBe('juli t/m oktober 2026')
  })

  it('noemt alleen twaalf maanden als het er twaalf zijn', () => {
    const heel = { van: '2026-01-01', tot: '2026-12-31' }
    expect(periodeTekst(met([heel], heel))).toMatch(/twaalf maanden/)
  })

  /* "juli t/m oktober" terwijl augustus ontbreekt is te mooi gezegd, en dit
     komt in een brief die later bewijs kan worden. */
  it('zegt het als er een maand tussenuit valt', () => {
    const uit = met(
      [
        { van: '2026-07-01', tot: '2026-07-31' },
        { van: '2026-09-01', tot: '2026-10-31' },
      ],
      { van: '2025-11-01', tot: '2026-10-31' },
    )
    expect(periodeTekst(uit)).toBe('juli t/m oktober 2026 (met onderbrekingen)')
  })

  it('geeft niets terug als er niets is ingelezen', () => {
    expect(periodeTekst(met([], { van: '2026-01-01', tot: '2026-12-31' }))).toBeNull()
  })
})
