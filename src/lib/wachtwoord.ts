import { supabase } from './supabase'

/* Een nieuw wachtwoord kiezen.

   Supabase zet het op het account waarmee je nu bent ingelogd; je hoeft je
   oude dus niet te weten. Dat is precies wat je nodig hebt als je binnenkomt
   met een herstelcode — en de reden dat je bij het instellen al ingelogd moet
   zijn. */

export const KORTSTE = 8

export async function zetWachtwoord(nieuw: string): Promise<string | null> {
  if (nieuw.length < KORTSTE) return `Neem er minstens ${KORTSTE} tekens.`
  const { error } = await supabase.auth.updateUser({ password: nieuw })
  if (!error) return null
  if (/same.*password|should be different/i.test(error.message)) {
    return 'Dat is je huidige wachtwoord. Kies een ander.'
  }
  if (/weak|pwned|compromised/i.test(error.message)) {
    return 'Dit wachtwoord is te makkelijk te raden. Kies een ander.'
  }
  return 'Het lukte niet om je wachtwoord te wijzigen. Probeer het zo nog eens.'
}
