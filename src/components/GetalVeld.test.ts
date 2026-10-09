/* Een prijs moet je gewoon kunnen typen. Dat klinkt vanzelfsprekend, maar het
   ging mis: "6," is onderweg geen geldig getal, en daar sprong het veld op
   terug naar nul. */

import { describe, expect, it } from 'vitest'
import { leesGetal, schrijfGetal } from './GetalVeld'

describe('een getal lezen', () => {
  it('leest een bedrag met een komma', () => {
    expect(leesGetal('6,02')).toBe(6.02)
  })

  it('leest er ook een met een punt', () => {
    expect(leesGetal('6.02')).toBe(6.02)
  })

  it('houdt een half afgemaakt getal heel', () => {
    expect(leesGetal('6,')).toBe(6)
    expect(leesGetal('6')).toBe(6)
  })

  it('geeft niets terug bij een leeg veld', () => {
    expect(leesGetal('')).toBeNull()
    expect(leesGetal(',')).toBeNull()
  })

  it('negeert wat geen cijfer is', () => {
    expect(leesGetal('€ 6,02')).toBe(6.02)
  })
})

describe('een getal schrijven', () => {
  it('schrijft met een komma', () => {
    expect(schrijfGetal(6.02)).toBe('6,02')
  })

  it('laat een rond getal rond', () => {
    expect(schrijfGetal(75)).toBe('75')
  })

  it('laat het veld leeg als er niets is', () => {
    expect(schrijfGetal(null)).toBe('')
    expect(schrijfGetal(undefined)).toBe('')
  })

  it('laat nul ook leeg, want dat is geen prijs', () => {
    expect(schrijfGetal(0)).toBe('')
  })
})
