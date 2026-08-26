import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Werkwijzen: hoe je iets doet. Zie docs/Modules/werkwijzen.md.

   Naast recepten, niet erin. Een recept gaat over iets maken met ingrediënten;
   een werkwijze over hoe je iets doet — sla drogen, filters schoonmaken. Dat
   laatste heeft geen ingrediënten, en dan is "recept" het verkeerde woord.

   Genummerde stappen met per stap een foto, want dat is hoe je het volgt terwijl
   je ermee bezig bent. */

export type Werkwijze = {
  id: number
  naam: string
  omschrijving: string | null
  actief: boolean
  bijgewerkt_op: string
  bijgewerkt_door: string | null
}

export type WerkwijzeStap = {
  id: number
  werkwijze_id: number
  volgorde: number
  tekst: string
  foto_pad: string | null
}

const VELDEN = 'id,naam,omschrijving,actief,bijgewerkt_op,bijgewerkt_door'

export function useWerkwijzen() {
  return useQuery({
    queryKey: ['werkwijzen'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Werkwijze[]> => {
      const { data, error } = await supabase
        .from('werkwijzen')
        .select(VELDEN)
        .order('naam', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Werkwijze[]
    },
  })
}

export function useWerkwijze(id: number | undefined) {
  return useQuery({
    queryKey: ['werkwijze', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Werkwijze> => {
      const { data, error } = await supabase.from('werkwijzen').select(VELDEN).eq('id', id!).single()
      if (error) throw new Error(error.message)
      return data as unknown as Werkwijze
    },
  })
}

export function useStappen(werkwijzeId: number | undefined) {
  return useQuery({
    queryKey: ['werkwijze-stappen', werkwijzeId],
    enabled: Boolean(werkwijzeId),
    queryFn: async (): Promise<WerkwijzeStap[]> => {
      const { data, error } = await supabase
        .from('werkwijze_stappen')
        .select('id,werkwijze_id,volgorde,tekst,foto_pad')
        .eq('werkwijze_id', werkwijzeId!)
        .order('volgorde', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as WerkwijzeStap[]
    },
  })
}

export function useWerkwijzeBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (w: Partial<Werkwijze> & { naam: string }): Promise<number> => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const velden = {
        naam: w.naam.trim(),
        omschrijving: w.omschrijving?.trim() || null,
        actief: w.actief ?? true,
        bijgewerkt_op: new Date().toISOString(),
        bijgewerkt_door: gebruiker.user?.email ?? null,
      }
      if (w.id) {
        const { error } = await supabase.from('werkwijzen').update(velden).eq('id', w.id)
        if (error) throw new Error(error.message)
        return w.id
      }
      const { data, error } = await supabase.from('werkwijzen').insert(velden).select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: number }).id
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['werkwijzen'] })
      client.invalidateQueries({ queryKey: ['werkwijze'] })
    },
  })
}

export function useWerkwijzeWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('werkwijzen').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkwijzen'] }),
  })
}

function veiligeNaam(naam: string) {
  const punt = naam.lastIndexOf('.')
  const kaal = (punt > 0 ? naam.slice(0, punt) : naam)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${kaal || 'foto'}${punt > 0 ? naam.slice(punt).toLowerCase() : ''}`
}

export async function fotoOpslaan(werkwijzeId: number, bestand: File): Promise<string> {
  const pad = `werkwijzen/${werkwijzeId}/${Date.now()}-${veiligeNaam(bestand.name)}`
  const { error } = await supabase.storage
    .from('Documenten')
    .upload(pad, bestand, { contentType: bestand.type || undefined })
  if (error) throw new Error(error.message)
  return pad
}

/** De hele stappenlijst in één keer wegschrijven. Simpeler dan per stap
 *  bijhouden wat er veranderd is, en bij een handvol stappen kost het niets. */
export function useStappenBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      werkwijzeId,
      stappen,
    }: {
      werkwijzeId: number
      stappen: { tekst: string; foto_pad: string | null }[]
    }) => {
      const { error: weg } = await supabase
        .from('werkwijze_stappen')
        .delete()
        .eq('werkwijze_id', werkwijzeId)
      if (weg) throw new Error(weg.message)
      if (stappen.length === 0) return
      const { error } = await supabase.from('werkwijze_stappen').insert(
        stappen.map((s, i) => ({
          werkwijze_id: werkwijzeId,
          volgorde: i + 1,
          tekst: s.tekst.trim(),
          foto_pad: s.foto_pad,
        })),
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkwijze-stappen'] }),
  })
}

/* ------------------------------------------------------------ koppelingen --- */

export function useWerkwijzeAanMepTaak() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ taakId, werkwijzeId }: { taakId: number; werkwijzeId: number | null }) => {
      const { error } = await supabase
        .from('mep_sjablonen')
        .update({ werkwijze_id: werkwijzeId })
        .eq('id', taakId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mep-taken'] }),
  })
}

export function useWerkwijzeAanHaccpTaak() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ taakId, werkwijzeId }: { taakId: number; werkwijzeId: number | null }) => {
      const { error } = await supabase
        .from('haccp_taken')
        .update({ werkwijze_id: werkwijzeId })
        .eq('id', taakId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['taken'] })
      client.invalidateQueries({ queryKey: ['werklijst'] })
    },
  })
}
