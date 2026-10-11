/* Het rekenwerk achter het overzicht van vaste dagen. Hierop baseer je wie je
   waar inroostert, dus een verkeerde telling is een gat in je bezetting. */

import { describe, expect, it } from 'vitest'
import { heeftIngevuld, perDag, samenvatting, type Overzichtsregel } from './vasteDagen'

const regel = (r: Partial<Overzichtsregel>): Overzichtsregel => ({
  persoon_id: '1',
  naam: 'Iemand',
  ingevuld_op: '2026-10-11T12:00:00Z',
  wil_vast: true,
  akkoord_geen_vast: false,
  di: 'kan',
  wo: 'kan',
  do: 'kan',
  vr: 'kan',
  za: 'kan',
  zo: 'kan',
  za_hele_dag: 'nee',
  zo_hele_dag: 'nee',
  aantal_vast: 2,
  blokkades: null,
  geldig_tot: null,
  opmerking: null,
  ...r,
})

const nietIngevuld = (naam: string): Overzichtsregel =>
  regel({
    naam,
    ingevuld_op: null,
    wil_vast: null,
    di: null,
    wo: null,
    do: null,
    vr: null,
    za: null,
    zo: null,
    za_hele_dag: null,
    zo_hele_dag: null,
    aantal_vast: null,
  })

describe('wie heeft ingevuld', () => {
  it('kijkt naar de datum, niet naar de antwoorden', () => {
    expect(heeftIngevuld(regel({}))).toBe(true)
    expect(heeftIngevuld(nietIngevuld('Nieuw'))).toBe(false)
  })
})

describe('de telling per dag', () => {
  it('telt graag en kan apart', () => {
    const t = perDag([
      regel({ naam: 'A', di: 'graag', wo: 'kan' }),
      regel({ naam: 'B', di: 'graag', wo: 'nee' }),
    ])
    const di = t.find((d) => d.sleutel === 'di')!
    expect(di).toMatchObject({ graag: 2, kan: 0 })
    expect(t.find((d) => d.sleutel === 'wo')).toMatchObject({ graag: 0, kan: 1 })
  })

  /* Wie geen vaste dagen wil heeft de dagen niet ingevuld. Die meetellen zou
     het beeld vertekenen: het lijkt dan alsof iemand niet kan, terwijl hij
     alleen geen vaste plek wil. */
  it('laat iemand zonder vaste dagen buiten de telling', () => {
    const t = perDag([
      regel({ naam: 'A', di: 'graag' }),
      regel({ naam: 'B', wil_vast: false, di: null }),
      nietIngevuld('C'),
    ])
    expect(t.find((d) => d.sleutel === 'di')).toMatchObject({ graag: 1, kan: 0 })
  })

  it('geeft alle zes de dagen terug, ook zonder antwoorden', () => {
    const t = perDag([])
    expect(t).toHaveLength(6)
    expect(t.every((d) => d.graag === 0 && d.kan === 0)).toBe(true)
  })
})

describe('de korte samenvatting voor op een telefoon', () => {
  it('noemt alleen de dagen die iets betekenen', () => {
    const s = samenvatting(regel({ di: 'graag', wo: 'nee', do: 'graag', vr: 'liever_niet', za: 'kan', zo: 'nee' }))
    expect(s.graag).toEqual(['Dinsdag', 'Donderdag'])
    expect(s.kan).toEqual(['Zaterdag'])
    expect(s.nee).toEqual(['Woensdag', 'Zondag'])
  })

  /* "Liever niet" staat er bewust niet bij: dat is geen nee, en in een korte
     opsomming zou het als afwijzing lezen. */
  it('zet liever niet nergens bij', () => {
    const s = samenvatting(regel({ di: 'liever_niet', wo: 'liever_niet', do: 'liever_niet', vr: 'liever_niet', za: 'liever_niet', zo: 'liever_niet' }))
    expect(s).toEqual({ graag: [], kan: [], nee: [] })
  })

  it('is leeg voor wie geen vaste dagen wil', () => {
    expect(samenvatting(regel({ wil_vast: false }))).toEqual({ graag: [], kan: [], nee: [] })
  })
})
