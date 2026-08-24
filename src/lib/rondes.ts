import type { Apparaat, Meetmoment } from './apparaten'
import type { Meting } from './metingen'

/* Wanneer welke ronde aan de beurt is. Zie docs/Modules/haccp/haccpmodule.md.

   De zaak is open tot 20:00 en daarna wordt er schoongemaakt, dus vanaf 19:00
   is de sluitingsronde aan de beurt. Eén getal, hier, zodat het veranderen van
   openingstijden geen zoektocht door de schermen wordt. */

export const SLUITING_VANAF_UUR = 19

export const RONDES: { moment: Exclude<Meetmoment, 'beide'>; label: string }[] = [
  { moment: 'opening', label: 'Openingsronde' },
  { moment: 'sluiting', label: 'Sluitingsronde' },
]

/** Welke ronde staat er nu voor de deur? */
export function rondeVanNu(): Exclude<Meetmoment, 'beide'> {
  return new Date().getHours() >= SLUITING_VANAF_UUR ? 'sluiting' : 'opening'
}

/** 'beide' telt bij allebei de rondes mee. */
export function apparatenVoor(apparaten: Apparaat[], moment: Meetmoment) {
  return apparaten.filter((a) => a.actief && (a.meetmoment === moment || a.meetmoment === 'beide'))
}

export function standVan(apparaten: Apparaat[], metingen: Meting[] | undefined) {
  const gedaan = apparaten.filter((a) => (metingen ?? []).some((m) => m.apparaat_id === a.id)).length
  return { gedaan, totaal: apparaten.length, klaar: apparaten.length > 0 && gedaan === apparaten.length }
}
