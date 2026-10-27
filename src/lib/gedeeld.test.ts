/* De serverfuncties hebben een eigen kopie van de modules die ze gebruiken,
   omdat ze niet bij src/lib kunnen. Twee kopieën van dezelfde logica is precies
   hoe het misging met het schema van de inkoop-app: allebei de kanten dachten
   dat zij gelijk hadden.
 *
 * Deze toets valt om zodra ze uit elkaar lopen. Draai dan:
 *   node scripts/kopieer-lezers.mjs
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const KOPIEEN: Record<string, string[]> = {
  'supabase/functions/rooster-inlezen/gedeeld': ['xlsx-lezen.ts', 'eitje.ts', 'koppelen.ts'],
  'supabase/functions/eitje-uren/gedeeld': ['eitjeApi.ts', 'koppelen.ts'],
}

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
  for (const [naar, bestanden] of Object.entries(KOPIEEN)) {
    for (const naam of bestanden) {
      it(`${naam} in ${naar} is gelijk aan het origineel`, () => {
        expect(readFileSync(`${naar}/${naam}`, 'utf8')).toBe(kopieInhoud(naam))
      })
    }
  }
})
