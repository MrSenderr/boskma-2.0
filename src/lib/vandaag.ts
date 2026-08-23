import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Wat er op het Vandaag-scherm staat naast de ronde: verjaardagen van collega's
   en losse taken die aan iemand zijn toegewezen. */

export type Verjaardag = { naam: string; dag: number; maand: number }

export type PersoonlijkeTaak = {
  id: number
  medewerker_id: string
  tekst: string
  toelichting: string | null
  datum: string
  gedaan_op: string | null
}

/** Collega's zien elkaars naam en dag, niet het geboortejaar. Die afscherming
 *  zit in de database, niet hier. */
export function useVerjaardagen() {
  return useQuery({
    queryKey: ['verjaardagen'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Verjaardag[]> => {
      const { data, error } = await supabase.rpc('verjaardagen')
      if (error) throw new Error(error.message)
      return (data ?? []) as Verjaardag[]
    },
  })
}

/** Wie is er vandaag jarig, en wie deze week nog? */
export function jarigen(lijst: Verjaardag[]) {
  const nu = new Date()
  const dag = nu.getDate()
  const maand = nu.getMonth() + 1
  const vandaag = lijst.filter((v) => v.dag === dag && v.maand === maand)

  const komend = lijst
    .map((v) => {
      const dit = new Date(nu.getFullYear(), v.maand - 1, v.dag)
      if (dit < new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()))
        dit.setFullYear(nu.getFullYear() + 1)
      const dagen = Math.round((dit.getTime() - new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime()) / 86_400_000)
      return { ...v, dagen }
    })
    .filter((v) => v.dagen > 0 && v.dagen <= 7)
    .sort((a, b) => a.dagen - b.dagen)

  return { vandaag, komend }
}

export function useMijnTaken(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['persoonlijke-taken', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<PersoonlijkeTaak[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select('id,medewerker_id,tekst,toelichting,datum,gedaan_op')
        .eq('medewerker_id', medewerkerId!)
        .lte('datum', new Date().toLocaleDateString('sv-SE'))
        .order('datum', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PersoonlijkeTaak[]
    },
  })
}

export function useTakenVan(medewerkerId: string) {
  return useQuery({
    queryKey: ['taken-van', medewerkerId],
    queryFn: async (): Promise<PersoonlijkeTaak[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select('id,medewerker_id,tekst,toelichting,datum,gedaan_op')
        .eq('medewerker_id', medewerkerId)
        .order('datum', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PersoonlijkeTaak[]
    },
  })
}

export function useTaakAfvinken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, gedaan }: { id: number; gedaan: boolean }) => {
      const { error } = await supabase.rpc('taak_afvinken', { taak: id, gedaan })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['persoonlijke-taken'] })
      client.invalidateQueries({ queryKey: ['taken-van'] })
    },
  })
}

export function useTaakGeven() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (t: { medewerker_id: string; tekst: string; datum: string; aangemaakt_door: string }) => {
      const { error } = await supabase.from('persoonlijke_taken').insert(t)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken-van'] }),
  })
}

export function useTaakWeghalen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('persoonlijke_taken').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken-van'] }),
  })
}
