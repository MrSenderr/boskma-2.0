import type { Apparaat, Meetmoment } from './apparaten'
import type { Meting } from './metingen'

/* Wanneer welke ronde aan de beurt is. Zie docs/Modules/haccp/haccpmodule.md.

   Het uur waarop de sluitingsronde aan de beurt is, staat niet meer los
   ingesteld: het volgt de sluitingstijd uit het rooster (zie
   docs/Modules/openingstijden.md). Verandert de zaak van openingstijden, dan
   schuift de ronde vanzelf mee. */

export const RONDES: { moment: Exclude<Meetmoment, 'beide'>; label: string }[] = [
  { moment: 'opening', label: 'Openingsronde' },
  { moment: 'sluiting', label: 'Sluitingsronde' },
]

/** Welke ronde staat er nu voor de deur? */
export function rondeVanNu(sluitingsrondeVanafUur: number): Exclude<Meetmoment, 'beide'> {
  return new Date().getHours() >= sluitingsrondeVanafUur ? 'sluiting' : 'opening'
}

/** 'beide' telt bij allebei de rondes mee. */
export function apparatenVoor(apparaten: Apparaat[], moment: Meetmoment) {
  return apparaten.filter((a) => a.actief && (a.meetmoment === moment || a.meetmoment === 'beide'))
}

export function standVan(apparaten: Apparaat[], metingen: Meting[] | undefined) {
  const gedaan = apparaten.filter((a) => (metingen ?? []).some((m) => m.apparaat_id === a.id)).length
  return { gedaan, totaal: apparaten.length, klaar: apparaten.length > 0 && gedaan === apparaten.length }
}
