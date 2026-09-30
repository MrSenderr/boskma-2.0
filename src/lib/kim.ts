/* Kims vragen en wachtposten.

   Kim is de assistent die de mail en de wachtlijst bijhoudt. Wat ze niet zelf
   kan beslissen zet ze als vraag klaar; jij tikt het antwoord aan en zij voert
   het uit in haar volgende ronde. Zie kim-in-app/BOUWPLAN.md.

   Lezen mag alleen de beheerder (is_app_user). Antwoorden en afvinken gaat via
   twee databasefuncties, niet met een rechtstreekse update: zo kan er nooit
   iets anders veranderen dan het antwoord. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type KimVraag = {
  id: number
  vraag: string
  opties: string[] | null
  /** De letter die Kim aanraadt, bijvoorbeeld 'A'. */
  advies: string | null
  context: string | null
  gesteld_op: string
  antwoord: string | null
  beantwoord_op: string | null
}

export type KimWachtpost = {
  id: number
  richting: 'op_jou' | 'op_ander'
  wie: string
  wat: string
  sinds: string
  termijn: string | null
  /** Alleen gevuld als er iets veranderd is sinds de vorige ronde. */
  melding: string | null
  melding_op: string | null
}

export function useKimVragen() {
  return useQuery({
    queryKey: ['kim-vragen'],
    queryFn: async (): Promise<KimVraag[]> => {
      const { data, error } = await supabase
        .from('kim_vragen')
        .select('id,vraag,opties,advies,context,gesteld_op,antwoord,beantwoord_op')
        .is('afgehandeld_op', null)
        .order('gesteld_op')
      if (error) throw new Error(error.message)
      return (data ?? []) as KimVraag[]
    },
  })
}

export function useKimWachtposten() {
  return useQuery({
    queryKey: ['kim-wachtposten'],
    queryFn: async (): Promise<KimWachtpost[]> => {
      const { data, error } = await supabase
        .from('kim_wachtposten')
        .select('id,richting,wie,wat,sinds,termijn,melding,melding_op')
        .is('afgedaan_op', null)
        .order('termijn', { ascending: true, nullsFirst: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as KimWachtpost[]
    },
  })
}

export function useKimBeantwoorden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, antwoord }: { id: number; antwoord: string }) => {
      const { error } = await supabase.rpc('kim_beantwoord', { p_id: id, p_antwoord: antwoord })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['kim-vragen'] }),
  })
}

export function useKimWachtpostGeregeld() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('kim_wachtpost_geregeld', { p_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['kim-wachtposten'] }),
  })
}

/** De letter waarmee een optie begint: "A. Weggooien" → "A". */
export function letterVan(optie: string): string {
  return optie.trim().charAt(0).toUpperCase()
}

export function korteDatum(datum: string): string {
  return new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
