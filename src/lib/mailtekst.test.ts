/* Dit is wat de klant leest. Daarom staat hij vast in een test: een tikfout
   hierin gaat de deur uit zonder dat iemand er nog naar kijkt. */

import { describe, expect, it } from 'vitest'
import { standaardMailtekst } from './verkoop'

const f = { onderwerp: 'Lunch 15 oktober', totaal_incl: 476.5, vervaldatum: '2026-11-08' }

describe('de mail bij een factuur', () => {
  it('spreekt de contactpersoon aan', () => {
    expect(standaardMailtekst({ contactpersoon: 'Leonie' }, f, '4')).toContain('Beste Leonie,')
  })

  it('valt terug op de administratie als er geen naam is', () => {
    expect(standaardMailtekst({ contactpersoon: null }, f, '4')).toContain('Beste administratie,')
  })

  it('noemt het nummer, het onderwerp, het bedrag en de vervaldatum', () => {
    const t = standaardMailtekst({ contactpersoon: 'Leonie' }, f, '4')
    expect(t).toContain('factuur 4 voor Lunch 15 oktober')
    expect(t).toContain('€ 476,50')
    expect(t).toContain('vóór 8 november 2026')
  })

  it('laat het onderwerp weg als er geen is', () => {
    const t = standaardMailtekst({ contactpersoon: 'Leonie' }, { ...f, onderwerp: null }, '4')
    expect(t).toContain('factuur 4.')
    expect(t).not.toContain('voor null')
  })

  it('ondertekent met Sander', () => {
    expect(standaardMailtekst({ contactpersoon: null }, f, '4')).toContain('Sander Boskma')
  })
})
