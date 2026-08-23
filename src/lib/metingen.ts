import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Apparaat } from './apparaten'

/* De temperatuurronde. Zie docs/modules/haccp/haccpmodule.md.
   Regel die vastligt: bij een afwijking is de meting niet af totdat er staat
   wat eraan gedaan is. */

export type Meting = {
  id: number
  apparaat_id: number | null
  apparaat_naam: string
  temperatuur: number
  afwijking: boolean
  datum: string
  tijd: string
  door_naam: string | null
  actie: string | null
  opmerking: string | null
  meetmoment: string
}

export const ACTIES = [
  'Thermostaat bijgesteld',
  'Deur stond open',
  'Product weggegooid',
  'Monteur gebeld',
  'Anders',
]

export function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE') // jjjj-mm-dd in lokale tijd
}

/** Buiten de grenzen? Leeg betekent: geen grens, dus nooit een afwijking. */
export function isAfwijking(a: Apparaat, temp: number) {
  if (a.min_temp !== null && temp < a.min_temp) return true
  if (a.max_temp !== null && temp > a.max_temp) return true
  return false
}

/** Binnen de wettelijke grens, maar buiten je eigen strengere signaalgrens.
 *  Dan is het geen afwijking, maar wel iets om in de gaten te houden. */
export function isSignaal(a: Apparaat, temp: number) {
  if (isAfwijking(a, temp)) return false
  if (a.signaal_min !== null && temp < a.signaal_min) return true
  if (a.signaal_max !== null && temp > a.signaal_max) return true
  return false
}

export function useMetingenVandaag(meetmoment: string) {
  return useQuery({
    queryKey: ['metingen', vandaagStr(), meetmoment],
    queryFn: async (): Promise<Meting[]> => {
      const { data, error } = await supabase
        .from('haccp_temps')
        .select('id,apparaat_id,apparaat_naam,temperatuur,afwijking,datum,tijd,door_naam,actie,opmerking,meetmoment')
        .eq('datum', vandaagStr())
        .eq('meetmoment', meetmoment)
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Meting[]
    },
  })
}

export function useMetingBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (m: {
      apparaat: Apparaat
      temperatuur: number
      meetmoment: string
      actie?: string | null
      opmerking?: string | null
      doorNaam: string
      doorGebruiker: string | undefined
    }) => {
      const nu = new Date()
      const { error } = await supabase.from('haccp_temps').insert({
        apparaat_id: m.apparaat.id,
        apparaat_naam: m.apparaat.naam,
        temperatuur: m.temperatuur,
        afwijking: isAfwijking(m.apparaat, m.temperatuur),
        datum: vandaagStr(),
        tijd: nu.toTimeString().slice(0, 8),
        meetmoment: m.meetmoment,
        actie: m.actie ?? null,
        opmerking: m.opmerking ?? null,
        door_naam: m.doorNaam,
        door_gebruiker: m.doorGebruiker ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['metingen'] }),
  })
}
