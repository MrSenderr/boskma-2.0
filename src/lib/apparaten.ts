import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Apparaten staan niet in de code. Sander richt ze zelf in; een ander bedrijf
   zou dat net zo goed moeten kunnen. Zie docs/modules/haccp/haccpmodule.md. */

export type Meetmoment = 'opening' | 'sluiting' | 'beide'

export type Apparaat = {
  id: number
  naam: string
  type: string
  actief: boolean
  min_temp: number | null
  max_temp: number | null
  signaal_min: number | null
  signaal_max: number | null
  meetmoment: Meetmoment
  volgorde: number | null
  opmerking: string | null
}

/** Bij het kiezen van een soort vult de app gangbare grenzen alvast in. Je mag
 *  ze overschrijven — het is een vertrekpunt, geen wet. Controleer ze aan je
 *  eigen hygiënecode. */
export const SOORTEN: { waarde: string; label: string; min: number | null; max: number | null }[] = [
  { waarde: 'koeling', label: 'Koeling', min: 0, max: 7 },
  { waarde: 'vriezer', label: 'Vriezer', min: -25, max: -18 },
  { waarde: 'warmhoudunit', label: 'Warmhoudunit', min: 60, max: null },
  { waarde: 'friteuse', label: 'Friteuse', min: null, max: null },
  { waarde: 'overig', label: 'Overig', min: null, max: null },
]

export const MEETMOMENTEN: { waarde: Meetmoment; label: string }[] = [
  { waarde: 'opening', label: 'Bij opening' },
  { waarde: 'sluiting', label: 'Bij sluiting' },
  { waarde: 'beide', label: 'Opening én sluiting' },
]

export function soortVan(waarde: string) {
  return SOORTEN.find((s) => s.waarde === waarde) ?? SOORTEN[SOORTEN.length - 1]
}

/** Leesbare weergave van de grenzen, bijvoorbeeld "0 tot 7 °C" of "min. 60 °C". */
export function grenzenTekst(a: Pick<Apparaat, 'min_temp' | 'max_temp'>) {
  const { min_temp: min, max_temp: max } = a
  if (min === null && max === null) return 'Geen grenzen'
  if (min !== null && max !== null) return `${min} tot ${max} °C`
  if (min !== null) return `min. ${min} °C`
  return `max. ${max} °C`
}

const VELDEN =
  'id,naam,type,actief,min_temp,max_temp,signaal_min,signaal_max,meetmoment,volgorde,opmerking'

export function useApparaten() {
  return useQuery({
    queryKey: ['apparaten'],
    queryFn: async (): Promise<Apparaat[]> => {
      const { data, error } = await supabase
        .from('haccp_apparaten')
        .select(VELDEN)
        .order('volgorde', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Apparaat[]
    },
  })
}

export function useApparaatBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (a: Partial<Apparaat> & { naam: string }) => {
      const { id, ...rest } = a
      const { error } = id
        ? await supabase.from('haccp_apparaten').update(rest).eq('id', id)
        : await supabase.from('haccp_apparaten').insert(rest)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['apparaten'] }),
  })
}

export function useApparaatVerplaatsen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (rijen: { id: number; volgorde: number }[]) => {
      for (const r of rijen) {
        const { error } = await supabase
          .from('haccp_apparaten')
          .update({ volgorde: r.volgorde })
          .eq('id', r.id)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['apparaten'] }),
  })
}

/** Verwijderen mag alleen als er nog nooit mee gemeten is. Anders zou het
 *  logboek van vorig jaar gaten krijgen; dan zet je hem op non-actief. */
export async function heeftMetingen(id: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('apparaat_heeft_metingen', { apparaat: id })
  if (error) return true // bij twijfel niet verwijderen
  return Boolean(data)
}

export function useApparaatVerwijderen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      if (await heeftMetingen(id)) {
        throw new Error(
          'Er zijn al metingen met dit apparaat. Zet hem op non-actief in plaats van verwijderen, anders krijgt je logboek gaten.',
        )
      }
      const { error } = await supabase.from('haccp_apparaten').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['apparaten'] }),
  })
}
