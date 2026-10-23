/* De einddatum die meeloopt met de ingangsdatum. Een dag ernaast betekent een
   contract dat een dag te lang of te kort doorloopt, en dat gaat zo naar het
   loonbureau. */

import { describe, expect, it } from 'vitest'
import { eindeErbij, eindeNa, eindeNaJaar, gekozenDuur, type Persoon } from './personeel'

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

describe('de lengtes uit het keuzelijstje', () => {
  it('rekent een half jaar uit', () => {
    expect(eindeNa('2026-11-01', 6)).toBe('2027-04-30')
    expect(eindeNa('2026-01-01', 6)).toBe('2026-06-30')
  })

  it('rekent twee jaar uit', () => {
    expect(eindeNa('2026-11-01', 24)).toBe('2028-10-31')
  })

  /* Een half jaar vanaf eind februari komt in augustus uit, niet in juli. */
  it('telt maanden en geen dagen', () => {
    expect(eindeNa('2026-02-28', 6)).toBe('2026-08-27')
    expect(eindeNa('2026-04-30', 6)).toBe('2026-10-29')
  })
})

describe('welke duur er in de lijst staat', () => {
  const p = (anders: Partial<Persoon>): Persoon =>
    ({ id: 'a', contractduur: 'bepaalde', ingangsdatum: '2026-11-01', einddatum: null, ...anders }) as Persoon

  it('herkent een halfjaarcontract aan de datums', () => {
    expect(gekozenDuur(p({ einddatum: '2027-04-30' }))).toBe('half')
  })

  it('herkent een jaarcontract', () => {
    expect(gekozenDuur(p({ einddatum: '2027-10-31' }))).toBe('jaar')
  })

  it('herkent twee jaar', () => {
    expect(gekozenDuur(p({ einddatum: '2028-10-31' }))).toBe('tweejaar')
  })

  /* Past het bij geen enkele lengte, dan heb je hem zelf gezet — en dan moet
     de lijst dat zeggen en niet net doen alsof het een jaarcontract is. */
  it('zegt "zelf" bij een datum die nergens bij past', () => {
    expect(gekozenDuur(p({ einddatum: '2027-05-01' }))).toBe('zelf')
  })

  it('zegt niets zolang er geen einddatum staat', () => {
    expect(gekozenDuur(p({}))).toBe('')
  })

  it('kent onbepaalde tijd', () => {
    expect(gekozenDuur(p({ contractduur: 'onbepaalde' }))).toBe('onbepaalde')
  })
})

describe('de gekozen lengte blijft bij een nieuwe startdatum', () => {
  const p = (anders: Partial<Persoon>): Persoon =>
    ({ id: 'a', contractduur: 'bepaalde', ingangsdatum: '2026-11-01', einddatum: null, ...anders }) as Persoon

  /* Had je een half jaar gekozen, dan hoort een correctie op de startdatum
     geen jaarcontract van je contract te maken. */
  it('houdt een half jaar een half jaar', () => {
    expect(eindeErbij(p({ einddatum: '2027-04-30' }), '2026-12-01')).toEqual({
      einddatum: '2027-05-31',
    })
  })

  it('houdt twee jaar twee jaar', () => {
    expect(eindeErbij(p({ einddatum: '2028-10-31' }), '2026-12-01')).toEqual({
      einddatum: '2028-11-30',
    })
  })

  it('gaat uit van een jaar als er nog niets staat', () => {
    expect(eindeErbij(p({}), '2026-12-01')).toEqual({ einddatum: '2027-11-30' })
  })
})
