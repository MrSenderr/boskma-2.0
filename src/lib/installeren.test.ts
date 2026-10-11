import { describe, expect, it } from 'vitest'
import { soortToestel, stappenVoor } from './installeren'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

describe('welk toestel iemand gebruikt', () => {
  it('herkent een iPhone', () => {
    expect(soortToestel(IPHONE)).toBe('ios')
  })

  it('herkent een Android-telefoon', () => {
    expect(soortToestel(ANDROID)).toBe('android')
  })

  /* Een Mac zonder aanraakscherm is geen telefoon. Een iPad meldt zich ook als
     Mac, maar die heeft er wel een — dat onderscheid maakt navigator, niet de
     tekst, dus hier blijft het "anders". */
  it('houdt een gewone Mac buiten de telefoonuitleg', () => {
    expect(soortToestel(MAC)).toBe('anders')
  })

  it('valt bij iets onbekends terug op anders', () => {
    expect(soortToestel('iets heel anders')).toBe('anders')
  })
})

describe('de stappen', () => {
  it('noemen bij een iPhone de deelknop', () => {
    expect(stappenVoor('ios')[0]).toContain('deelknopje')
    expect(stappenVoor('ios').some((s) => s.includes('beginscherm'))).toBe(true)
  })

  it('noemen bij Android de drie puntjes', () => {
    expect(stappenVoor('android')[0]).toContain('drie puntjes')
  })

  /* Op een laptop heeft het geen zin; dan hoort er geen uitleg te komen in
     plaats van een uitleg die nergens op slaat. */
  it('zijn er niet voor een laptop', () => {
    expect(stappenVoor('anders')).toEqual([])
  })
})
