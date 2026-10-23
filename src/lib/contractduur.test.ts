/* De einddatum die meeloopt met de ingangsdatum. Een dag ernaast betekent een
   contract dat een dag te lang of te kort doorloopt, en dat gaat zo naar het
   loonbureau. */

import { describe, expect, it } from 'vitest'
import { eindeErbij, eindeNaJaar, type Persoon } from './personeel'

describe('een jaar later, een dag ervoor', () => {
  it('rekent een gewoon jaar uit', () => {
    expect(eindeNaJaar('2026-11-01')).toBe('2027-10-31')
    expect(eindeNaJaar('2026-01-01')).toBe('2026-12-31')
  })

  it('houdt de laatste dag van de maand heel', () => {
    expect(eindeNaJaar('2026-03-01')).toBe('2027-02-28')
    expect(eindeNaJaar('2026-12-31')).toBe('2027-12-30')
  })

  /* 2028 is een schrikkeljaar. Een jaar na 29 februari bestaat niet, dus dat
     wordt 1 maart; de dag ervoor is 28 februari. */
  it('struikelt niet over 29 februari', () => {
    expect(eindeNaJaar('2028-02-29')).toBe('2029-02-28')
    expect(eindeNaJaar('2027-03-01')).toBe('2028-02-29')
  })

  it('kan ook meer dan een jaar', () => {
    expect(eindeNaJaar('2026-11-01', 2)).toBe('2028-10-31')
  })

  it('geeft niets terug bij een lege of onzinnige datum', () => {
    expect(eindeNaJaar(null)).toBeNull()
    expect(eindeNaJaar('')).toBeNull()
    expect(eindeNaJaar('morgen')).toBeNull()
    expect(eindeNaJaar('2026-13-45')).toBeNull()
  })
})

describe('wanneer de einddatum meeschuift', () => {
  const p = (anders: Partial<Persoon>): Persoon =>
    ({
      id: 'a',
      voornaam: 'Maartje',
      achternaam: 'Bulterman',
      status: 'aangenomen',
      fase: 'medewerker',
      is_eigenaar: false,
      aangemeld_op: null,
      aangenomen_op: null,
      onboarding_verstuurd_op: null,
      onboarding_ingevuld_op: null,
      loonbureau_verstuurd_op: null,
      loonbureau_bevestigd_op: null,
      uit_dienst_op: null,
      contractduur: 'bepaalde',
      ingangsdatum: null,
      einddatum: null,
      ...anders,
    }) as Persoon

  it('vult de einddatum als die nog leeg is', () => {
    expect(eindeErbij(p({}), '2026-11-01')).toEqual({ einddatum: '2027-10-31' })
  })

  /* Verbeter je een typefout in de startdatum, dan hoort de einddatum mee te
     schuiven — anders klopt het contract niet meer. */
  it('schuift mee als de einddatum nog de berekende was', () => {
    const huidig = p({ ingangsdatum: '2026-11-01', einddatum: '2027-10-31' })
    expect(eindeErbij(huidig, '2026-12-01')).toEqual({ einddatum: '2027-11-30' })
  })

  /* Maar een halfjaarcontract dat jij met de hand hebt ingevuld blijft staan.
     Dat is een afspraak, geen suggestie. */
  it('laat een zelf ingevulde einddatum met rust', () => {
    const huidig = p({ ingangsdatum: '2026-11-01', einddatum: '2027-05-01' })
    expect(eindeErbij(huidig, '2026-12-01')).toEqual({})
  })

  it('doet niets bij een contract voor onbepaalde tijd', () => {
    expect(eindeErbij(p({ contractduur: 'onbepaalde' }), '2026-11-01')).toEqual({})
  })

  it('doet niets als de ingangsdatum wordt leeggemaakt', () => {
    expect(eindeErbij(p({ ingangsdatum: '2026-11-01', einddatum: '2027-10-31' }), null)).toEqual({})
  })
})
