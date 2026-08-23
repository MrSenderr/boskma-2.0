import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* De drie werklijsten. Zie docs/modules/haccp/haccpmodule.md.
   Niets staat in de code: lijsten, hoeken en taken zijn allemaal invoer. */

export type Lijst = 'openen' | 'voorbereiden' | 'sluiten'
export type Ritme = 'dagelijks' | 'wekelijks'

export type Taak = {
  id: number
  naam: string
  lijst: Lijst | null
  hoek: string | null
  toelichting: string | null
  ritme: Ritme
  dagen: number[] | null
  volgorde: number | null
  actief: boolean
}

export const LIJSTEN: { waarde: Lijst; label: string }[] = [
  { waarde: 'openen', label: 'Openen' },
  { waarde: 'voorbereiden', label: 'Voorbereiden' },
  { waarde: 'sluiten', label: 'Sluiten' },
]

export const RITMES: { waarde: Ritme; label: string }[] = [
  { waarde: 'dagelijks', label: 'Elke dag' },
  { waarde: 'wekelijks', label: 'Eén keer per week' },
]

/** Hoeken worden niet vastgelegd in een aparte tabel: het is gewoon de naam die
 *  bij een taak staat. Zo kun je er een verzinnen zonder ergens iets aan te
 *  maken, en verdwijnt hij vanzelf als de laatste taak weg is. */
export function hoekenVan(taken: Taak[]): string[] {
  const gezien = new Map<string, number>()
  taken.forEach((t) => {
    const h = t.hoek ?? 'Overig'
    if (!gezien.has(h)) gezien.set(h, t.volgorde ?? 0)
  })
  return [...gezien.entries()].sort((a, b) => a[1] - b[1]).map(([h]) => h)
}

export function hoekLabel(hoek: string) {
  return hoek.charAt(0).toUpperCase() + hoek.slice(1)
}

const VELDEN = 'id,naam,lijst,hoek,toelichting,ritme,dagen,volgorde,actief'

export function useTaken() {
  return useQuery({
    queryKey: ['taken'],
    queryFn: async (): Promise<Taak[]> => {
      const { data, error } = await supabase
        .from('haccp_taken')
        .select(VELDEN)
        .order('volgorde', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Taak[]
    },
  })
}

export function useTaakBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (t: Partial<Taak> & { naam: string }) => {
      const { id, ...rest } = t
      const { error } = id
        ? await supabase.from('haccp_taken').update(rest).eq('id', id)
        : await supabase.from('haccp_taken').insert(rest)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken'] }),
  })
}

export function useTaakVerplaatsen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (rijen: { id: number; volgorde: number }[]) => {
      for (const r of rijen) {
        const { error } = await supabase
          .from('haccp_taken')
          .update({ volgorde: r.volgorde })
          .eq('id', r.id)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken'] }),
  })
}

export function useTaakVerwijderen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('haccp_taken').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken'] }),
  })
}
