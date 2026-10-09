/* De volgorde van de regels is de volgorde op de factuur. Verplaatsen mag
   nooit een regel kwijtmaken of dubbel neerzetten. */

import { describe, expect, it } from 'vitest'
import { verwissel, type Regel } from './verkoop'

const r = (naam: string, i: number): Regel => ({
  volgorde: i, product_id: null, omschrijving: naam, aantal: 1, prijs_incl: 1, btw_tarief: 9,
})

const lijst = [r('Soep', 0), r('Broodje', 1), r('Fris', 2)]
const namen = (l: Regel[]) => l.map((x) => x.omschrijving)

describe('regels verplaatsen', () => {
  it('schuift een regel omhoog', () => {
    expect(namen(verwissel(lijst, 1, 0))).toEqual(['Broodje', 'Soep', 'Fris'])
  })

  it('schuift een regel omlaag', () => {
    expect(namen(verwissel(lijst, 0, 1))).toEqual(['Broodje', 'Soep', 'Fris'])
  })

  it('nummert de volgorde opnieuw', () => {
    expect(verwissel(lijst, 2, 0).map((x) => x.volgorde)).toEqual([0, 1, 2])
  })

  it('raakt geen regel kwijt en maakt er geen dubbel', () => {
    const uit = verwissel(lijst, 2, 0)
    expect(uit).toHaveLength(3)
    expect(new Set(namen(uit)).size).toBe(3)
  })

  it('laat de oorspronkelijke lijst met rust', () => {
    verwissel(lijst, 0, 2)
    expect(namen(lijst)).toEqual(['Soep', 'Broodje', 'Fris'])
  })
})
