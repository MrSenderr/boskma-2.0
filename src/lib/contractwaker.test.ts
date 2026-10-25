/* De contractwaker. Een dag ernaast betekent een aanzegging die te laat komt,
   en dat kost een maandloon. */

import { describe, expect, it } from 'vitest'
import { dagenTussen, plusMaanden, signalen, signalenVoor } from './contractwaker'
import type { Persoon } from './personeel'

function persoon(extra: Partial<Persoon>): Persoon {
  return {
    id: 'p1',
    voornaam: 'Test',
    achternaam: 'Persoon',
    status: 'aangenomen',
    fase: 'medewerker',
    aangemeld_op: null,
    aangenomen_op: null,
    onboarding_verstuurd_op: null,
    onboarding_ingevuld_op: null,
    loonbureau_verstuurd_op: null,
    loonbureau_bevestigd_op: null,
    uit_dienst_op: null,
    is_eigenaar: false,
    in_dienst_sinds: null,
    ...extra,
  }
}

describe('datums', () => {
  it('telt maanden op en houdt het einde van de maand heel', () => {
    expect(plusMaanden('2026-01-31', 1)).toBe('2026-02-28')
    expect(plusMaanden('2027-07-15', -1)).toBe('2027-06-15')
    expect(plusMaanden('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('telt dagen over de zomertijd heen', () => {
    expect(dagenTussen('2026-10-24', '2026-10-26')).toBe(2)
    expect(dagenTussen('2026-03-28', '2026-03-30')).toBe(2)
  })
})

describe('aanzeggen', () => {
  const jaarcontract = persoon({
    contractduur: 'bepaalde',
    ingangsdatum: '2026-01-01',
    einddatum: '2026-12-31',
    contracttype: 'Vaste uren',
  })

  it('verschijnt zes weken voor de aanzegdatum', () => {
    expect(signalenVoor(jaarcontract, '2026-10-18')).toHaveLength(0)
    const [s] = signalenVoor(jaarcontract, '2026-10-19')
    expect(s.soort).toBe('aanzeggen')
    expect(s.uiterlijk).toBe('2026-11-30')
    expect(s.ernst).toBe('letop')
  })

  it('wordt rood in de laatste week en blijft staan tot de einddatum', () => {
    expect(signalenVoor(jaarcontract, '2026-11-25')[0].ernst).toBe('fout')
    const te_laat = signalenVoor(jaarcontract, '2026-12-10')[0]
    expect(te_laat.dagen).toBeLessThan(0)
    expect(te_laat.wat).toMatch(/voorbij/)
    expect(signalenVoor(jaarcontract, '2027-01-01')).toHaveLength(0)
  })

  it('telt een half jaar als zes maanden', () => {
    const half = persoon({ contractduur: 'bepaalde', ingangsdatum: '2026-11-01', einddatum: '2027-04-30' })
    expect(signalenVoor(half, '2027-03-15')[0].soort).toBe('aanzeggen')
  })

  it('geeft bij een kort contract alleen het einde', () => {
    const kort = persoon({ contractduur: 'bepaalde', ingangsdatum: '2026-11-01', einddatum: '2027-01-31' })
    const [s] = signalenVoor(kort, '2027-01-01')
    expect(s.soort).toBe('einde')
    expect(s.dagen).toBe(30)
  })

  it('negeert onbepaalde tijd', () => {
    const vast = persoon({ contractduur: 'onbepaalde', ingangsdatum: '2026-01-01', einddatum: null })
    expect(signalenVoor(vast, '2026-12-01')).toHaveLength(0)
  })
})

describe('twaalf maanden oproep', () => {
  const oproep = persoon({
    contracttype: 'Nuluren-overeenkomst (oproep)',
    contractduur: 'onbepaalde',
    ingangsdatum: '2026-07-16',
  })

  it('verschijnt vier weken voor het jaar en loopt tot een maand erna', () => {
    expect(signalenVoor(oproep, '2027-06-17')).toHaveLength(0)
    const [s] = signalenVoor(oproep, '2027-06-18')
    expect(s.soort).toBe('vaste_uren')
    expect(s.uiterlijk).toBe('2027-08-16')
    expect(signalenVoor(oproep, '2027-08-17')).toHaveLength(0)
  })

  it('geldt niet voor vaste uren', () => {
    const vast = persoon({ ...oproep, contracttype: 'Vaste uren' })
    expect(signalenVoor(vast, '2027-07-01')).toHaveLength(0)
  })
})

describe('verjaardag', () => {
  it('seint twee weken vooruit tot en met 21', () => {
    const p = persoon({ geboortedatum: '2010-11-05' })
    expect(signalenVoor(p, '2026-10-21')).toHaveLength(0)
    const [s] = signalenVoor(p, '2026-10-22')
    expect(s.wat).toBe('Wordt 16 — uurloon en werktijden nakijken')
  })

  it('gaat over de jaargrens', () => {
    const p = persoon({ geboortedatum: '2008-01-03' })
    expect(signalenVoor(p, '2026-12-25')[0].wat).toBe('Wordt 19 — uurloon nakijken')
  })

  it('zwijgt vanaf 22', () => {
    expect(signalenVoor(persoon({ geboortedatum: '2004-11-05' }), '2026-11-01')).toHaveLength(0)
  })
})

describe('wie meetelt', () => {
  it('slaat sollicitanten, uit dienst en de eigenaar over', () => {
    const basis = { geboortedatum: '2010-11-05' }
    expect(signalenVoor(persoon({ ...basis, fase: 'sollicitant' }), '2026-11-01')).toHaveLength(0)
    expect(signalenVoor(persoon({ ...basis, uit_dienst_op: '2026-10-01' }), '2026-11-01')).toHaveLength(0)
    expect(signalenVoor(persoon({ ...basis, is_eigenaar: true }), '2026-11-01')).toHaveLength(0)
  })

  it('zet het dringendste bovenaan', () => {
    const a = persoon({ id: 'a', voornaam: 'A', geboortedatum: '2010-11-10' })
    const b = persoon({ id: 'b', voornaam: 'B', geboortedatum: '2010-11-03' })
    expect(signalen([a, b], '2026-11-01').map((s) => s.persoonId)).toEqual(['b', 'a'])
  })
})
