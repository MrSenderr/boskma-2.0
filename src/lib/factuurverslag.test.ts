/* Het verslag bij een inkoopfactuur.
 *
 * De belangrijkste regel staat hier: een actie die afloopt is geen
 * prijsstijging. Zonder dat onderscheid schrikt dit verslag je elke week voor
 * niets op, en dan kijk je er na twee weken niet meer naar. */

import { describe, expect, it } from 'vitest'
import {
  GEMIST_DEEL,
  maakVerslag,
  perSoort,
  prijseffect,
  type Artikel,
  type EerdereRegel,
} from './factuurverslag'

const a = (anders: Partial<Artikel>): Artikel => ({
  artikelnr: '111600',
  artikelnaam: 'Coca Cola blik',
  aantal: 2,
  prijs: 16.99,
  bedrag: 33.98,
  actie: false,
  vorige_prijs: 15.95,
  vorige_datum: '2026-10-16',
  vorige_actie: false,
  is_nieuw: false,
  ...anders,
})

const soortenVan = (artikelen: Artikel[], eerder: EerdereRegel[] = []) =>
  maakVerslag({ artikelen, eerder }).bevindingen.map((b) => b.soort)

describe('prijzen', () => {
  it('meldt een prijsstijging met het effect op deze factuur', () => {
    const uit = maakVerslag({ artikelen: [a({})], eerder: [] })
    expect(uit.bevindingen[0]).toMatchObject({
      soort: 'duurder',
      naam: 'Coca Cola blik',
      prijs: 16.99,
      vorigePrijs: 15.95,
      procent: 6.5,
      effect: 2.08,
    })
  })

  it('meldt een prijsdaling', () => {
    expect(soortenVan([a({ prijs: 14.95, vorige_prijs: 15.95 })])).toEqual(['goedkoper'])
  })

  it('zwijgt over een prijs die gelijk bleef', () => {
    expect(soortenVan([a({ prijs: 15.95 })])).toEqual([])
  })

  /* Dit is het hele punt. Op de factuur van 23 oktober 2026 waren drie van de
     zes "stijgingen" een actie die afliep. */
  it('noemt een afgelopen actie geen prijsstijging', () => {
    expect(soortenVan([a({ vorige_actie: true, actie: false })])).toEqual(['actie_afgelopen'])
  })

  it('noemt een nieuwe actie geen prijsdaling', () => {
    expect(soortenVan([a({ prijs: 14.5, vorige_actie: false, actie: true })])).toEqual(['nu_op_actie'])
  })

  /* Gaat de prijs omhoog terwijl hij ook vorige keer al geen actie was, dan is
     het wél gewoon duurder — ook als er nu toevallig actie op staat. */
  it('blijft duurder als de actie niet de verklaring is', () => {
    expect(soortenVan([a({ vorige_actie: true, actie: true })])).toEqual(['duurder'])
  })
})

describe('nieuw op de factuur', () => {
  it('meldt een artikel dat er niet eerder op stond', () => {
    const uit = maakVerslag({
      artikelen: [a({ artikelnr: '392097', artikelnaam: 'Texas chicken strips', is_nieuw: true, vorige_prijs: null })],
      eerder: [],
    })
    expect(uit.bevindingen[0]).toMatchObject({ soort: 'nieuw', naam: 'Texas chicken strips' })
  })

  it('valt op een artikelnummer terug als de naam ontbreekt', () => {
    const uit = maakVerslag({
      artikelen: [a({ artikelnaam: null, is_nieuw: true, vorige_prijs: null })],
      eerder: [],
    })
    expect(uit.bevindingen[0].naam).toBe('111600')
  })
})

