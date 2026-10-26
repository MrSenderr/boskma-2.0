/* Het uurloon volgens de cao.
 *
 * De toetsen gaan vooral over de dag waarop gerekend wordt. Een jeugdloon
 * springt op een verjaardag, en een contract gaat zelden vandaag in: wie de
 * verkeerde dag neemt, zet een heel jaar het verkeerde bedrag in een
 * arbeidsovereenkomst. */

import { describe, expect, it } from 'vitest'
import {
  caoUurloon,
  euro,
  isVakkracht,
  leeftijdOp,
  onderCao,
  tabelOp,
  vakkrachtDoetErtoe,
} from './cao'

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

/* De tweede bodem: vakkracht of niet.
 *
 * Dit is waar het geld zit. Bij achttien scheelt het meer dan twee euro per
 * uur, en wie het verkeerd zet betaalt een jaar lang te weinig of te veel. */
describe('vakkracht', () => {
  const op = '2026-10-26'

  it('kent de drie tredes waar het om gaat', () => {
    expect(caoUurloon('2008-03-01', op, true)?.bedrag).toBe(11.99) // 18
    expect(caoUurloon('2007-03-01', op, true)?.bedrag).toBe(13.49) // 19
    expect(caoUurloon('2006-03-01', op, true)?.bedrag).toBe(14.99) // 20
  })

  /* Onder de achttien bestaat een vakkracht niet. Dan hoort de app te zwijgen
     in plaats van het bedrag van een achttienjarige te noemen. */
  it('bestaat niet onder de achttien', () => {
    expect(caoUurloon('2010-03-01', op, true)).toBeNull()
  })

  it('maakt vanaf eenentwintig geen verschil meer', () => {
    expect(caoUurloon('2005-03-01', op, true)?.bedrag).toBe(14.99)
    expect(caoUurloon('2005-03-01', op, false)?.bedrag).toBe(14.99)
  })

  /* De vraag alleen stellen waar hij iets oplevert. Bij Kate van zestien en
     bij Ilona van eenenveertig is het geen voorzichtigheid maar ruis. */
  it('doet er alleen toe bij 18, 19 en 20', () => {
    expect(vakkrachtDoetErtoe('2010-03-01', op)).toBe(false) // 16
    expect(vakkrachtDoetErtoe('2009-03-01', op)).toBe(false) // 17
    expect(vakkrachtDoetErtoe('2008-03-01', op)).toBe(true) // 18
    expect(vakkrachtDoetErtoe('2006-03-01', op)).toBe(true) // 20
    expect(vakkrachtDoetErtoe('2005-03-01', op)).toBe(false) // 21
    expect(vakkrachtDoetErtoe('1985-01-03', op)).toBe(false) // 41
  })

  it('meldt te laag tegen de bodem die bij deze persoon hoort', () => {
    const geboren = '2008-03-01' // 18 jaar
    expect(onderCao(10, geboren, op, false)).toBeNull()
    expect(onderCao(10, geboren, op, true)?.bedrag).toBe(11.99)
  })
})

describe('vanaf wanneer iemand vakkracht is', () => {
  it('telt niet mee vóór de dag waarop het inging', () => {
    const p = { vakkracht: 'diploma', vakkracht_sinds: '2026-09-01' }
    expect(isVakkracht(p, '2026-08-31')).toBe(false)
    expect(isVakkracht(p, '2026-09-01')).toBe(true)
  })

  /* Zonder datum geldt het gewoon. Dat is het geval van iemand die al jaren
     een diploma heeft en bij wie niemand meer weet sinds wanneer. */
  it('geldt zonder datum altijd', () => {
    expect(isVakkracht({ vakkracht: 'ervaring', vakkracht_sinds: null }, '2020-01-01')).toBe(true)
  })

  /* Leeg is onbekend en "nee" is beantwoord. Allebei leveren ze dezelfde
     bodem op, maar het scherm moet er iets anders mee doen. */
  it('rekent zowel bij nee als bij onbekend met de gewone staffel', () => {
    expect(isVakkracht({ vakkracht: 'nee' }, '2026-10-26')).toBe(false)
    expect(isVakkracht({ vakkracht: null }, '2026-10-26')).toBe(false)
  })
})
