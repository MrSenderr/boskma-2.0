/* Samenstellingen: wat een portie je kost.

   Een samenstelling is een recept — een burger, een saus, een menu. Hij
   verwijst naar inkoopartikelen en naar andere samenstellingen. Het rekenwerk
   staat in foodcost.ts; hier wordt alleen opgehaald en bijgewerkt. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { bereken, type Berekend, type Samenstelling, type SamenstellingRegel } from './foodcost'
import { STANDAARD, metKostprijzen, useDoelen, useLaatstePrijzen } from './stuksprijzen'

const inkoop = supabase.schema('inkoop')

const VELDEN =
  'id, naam, groep, opbrengst, eenheidnaam, verkoopprijs, btw_pct, prijs_bron, vet_opslag, doel_foodcost, notitie'

/* Alles in één keer: de prijzen, de recepten en de regels. Doorrekenen gebeurt
   van onderaf omhoog, dus losse stukjes ophalen zou niet eens kunnen. */
export function useSamenstellingen() {
  const prijzen = useLaatstePrijzen()
  const doelen = useDoelen()

  const recepten = useQuery({
    queryKey: ['inkoop', 'samenstellingen'],
    queryFn: async () => {
      const [s, r] = await Promise.all([
        inkoop.from('samenstellingen').select(VELDEN).order('groep').order('naam'),
        inkoop.from('samenstelling_regels').select('*'),
      ])
      if (s.error) throw new Error(s.error.message)
      if (r.error) throw new Error(r.error.message)
      return {
        samenstellingen: (s.data ?? []) as unknown as Samenstelling[],
        regels: (r.data ?? []) as unknown as SamenstellingRegel[],
      }
    },
  })

  const bezig = prijzen.isPending || doelen.isPending || recepten.isPending
  const fout = prijzen.error ?? doelen.error ?? recepten.error ?? null

  let alles: Berekend[] = []
  if (!bezig && !fout && recepten.data && prijzen.data) {
    const d = doelen.data ?? STANDAARD
    const { bekend, onbekend } = metKostprijzen(prijzen.data)
    alles = bereken(recepten.data.samenstellingen, recepten.data.regels, [...bekend, ...onbekend], d)
  }

  return {
    alles,
    doelen: doelen.data ?? STANDAARD,
    isPending: bezig,
    error: fout,
    refetch: () => {
      prijzen.refetch()
      doelen.refetch()
      recepten.refetch()
    },
  }
}

function vernieuw(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: ['inkoop', 'samenstellingen'] })
}

export function useNieuweSamenstelling() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (nieuw: { naam: string; groep: string | null }) => {
      const { data, error } = await inkoop
        .from('samenstellingen')
        .insert(nieuw)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return (data as { id: number }).id
    },
    onSuccess: () => vernieuw(client),
  })
}

export function useWijzigSamenstelling() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...velden }: { id: number } & Partial<Samenstelling>) => {
      const { error } = await inkoop
        .from('samenstellingen')
        .update({ ...velden, gewijzigd: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => vernieuw(client),
  })
}

export function useSamenstellingWeg() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await inkoop.from('samenstellingen').delete().eq('id', id)
      if (error) {
        /* Een onderdeel dat nog ergens in zit mag niet zomaar weg — dan zou de
           burger stilletjes goedkoper worden. */
        throw new Error(
          error.code === '23503'
            ? 'Dit onderdeel zit nog in een ander product. Haal het daar eerst uit.'
            : error.message,
        )
      }
    },
    onSuccess: () => vernieuw(client),
  })
}

export function useRegelToevoegen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (regel: Omit<SamenstellingRegel, 'id'>) => {
      const { error } = await inkoop.from('samenstelling_regels').insert(regel)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => vernieuw(client),
  })
}

export function useRegelWeg() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await inkoop.from('samenstelling_regels').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => vernieuw(client),
  })
}
