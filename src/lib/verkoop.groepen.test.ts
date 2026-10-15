/* De prijslijst met kopjes. Een product dat door een verkeerde volgorde onder
   het verkeerde kopje belandt is erger dan geen kopjes: dan zoek je het in de
   lijst waar het niet staat. */

import { describe, expect, it } from 'vitest'
import { perGroep, volgordeVoorGroep, type Product } from './verkoop'

const p = (naam: string, groep: string | null, volgorde: number): Product => ({
  id: naam.length,
  naam,
  omschrijving: null,
  prijs_incl: 1,
  btw_tarief: 9,
  eenheid: 'stuk',
  actief: true,
  groep,
  volgorde,
})

/* Zoals de database ze teruggeeft: op volgorde, daarbinnen op naam. */
const lijst = [
  p('Pistolet Kip', 'Pistolets', 1),
  p('Pistolet Gezond', 'Pistolets', 1),
  p('Witte bol Kipfilet', 'Bollen', 2),
  p('Handfruit', 'Dranken en fruit', 3),
]

describe('groeperen', () => {
  it('zet de producten onder hun kopje, in de volgorde van de lijst', () => {
    expect(perGroep(lijst).map((g) => [g.groep, g.producten.length])).toEqual([
      ['Pistolets', 2],
      ['Bollen', 1],
      ['Dranken en fruit', 1],
    ])
  })

  /* Zonder dit zou een product zonder groep nergens staan, en dan zoek je je
     rot naar iets wat je net hebt aangemaakt. */
  it('geeft een product zonder groep het kopje Overig', () => {
    const uit = perGroep([...lijst, p('Losse koffie', null, 9)])
    expect(uit[uit.length - 1]).toMatchObject({ groep: 'Overig' })
  })

  it('maakt van een lege lijst een lege lijst', () => {
    expect(perGroep([])).toEqual([])
  })
})

describe('welke volgorde een groep krijgt', () => {
  it('neemt de volgorde over van een groep die al bestaat', () => {
    expect(volgordeVoorGroep(lijst, 'Bollen')).toBe(2)
  })

  it('kijkt niet naar hoofdletters of spaties', () => {
    expect(volgordeVoorGroep(lijst, '  bollen ')).toBe(2)
  })

  it('zet een nieuwe groep achteraan', () => {
    expect(volgordeVoorGroep(lijst, 'Soepen')).toBe(4)
  })

  it('zet een product zonder groep ook achteraan', () => {
    expect(volgordeVoorGroep(lijst, null)).toBe(4)
  })

  it('begint bij één als er nog niets is', () => {
    expect(volgordeVoorGroep([], 'Pistolets')).toBe(1)
  })
})
