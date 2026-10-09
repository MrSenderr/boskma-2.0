/* Of een factuur te laat is bepaalt of je hem vandaag moet betalen. Dat
   rekenwerk staat los van het scherm, zodat het te toetsen is — zeker omdat de
   helft van de facturen geen vervaldatum heeft. */

import { describe, expect, it } from 'vitest'
import {
  dagenTeLaat,
  deelIn,
  euro,
  gmailLink,
  kortDatum,
  opUiterlijk,
  telOp,
  uiterlijk,
  urgentie,
  zonderBedrag,
  type Factuur,
} from './facturen'

function factuur(anders: Partial<Factuur> = {}): Factuur {
  return {
    id: 1,
    leverancier: 'Veldboer',
    factuurnummer: '2018932',
    soort: 'factuur',
    factuurdatum: '2026-10-01',
    vervaldatum: null,
    bedrag_incl: 43.12,
    betaalwijze: 'handmatig',
    iban: 'NL00BANK0123456789',
    betalingskenmerk: '2018932',
    status: 'open',
    betaald_op: null,
    basecone_op: null,
    gmail_thread: 'abc123',
    opmerking: null,
    ...anders,
  }
}

describe('bedragen en datums', () => {
  it('schrijft een bedrag in euro', () => {
    expect(euro(1234.56)).toBe('€ 1.234,56')
  })

  it('zegt het eerlijk als het bedrag niet bekend is', () => {
    expect(euro(null)).toBe('bedrag onbekend')
  })

  it('schrijft een datum kort', () => {
    expect(kortDatum('2026-10-14')).toBe('14 okt')
    expect(kortDatum(null)).toBe('')
  })
})

describe('wanneer moet het betaald zijn', () => {
  it('neemt de vervaldatum als die er staat', () => {
    expect(uiterlijk(factuur({ vervaldatum: '2026-10-20' }))).toBe('2026-10-20')
  })

  it('valt terug op veertien dagen na de factuurdatum', () => {
    expect(uiterlijk(factuur({ factuurdatum: '2026-10-01' }))).toBe('2026-10-15')
  })

  it('valt daarna terug op het moment dat hij naar Basecone ging', () => {
    const f = factuur({ factuurdatum: null, basecone_op: '2026-10-02T08:00:00Z' })
    expect(uiterlijk(f)).toBe('2026-10-16')
  })

  it('geeft niets terug als er helemaal geen datum is', () => {
    expect(uiterlijk(factuur({ factuurdatum: null, basecone_op: null }))).toBeNull()
  })
})

describe('hoe dringend', () => {
  const vandaag = '2026-10-09'

  it('is te laat als de datum voorbij is', () => {
    expect(urgentie(factuur({ vervaldatum: '2026-10-08' }), vandaag)).toBe('te_laat')
  })

  it('is bijna aan de beurt binnen drie dagen', () => {
    expect(urgentie(factuur({ vervaldatum: '2026-10-12' }), vandaag)).toBe('bijna')
    expect(urgentie(factuur({ vervaldatum: '2026-10-09' }), vandaag)).toBe('bijna')
  })

  it('heeft nog rust daarbuiten', () => {
    expect(urgentie(factuur({ vervaldatum: '2026-10-13' }), vandaag)).toBe('rustig')
  })

  it('weet het niet zonder datum', () => {
    expect(urgentie(factuur({ factuurdatum: null }), vandaag)).toBe('geen_datum')
  })

  it('telt hoeveel dagen te laat', () => {
    expect(dagenTeLaat(factuur({ vervaldatum: '2026-10-04' }), vandaag)).toBe(5)
    expect(dagenTeLaat(factuur({ vervaldatum: '2026-10-20' }), vandaag)).toBe(0)
  })
})

describe('de volgorde', () => {
  it('zet de vroegste datum bovenaan', () => {
    const laat = factuur({ id: 1, vervaldatum: '2026-10-20' })
    const vroeg = factuur({ id: 2, vervaldatum: '2026-10-10' })
    expect([laat, vroeg].sort(opUiterlijk).map((f) => f.id)).toEqual([2, 1])
  })

  it('zet wie geen datum heeft onderaan', () => {
    const geen = factuur({ id: 1, factuurdatum: null })
    const wel = factuur({ id: 2, vervaldatum: '2026-11-30' })
    expect([geen, wel].sort(opUiterlijk).map((f) => f.id)).toEqual([2, 1])
  })
})

describe('optellen', () => {
  it('telt de bedragen op', () => {
    expect(telOp([factuur({ bedrag_incl: 10 }), factuur({ bedrag_incl: 2.5 })])).toBe(12.5)
  })

  it('slaat een onbekend bedrag over en meldt hoeveel dat er zijn', () => {
    const lijst = [factuur({ bedrag_incl: 10 }), factuur({ bedrag_incl: null })]
    expect(telOp(lijst)).toBe(10)
    expect(zonderBedrag(lijst)).toBe(1)
  })
})

describe('de indeling van het scherm', () => {
  const vandaag = '2026-10-09'
  const alles = [
    factuur({ id: 1, betaalwijze: 'handmatig' }),
    factuur({ id: 2, betaalwijze: 'onbekend' }),
    factuur({ id: 3, betaalwijze: 'incasso' }),
    factuur({ id: 4, betaalwijze: 'handmatig', soort: 'creditnota' }),
    factuur({ id: 5, status: 'betaald', betaald_op: '2026-10-05' }),
    factuur({ id: 6, status: 'betaald', betaald_op: '2026-08-01' }),
  ]

  it('zet een handmatige factuur bij zelf betalen', () => {
    expect(deelIn(alles, vandaag).zelfBetalen.map((f) => f.id)).toEqual([1])
  })

  it("houdt creditnota's uit zelf betalen", () => {
    const d = deelIn(alles, vandaag)
    expect(d.zelfBetalen.some((f) => f.soort === 'creditnota')).toBe(false)
    expect(d.onbekend.some((f) => f.soort === 'creditnota')).toBe(false)
    expect(d.creditnotas.map((f) => f.id)).toEqual([4])
  })

  it('laat alleen de laatste dertig dagen betaald zien', () => {
    expect(deelIn(alles, vandaag).betaald.map((f) => f.id)).toEqual([5])
  })

  it('zet incasso apart', () => {
    expect(deelIn(alles, vandaag).incasso.map((f) => f.id)).toEqual([3])
  })
})

describe('de link naar de mail', () => {
  it('wijst naar de thread in Gmail', () => {
    expect(gmailLink('abc123')).toBe('https://mail.google.com/mail/u/0/#all/abc123')
  })

  it('geeft niets als er geen thread bij zit', () => {
    expect(gmailLink(null)).toBeNull()
  })
})
