/* Het uurloon volgens de cao.
 *
 * De toetsen gaan vooral over de dag waarop gerekend wordt. Een jeugdloon
 * springt op een verjaardag, en een contract gaat zelden vandaag in: wie de
 * verkeerde dag neemt, zet een heel jaar het verkeerde bedrag in een
 * arbeidsovereenkomst. */

import { describe, expect, it } from 'vitest'
import { caoUurloon, euro, leeftijdOp, onderCao, tabelOp } from './cao'

describe('leeftijd op een bepaalde dag', () => {
  it('telt het jaar pas mee vanaf de verjaardag', () => {
    expect(leeftijdOp('2011-01-14', '2027-01-13')).toBe(15)
    expect(leeftijdOp('2011-01-14', '2027-01-14')).toBe(16)
  })

  it('rekent vooruit zowel als terug', () => {
    expect(leeftijdOp('2009-03-14', '2026-10-26')).toBe(17)
    expect(leeftijdOp('2009-03-14', '2024-10-26')).toBe(15)
  })

  it('geeft niets terug bij een onzinnige datum', () => {
    expect(leeftijdOp('geen datum', '2026-10-26')).toBeNull()
  })
})

describe('welke tabel geldt', () => {
  it('neemt de tabel die op die dag al inging', () => {
    expect(tabelOp('2026-10-26')?.vanaf).toBe('2026-07-01')
    expect(tabelOp('2026-07-01')?.vanaf).toBe('2026-07-01')
  })

  /* Vóór de oudste tabel weet de app het niet. Dan hoort hij te zwijgen in
     plaats van het nieuwste bedrag te noemen alsof dat toen al gold. */
  it('zwijgt over een dag vóór de oudste tabel', () => {
    expect(tabelOp('2026-06-30')).toBeNull()
  })
})

describe('het uurloon uit de tabel', () => {
  // De bedragen die Boskma nu betaalt aan de jongsten, uit de KHN-tabel.
  it('kent de tredes van vijftien tot eenentwintig', () => {
    const op = '2026-10-26'
    const bij = (geboren: string) => caoUurloon(geboren, op)?.bedrag
    expect(bij('2011-03-01')).toBe(5.25) // 15
    expect(bij('2010-03-01')).toBe(6.75) // 16
    expect(bij('2009-03-01')).toBe(8.24) // 17
    expect(bij('2008-03-01')).toBe(9.74) // 18
    expect(bij('2007-03-01')).toBe(11.24) // 19
    expect(bij('2006-03-01')).toBe(12.74) // 20
    expect(bij('2005-03-01')).toBe(14.99) // 21
  })

  it('houdt boven de eenentwintig hetzelfde bedrag aan', () => {
    expect(caoUurloon('1985-01-03', '2026-10-26')?.bedrag).toBe(14.99)
    expect(caoUurloon('1960-01-03', '2026-10-26')?.bedrag).toBe(14.99)
  })

  /* Hier zit de winst: een contract dat ingaat nádat iemand jarig is, hoort
     het hogere bedrag te krijgen. Rekenen met vandaag zou Dylan een heel jaar
     op het tarief van een vijftienjarige vastzetten. */
  it('rekent met de ingangsdatum en niet met vandaag', () => {
    const geboren = '2011-01-14'
    expect(caoUurloon(geboren, '2027-01-13')?.bedrag).toBe(5.25)
    expect(caoUurloon(geboren, '2027-01-14')?.bedrag).toBe(6.75)
  })

  it('zwijgt onder de vijftien en zonder geboortedatum', () => {
    expect(caoUurloon('2013-01-01', '2026-10-26')).toBeNull()
    expect(caoUurloon(null, '2026-10-26')).toBeNull()
  })
})

describe('te laag betaald', () => {
  const geboren = '2009-03-01' // 17 jaar, tabel € 8,24

  it('meldt een bedrag onder de tabel', () => {
    expect(onderCao(7.5, geboren, '2026-10-26')?.bedrag).toBe(8.24)
  })

  it('zwijgt bij precies het tabelbedrag en bij meer', () => {
    expect(onderCao(8.24, geboren, '2026-10-26')).toBeNull()
    expect(onderCao(12.5, geboren, '2026-10-26')).toBeNull()
  })

  /* Een cent eronder is een afrondingsverschil, geen onderbetaling. Thijmen
     staat op € 8,25 en Denzel op € 8,24; daar hoort geen melding bij. */
  it('maakt van een afronding geen kwestie', () => {
    expect(onderCao(8.2399, geboren, '2026-10-26')).toBeNull()
  })

  it('zwijgt als er geen bedrag of geen geboortedatum is', () => {
    expect(onderCao(null, geboren, '2026-10-26')).toBeNull()
    expect(onderCao(5, null, '2026-10-26')).toBeNull()
  })
})

describe('bedragen opschrijven', () => {
  it('zet er een komma in, geen punt', () => {
    expect(euro(8.24)).toBe('€ 8,24')
    expect(euro(14.99)).toBe('€ 14,99')
    expect(euro(5)).toBe('€ 5,00')
  })
})
