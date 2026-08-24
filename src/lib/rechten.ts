import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useWieBenIk } from './wie'

/* Wat iemand extra mag. Zie docs/Modules/rechten.md.

   Losse vinkjes, geen rollen: wie de recepten bijhoudt hoeft daarom nog niet bij
   het personeel te kunnen. Wat je hier leest bepaalt alleen welke knoppen er
   staan — de echte grens ligt in de database, in heeft_recht(). */

export type Recht = 'recepten' | 'mep' | 'haccp' | 'kas'

export const RECHTEN: { waarde: Recht; label: string; uitleg: string }[] = [
  {
    waarde: 'recepten',
    label: 'Recepten bijhouden',
    uitleg: 'Mag recepten schrijven en aanpassen. Lezen mag iedereen.',
  },
  {
    waarde: 'mep',
    label: 'MEP-taken beheren',
    uitleg: 'Mag de vaste voorbereidingslijst aanpassen — taken toevoegen, hernoemen, uitzetten.',
  },
  {
    waarde: 'haccp',
    label: 'HACCP beheren',
    uitleg: 'Mag apparaten en werklijsten aanpassen. Metingen doen mag iedereen al.',
  },
  {
    waarde: 'kas',
    label: 'De kas tellen',
    uitleg:
      'Mag de kastelling doen en bij de kluis. Dit gaat over geld — geef het alleen aan wie de zaak ook afsluit.',
  },
]

export function useMijnRechten() {
  const { data: wie } = useWieBenIk()
  return useQuery({
    queryKey: ['mijn-rechten', wie?.medewerker_id, wie?.rol],
    enabled: Boolean(wie),
    queryFn: async (): Promise<Recht[]> => {
      // Als beheerder heb je alles; dat hoeft niet in een tabel te staan.
      if (wie?.rol === 'beheerder') return RECHTEN.map((r) => r.waarde)
      if (!wie?.medewerker_id) return []
      const { data, error } = await supabase
        .from('medewerker_rechten')
        .select('recht')
        .eq('medewerker_id', wie.medewerker_id)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => (r as { recht: Recht }).recht)
    },
  })
}

export function magIk(rechten: Recht[] | undefined, recht: Recht) {
  return (rechten ?? []).includes(recht)
}

/* ------------------------------------------------------------- beheerkant --- */

export function useRechtenVan(medewerkerId: string | undefined) {
  return useQuery({
    queryKey: ['rechten-van', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Recht[]> => {
      const { data, error } = await supabase
        .from('medewerker_rechten')
        .select('recht')
        .eq('medewerker_id', medewerkerId!)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => (r as { recht: Recht }).recht)
    },
  })
}

export function useRechtZetten(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ recht, aan }: { recht: Recht; aan: boolean }) => {
      if (aan) {
        const { data: gebruiker } = await supabase.auth.getUser()
        const { error } = await supabase.from('medewerker_rechten').insert({
          medewerker_id: medewerkerId,
          recht,
          gegeven_door: gebruiker.user?.email ?? null,
        })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('medewerker_rechten')
          .delete()
          .eq('medewerker_id', medewerkerId)
          .eq('recht', recht)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['rechten-van'] })
      client.invalidateQueries({ queryKey: ['mijn-rechten'] })
    },
  })
}
