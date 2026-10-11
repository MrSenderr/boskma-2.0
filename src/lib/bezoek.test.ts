import { describe, expect, it } from 'vitest'
import { geledenTekst } from './bezoek'

const nu = new Date('2026-10-11T14:00:00')

describe('hoe lang iemand niet in de app is geweest', () => {
  it('rekent in hele dagen, niet in uren', () => {
    // Vanochtend vroeg is nog steeds vandaag.
    expect(geledenTekst('2026-10-11T07:30:00', nu)).toBe('vandaag')
    // En gisteravond laat is gisteren, geen "0 dagen geleden".
    expect(geledenTekst('2026-10-10T23:50:00', nu)).toBe('gisteren')
  })

  it('telt de dagen tot twee weken', () => {
    expect(geledenTekst('2026-10-08T12:00:00', nu)).toBe('3 dagen geleden')
    expect(geledenTekst('2026-09-30T12:00:00', nu)).toBe('11 dagen geleden')
  })

  it('gaat daarna over op weken', () => {
    expect(geledenTekst('2026-09-20T12:00:00', nu)).toBe('3 weken geleden')
  })

  it('noemt na twee maanden gewoon de maand', () => {
    expect(geledenTekst('2026-07-15T12:00:00', nu)).toBe('juli 2026')
  })

  it('zegt het eerlijk als iemand er nooit is geweest', () => {
    expect(geledenTekst(null, nu)).toBe('nog nooit')
    expect(geledenTekst(undefined, nu)).toBe('nog nooit')
    expect(geledenTekst('geen datum', nu)).toBe('nog nooit')
  })
})
