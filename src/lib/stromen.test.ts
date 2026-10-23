/* Het stilte-alarm. Een vals alarm is erger dan geen alarm: na twee keer
   onterecht kijk je er niet meer naar. */

import { describe, expect, it } from 'vitest'
import { dagenStil, standVan, watStilstaat, type Stroom } from './stromen'

const s = (anders: Partial<Stroom>): Stroom => ({
  id: 1,
  sleutel: 'rooster',
  naam: 'Rooster uit eitje',
  uitleg: null,
  max_dagen: 3,
  pad: '/rooster/importeren',
  laatste_op: '2026-10-23',
  gecontroleerd_op: null,
  actief: true,
  ...anders,
})

const vandaag = new Date('2026-10-24T09:00:00')

describe('hoe lang is het al stil', () => {
  it('telt hele dagen', () => {
    expect(dagenStil(s({ laatste_op: '2026-10-23' }), vandaag)).toBe(1)
    expect(dagenStil(s({ laatste_op: '2026-10-24' }), vandaag)).toBe(0)
    expect(dagenStil(s({ laatste_op: '2026-10-14' }), vandaag)).toBe(10)
  })

  /* De zomertijd gaat eind oktober in. Rekenen met uren zou dan een dag
     verspringen en een vals alarm geven. */
  it('struikelt niet over de zomertijd', () => {
    expect(dagenStil(s({ laatste_op: '2026-10-24' }), new Date('2026-11-02T09:00:00'))).toBe(9)
  })

  it('zegt niets als er nog nooit iets was', () => {
    expect(dagenStil(s({ laatste_op: null }), vandaag)).toBeNull()
  })
})

describe('wanneer het alarm afgaat', () => {
  it('zwijgt binnen de afgesproken stilte', () => {
    expect(standVan(s({ laatste_op: '2026-10-21' }), vandaag)).toBe('goed')
  })

  /* Precies op de grens nog niet: drie dagen mag, pas de vierde is te veel. */
  it('slaat pas aan ná de grens', () => {
    expect(standVan(s({ laatste_op: '2026-10-21', max_dagen: 3 }), vandaag)).toBe('goed')
    expect(standVan(s({ laatste_op: '2026-10-20', max_dagen: 3 }), vandaag)).toBe('stil')
  })

  it('kent elke stroom zijn eigen ritme', () => {
    const tien = { laatste_op: '2026-10-18', max_dagen: 10 }
    const drie = { laatste_op: '2026-10-18', max_dagen: 3 }
    expect(standVan(s(tien), vandaag)).toBe('goed')
    expect(standVan(s(drie), vandaag)).toBe('stil')
  })

  it('merkt het als er nog nooit iets binnenkwam', () => {
    expect(standVan(s({ laatste_op: null }), vandaag)).toBe('nooit')
  })
})

describe('wat er mis is', () => {
  it('is leeg als alles loopt', () => {
    expect(watStilstaat([s({}), s({ id: 2, max_dagen: 10 })], vandaag)).toEqual([])
  })

  it('noemt alleen wat stilstaat', () => {
    const uit = watStilstaat(
      [s({ id: 1 }), s({ id: 2, laatste_op: '2026-10-01' }), s({ id: 3, laatste_op: null })],
      vandaag,
    )
    expect(uit.map((x) => x.id)).toEqual([2, 3])
  })

  /* Een stroom die je bewust hebt uitgezet hoort niet te klagen. */
  it('laat een uitgezette stroom met rust', () => {
    expect(watStilstaat([s({ laatste_op: '2026-01-01', actief: false })], vandaag)).toEqual([])
  })
})
