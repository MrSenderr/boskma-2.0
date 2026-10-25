/* Wie moet nog een getekend contract uploaden, en wat moet er nog naar het
   loonbureau? */

import { describe, expect, it } from 'vitest'
import { contractStanden, standVan, type GetekendDocument } from './getekendContract'

function mens(extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    voornaam: 'Test',
    achternaam: 'Persoon',
    fase: 'medewerker' as const,
    uit_dienst_op: null,
    is_eigenaar: false,
    loonbureau_verstuurd_op: '2026-10-01T10:00:00Z',
    contract_door_loonbureau: true,
    ...extra,
  }
}

function doc(extra: Partial<GetekendDocument> = {}): GetekendDocument {
  return {
    id: 1,
    medewerker_id: 'p1',
    toegevoegd_op: '2026-10-20T10:00:00Z',
    naar_loonbureau_op: null,
    naar_loonbureau_fout: null,
    ...extra,
  }
}

describe('stand per medewerker', () => {
  it('vraagt om uploaden als het loonbureau het contract opstelde', () => {
    expect(standVan(mens(), []).stand).toBe('uploaden')
  })

  it('zegt alleen "ontbreekt" zolang het verzoek nog niet bij het loonbureau ligt', () => {
    expect(standVan(mens({ loonbureau_verstuurd_op: null }), []).stand).toBe('ontbreekt')
    expect(standVan(mens({ contract_door_loonbureau: false }), []).stand).toBe('ontbreekt')
  })

  it('wil hem versturen zodra hij er staat, met de foutmelding erbij', () => {
    const s = standVan(mens(), [doc({ naar_loonbureau_fout: 'Resend 500' })])
    expect(s.stand).toBe('versturen')
    expect(s.documentId).toBe(1)
    expect(s.fout).toBe('Resend 500')
  })

  it('is in orde als hij verstuurd is', () => {
    expect(standVan(mens(), [doc({ naar_loonbureau_op: '2026-10-20T10:01:00Z' })]).stand).toBe('in_orde')
  })

  it('stuurt een zelf opgesteld contract niet naar het loonbureau', () => {
    expect(standVan(mens({ contract_door_loonbureau: false }), [doc()]).stand).toBe('in_orde')
  })

  it('kijkt naar het nieuwste document', () => {
    const s = standVan(mens(), [
      doc({ id: 1, toegevoegd_op: '2026-09-01T10:00:00Z' }),
      doc({ id: 2, toegevoegd_op: '2026-10-01T10:00:00Z' }),
    ])
    expect(s.documentId).toBe(2)
  })

  it('negeert documenten van een ander', () => {
    expect(standVan(mens(), [doc({ medewerker_id: 'p2' })]).stand).toBe('uploaden')
  })
})

describe('de hele lijst', () => {
  it('slaat de eigenaar en wie uit dienst is over, en zet versturen bovenaan', () => {
    const lijst = contractStanden(
      [
        mens({ id: 'a', voornaam: 'Anna', contract_door_loonbureau: false }),
        mens({ id: 'b', voornaam: 'Bart' }),
        mens({ id: 'c', voornaam: 'Cas' }),
        mens({ id: 'e', is_eigenaar: true }),
        mens({ id: 'u', uit_dienst_op: '2026-10-22' }),
      ],
      [doc({ medewerker_id: 'c' })],
    )
    expect(lijst.map((s) => [s.persoonId, s.stand])).toEqual([
      ['c', 'versturen'],
      ['b', 'uploaden'],
      ['a', 'ontbreekt'],
    ])
  })
})