describe('wat er niet op staat', () => {
  /** Regels van `facturen` voor dit artikel; `leeg` vult het venster aan met
   *  facturen waar het artikel niet op stond. */
  const eerder = (artikelnr: string, facturen: number[], leeg: number[] = []): EerdereRegel[] => [
    ...facturen.map((id) => ({
      document_id: id,
      factuurdatum: `2026-10-${String(id).padStart(2, '0')}`,
      artikelnr,
      artikelnaam: 'Frituurvet',
    })),
    ...leeg.map((id) => ({
      document_id: id,
      factuurdatum: `2026-10-${String(id).padStart(2, '0')}`,
      artikelnr: 'anders',
      artikelnaam: 'Iets anders',
    })),
  ]

  it('meldt wat je bijna elke week bestelt en nu niet', () => {
    const uit = maakVerslag({ artikelen: [a({})], eerder: eerder('900', [1, 2, 3, 4, 5]) })
    expect(uit.bevindingen.find((b) => b.soort === 'gemist')).toMatchObject({
      naam: 'Frituurvet',
      keerEerder: 5,
      vanFacturen: 5,
      laatstOp: '2026-10-05',
    })
  })

  /* Drie van de negen is niet "bijna elke week" maar af en toe. Dat was de
     fout die het eerste verslag onbruikbaar maakte: negenentwintig meldingen. */
  it('zwijgt over iets dat je maar af en toe haalt', () => {
    const uit = maakVerslag({
      artikelen: [a({})],
      eerder: eerder('900', [1, 2, 3], [4, 5, 6, 7, 8, 9]),
    })
    expect(uit.bevindingen.some((b) => b.soort === 'gemist')).toBe(false)
    expect(GEMIST_DEEL).toBe(0.8)
  })

  it('meldt het wel als het er bijna altijd op stond', () => {
    const uit = maakVerslag({
      artikelen: [a({})],
      eerder: eerder('900', [1, 2, 3, 4, 5, 6, 7, 8], [9]),
    })
    expect(uit.bevindingen.find((b) => b.soort === 'gemist')).toMatchObject({ keerEerder: 8 })
  })

  /* Twee regels van hetzelfde artikel op één factuur is één keer besteld, geen
     twee. Anders telt een deellevering mee als ritme. */
  it('telt facturen en geen regels', () => {
    const uit = maakVerslag({
      artikelen: [a({})],
      eerder: eerder('900', [1, 1, 1, 2], [3, 4, 5, 6, 7, 8]),
    })
    expect(uit.bevindingen.some((b) => b.soort === 'gemist')).toBe(false)
  })

  /* Met te weinig geschiedenis valt er niets over een ritme te zeggen, en dan
     moet de app zwijgen in plaats van gokken. */
  it('zwijgt bij te weinig eerdere facturen', () => {
    const uit = maakVerslag({ artikelen: [a({})], eerder: eerder('900', [1, 2, 3]) })
    expect(uit.bevindingen.some((b) => b.soort === 'gemist')).toBe(false)
  })

  it('zwijgt over wat gewoon op deze factuur staat', () => {
    const uit = maakVerslag({
      artikelen: [a({ artikelnr: '900' })],
      eerder: eerder('900', [1, 2, 3, 4, 5]),
    })
    expect(uit.bevindingen.some((b) => b.soort === 'gemist')).toBe(false)
  })
})

describe('volgorde en optelling', () => {
  it('zet wat geld kost bovenaan, de grootste eerst', () => {
    const uit = maakVerslag({
      artikelen: [
        a({ artikelnr: '1', artikelnaam: 'Klein', prijs: 16.0, vorige_prijs: 15.95, aantal: 1 }),
        a({ artikelnr: '2', artikelnaam: 'Groot', prijs: 20, vorige_prijs: 15, aantal: 4 }),
        a({ artikelnr: '3', artikelnaam: 'Nieuw', is_nieuw: true, vorige_prijs: null }),
      ],
      eerder: [],
    })
    expect(uit.bevindingen.map((b) => b.naam)).toEqual(['Groot', 'Klein', 'Nieuw'])
  })

  it('groepeert voor het scherm, zonder lege groepen', () => {
    const uit = maakVerslag({ artikelen: [a({}), a({ artikelnr: '2', is_nieuw: true, vorige_prijs: null })], eerder: [] })
    expect(perSoort(uit).map((g) => g.soort)).toEqual(['duurder', 'nieuw'])
  })

  /* Wat deze factuur duurder uitvalt door prijzen alleen: acties tellen niet
     mee, want daar verandert de afspraak niet door. */
  it('telt alleen echte prijsverschillen op', () => {
    const uit = maakVerslag({
      artikelen: [
        a({ artikelnr: '1', prijs: 20, vorige_prijs: 15, aantal: 2 }),
        a({ artikelnr: '2', prijs: 10, vorige_prijs: 12, aantal: 1 }),
        a({ artikelnr: '3', prijs: 30, vorige_prijs: 25, aantal: 1, vorige_actie: true }),
      ],
      eerder: [],
    })
    expect(prijseffect(uit)).toBe(8)
  })

  it('doet niets vreemds met een lege factuur', () => {
    const uit = maakVerslag({ artikelen: [], eerder: [] })
    expect(uit).toEqual({ bevindingen: [], artikelen: 0 })
  })
})
