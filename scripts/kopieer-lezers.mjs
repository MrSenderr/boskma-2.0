/* De uitlezers van eitje staan in src/lib, maar de serverfunctie kan daar niet
   bij: die krijgt alleen zijn eigen map mee. Daarom staat er een kopie in
   supabase/functions/rooster-inlezen/gedeeld.
 *
 * Twee kopieën van dezelfde logica is precies hoe het vanmorgen misging bij
 * het schema van de inkoop-app. Vandaar: die kopie wordt gemáákt, nooit met de
 * hand bijgewerkt, en gedeeld.test.ts valt om zodra ze uit elkaar lopen.
 *
 *   node scripts/kopieer-lezers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/* Welke serverfunctie welke modules meekrijgt. koppelen.ts staat bij beide:
   de Excel-import en de API-koppeling moeten namen op precies dezelfde manier
   aan mensen koppelen, anders koppelt de ene wat de andere laat liggen. */
export const KOPIEEN = {
  'supabase/functions/rooster-inlezen/gedeeld': ['xlsx-lezen.ts', 'eitje.ts', 'koppelen.ts'],
  'supabase/functions/eitje-uren/gedeeld': ['eitjeApi.ts', 'koppelen.ts'],
}

export function kopieInhoud(naam) {
  const bron = readFileSync(`src/lib/${naam}`, 'utf8')
    // Deno wil de extensie erbij; Vite juist niet. Daarom hier, bij het maken
    // van de kopie, en niet in het origineel.
    .replace(/from '(\.\/[^']+)'/g, (_, pad) => `from '${pad}.ts'`)
  return `/* GEMAAKT DOOR scripts/kopieer-lezers.mjs — niet met de hand wijzigen.\n   Het origineel is src/lib/${naam}. */\n\n${bron}`
}

/* Alleen draaien als je dit script zelf start. Werd het uitgevoerd bij het
   importeren, dan maakte de toets de kopieën opnieuw en keurde hij zijn eigen
   werk goed. */
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const [naar, bestanden] of Object.entries(KOPIEEN)) {
    mkdirSync(naar, { recursive: true })
    for (const naam of bestanden) {
      writeFileSync(`${naar}/${naam}`, kopieInhoud(naam))
      console.log(`gekopieerd: ${naam} -> ${naar}`)
    }
  }
}
