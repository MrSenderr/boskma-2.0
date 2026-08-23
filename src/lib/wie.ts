import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Wie is er ingelogd: beheerder of medewerker? Dat bepaalt de database, niet de
   app — zie huidige_medewerker() en is_app_user() in de migraties. */

export type Rol = 'beheerder' | 'medewerker'

export type WieBenIk = {
  rol: Rol
  naam: string
  medewerker_id: string | null
}

export function useWieBenIk() {
  return useQuery({
    queryKey: ['wie-ben-ik'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<WieBenIk> => {
      const { data, error } = await supabase.rpc('wie_ben_ik')
      if (error) throw new Error(error.message)
      const rij = Array.isArray(data) ? data[0] : data
      return {
        rol: (rij?.rol ?? 'medewerker') as Rol,
        naam: rij?.naam ?? '',
        medewerker_id: rij?.medewerker_id ?? null,
      }
    },
  })
}

/** Vraagt een inloglink aan. Geeft bewust altijd hetzelfde terug, ook als het
 *  adres niet bestaat — anders kun je hiermee uitvinden wie er werkt. */
export async function vraagInloglink(email: string) {
  const { data, error } = await supabase.functions.invoke('stuur-inloglink', {
    body: { email },
  })
  if (error) return { ok: false as const, error: error.message }
  return data as { ok: boolean; verstuurd?: boolean; testmodus?: boolean; verstuurd_naar?: string; error?: string }
}

/** Wisselt de zes cijfers uit de mail in voor een sessie. Supabase noemt dit
 *  soort code afhankelijk van hoe hij is aangemaakt anders, dus we proberen
 *  beide varianten voordat we het opgeven. */
export async function inlogMetCode(email: string, code: string) {
  const schoon = code.replace(/\D/g, '')
  for (const type of ['email', 'magiclink'] as const) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: schoon,
      type,
    })
    if (!error) return null
    if (!/token|otp|invalid|expired/i.test(error.message)) return error.message
  }
  return 'Die code klopt niet, of hij is verlopen. Vraag een nieuwe aan.'
}
