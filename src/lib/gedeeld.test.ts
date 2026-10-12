/* De serverfunctie rooster-inlezen heeft een eigen kopie van de uitlezers,
   omdat hij niet bij src/lib kan. Twee kopieën van dezelfde logica is precies
   hoe het misging met het schema van de inkoop-app: allebei de kanten dachten
   dat zij gelijk hadden.
 *
 * Deze toets valt om zodra ze uit elkaar lopen. Draai dan:
 *   node scripts/kopieer-lezers.mjs
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const BESTANDEN = ['xlsx-lezen.ts', 'eitje.ts']

/** Dezelfde omzetting als scripts/kopieer-lezers.mjs doet. */
function kopieInhoud(naam: string): string {
  const bron = readFileSync(`src/lib/${naam}`, 'utf8').replace(
    /from '(\.\/[^']+)'/g,
    (_, pad: string) => `from '${pad}.ts'`,
  )
  return `/* GEMAAKT DOOR scripts/kopieer-lezers.mjs — niet met de hand wijzigen.
   Het origineel is src/lib/${naam}. */

${bron}`
}

describe('de kopie voor de serverfunctie', () => {
  for (const naam of BESTANDEN) {
    it(`${naam} is gelijk aan het origineel`, () => {
      const opSchijf = readFileSync(
        `supabase/functions/rooster-inlezen/gedeeld/${naam}`,
        'utf8',
      )
      expect(opSchijf).toBe(kopieInhoud(naam))
    })
  }
})
