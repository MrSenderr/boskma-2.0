/* De urenafspraak moet op drie plekken hetzelfde zeggen: het scherm, het
   mutatieformulier naar het loonbureau, en de export naar de verzekeraar.
   Daarom staat de regel op één plek en wordt hij hier getoetst. */

import { describe, expect, it } from 'vitest'
import { urenInWoorden, urensoortVan, type Persoon } from './personeel'
import { bouwMutatieformulier } from './mutatieformulier'

function persoon(anders: Partial<Persoon> = {}): Persoon {
  return {
    id: 'a',
    voornaam: 'Willem',
    achternaam: 'Doorn',
    status: 'aangenomen',
    fase: 'medewerker',
    aangemeld_op: '2026-09-01',
    aangenomen_op: '2026-09-01',
    onboarding_verstuurd_op: null,
    onboarding_ingevuld_op: null,
    loonbureau_verstuurd_op: null,
    loonbureau_bevestigd_op: null,
    uit_dienst_op: null,
    contracttype: 'Vaste uren',
    contracturen: 32,
    ...anders,
  }
}

describe('welke urenvelden bij welk contract horen', () => {
  it('een nulurencontract heeft er geen', () => {
    expect(urensoortVan('Nuluren-overeenkomst (oproep)')).toBe('geen')
  })

  it('een min-max heeft een onder- en bovengrens', () => {
    expect(urensoortVan('Min-max-overeenkomst')).toBe('bandbreedte')
  })

  it('de rest heeft een vast aantal', () => {
    expect(urensoortVan('Vaste uren')).toBe('vast')
    expect(urensoortVan(null)).toBe('vast')
  })
})

describe('de urenafspraak in woorden', () => {
  it('zegt bij vaste uren hoeveel', () => {
    expect(urenInWoorden(persoon({ contracturen: 32 }))).toBe('32 uur per week')
  })

  it('schrijft een half uur met een komma', () => {
    expect(urenInWoorden(persoon({ contracturen: 7.5 }))).toBe('7,5 uur per week')
  })

  it('zegt bij een oproepcontract dat er geen vaste uren zijn', () => {
    expect(urenInWoorden(persoon({ contracttype: 'Nuluren-overeenkomst (oproep)' }))).toBe(
      'Geen vaste uren (oproep)',
    )
  })

  it('noemt bij min-max allebei de grenzen', () => {
    expect(
      urenInWoorden(
        persoon({ contracttype: 'Min-max-overeenkomst', contracturen: null, uren_min: 8, uren_max: 20 }),
      ),
    ).toBe('Minimaal 8, maximaal 20 uur per week')
  })

  it('laat zien welke grens nog ontbreekt', () => {
    expect(
      urenInWoorden(
        persoon({ contracttype: 'Min-max-overeenkomst', contracturen: null, uren_min: 8, uren_max: null }),
      ),
    ).toBe('Minimaal 8, maximaal — uur per week')
  })

  it('zegt het eerlijk als er nog niets staat', () => {
    expect(urenInWoorden(persoon({ contracturen: null }))).toBe('Nog niet ingevuld')
  })
})

describe('wat het loonbureau op het mutatieformulier krijgt', () => {
  const tekst = (p: Persoon) =>
    bouwMutatieformulier(p)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')

  it('zet de uren bij een contract met vaste uren erop', () => {
    expect(tekst(persoon({ contracturen: 32 }))).toContain('Uren 32 uur per week')
  })

  it('zet bij min-max allebei de grenzen erop', () => {
    expect(
      tekst(
        persoon({ contracttype: 'Min-max-overeenkomst', contracturen: null, uren_min: 8, uren_max: 20 }),
      ),
    ).toContain('Uren Minimaal 8, maximaal 20 uur per week')
  })

  it('zegt bij een oproepcontract dat er geen vaste uren zijn', () => {
    expect(tekst(persoon({ contracttype: 'Nuluren-overeenkomst (oproep)' }))).toContain(
      'Uren Geen vaste uren (oproep)',
    )
  })
})
