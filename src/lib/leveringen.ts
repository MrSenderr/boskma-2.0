import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { vandaagStr } from './metingen'

/* Leveringen aftekenen. Zie docs/Modules/haccp/haccpmodule.md.

   Wat er vastligt: wie het bracht, hoe koud het was, en of je het hebt
   aangenomen. Bij weigeren staat erbij waarom — anders is een geweigerde
   levering later niet uit te leggen. Wijzigen of weggooien kan niet: wat je hebt
   afgetekend blijft staan. */

export type Levering = {
  id: number
  datum: string
  leverancier: string
  temperatuur: number
  ok: boolean
  opmerking: string | null
  door_naam: string | null
  employee_naam: string | null
  created_at: string | null
}

const VELDEN = 'id,datum,leverancier,temperatuur,ok,opmerking,door_naam,employee_naam,created_at'

function vanaf(dagen: number) {
  const d = new Date()
  d.setDate(d.getDate() - dagen + 1)
  return d.toLocaleDateString('sv-SE')
}

export function useLeveringen(dagen = 30) {
  return useQuery({
    queryKey: ['leveringen', dagen],
    queryFn: async (): Promise<Levering[]> => {
      const { data, error } = await supabase
        .from('haccp_leveringen')
        .select(VELDEN)
        .gte('datum', vanaf(dagen))
        .order('datum', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Levering[]
    },
  })
}

export function useLeveringenVandaag() {
  return useQuery({
    queryKey: ['leveringen-vandaag', vandaagStr()],
    staleTime: 0,
    queryFn: async (): Promise<Levering[]> => {
      const { data, error } = await supabase
        .from('haccp_leveringen')
        .select(VELDEN)
        .eq('datum', vandaagStr())
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Levering[]
    },
  })
}

/** De namen die je eerder hebt ingetikt, zodat de tweede keer Sligro één tik is. */
export function useLeveranciers() {
  return useQuery({
    queryKey: ['leveranciers'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('haccp_leveringen')
        .select('leverancier')
        .order('id', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      const namen = (data ?? []).map((r) => (r as { leverancier: string }).leverancier)
      return [...new Set(namen.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'))
    },
  })
}

export function useLeveringBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (l: {
      leverancier: string
      temperatuur: number
      ok: boolean
      opmerking: string | null
      medewerkerId: string | null | undefined
      doorNaam: string
    }) => {
      const { error } = await supabase.from('haccp_leveringen').insert({
        datum: vandaagStr(),
        leverancier: l.leverancier.trim(),
        temperatuur: l.temperatuur,
        ok: l.ok,
        opmerking: l.opmerking,
        medewerker_id: l.medewerkerId ?? null,
        door_naam: l.doorNaam,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['leveringen'] })
      client.invalidateQueries({ queryKey: ['leveringen-vandaag'] })
      client.invalidateQueries({ queryKey: ['leveranciers'] })
    },
  })
}
