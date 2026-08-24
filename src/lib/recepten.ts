import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Recepten. Zie docs/Modules/recepten.md.

   Geen meerekenen met hoeveelheden: staat er op de MEP "2 bakken", dan is dat
   een aantekening en geen som. Dat scheelt gedoe met eenheden en voorkomt dat de
   app fout rekent waar de kok het goed had.

   Ingrediënten zijn één tekstveld met een regel per ingrediënt. Sander schrijft
   ze zelf en dat moet vlot typen; een lijst regels leest net zo goed als een
   raster met velden. */

export type Recept = {
  id: number
  naam: string
  omschrijving: string | null
  basis: string | null
  ingredienten: string | null
  bereiding: string | null
  actief: boolean
  bijgewerkt_op: string
  bijgewerkt_door: string | null
}

export type ReceptFoto = {
  id: number
  recept_id: number
  pad: string
  bijschrift: string | null
  volgorde: number
}

const VELDEN =
  'id,naam,omschrijving,basis,ingredienten,bereiding,actief,bijgewerkt_op,bijgewerkt_door'

export function regelsVan(tekst: string | null) {
  return (tekst ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
}

export function useRecepten() {
  return useQuery({
    queryKey: ['recepten'],
    queryFn: async (): Promise<Recept[]> => {
      const { data, error } = await supabase
        .from('recepten')
        .select(VELDEN)
        .order('naam', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Recept[]
    },
  })
}

export function useRecept(id: number | undefined) {
  return useQuery({
    queryKey: ['recept', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Recept> => {
      const { data, error } = await supabase.from('recepten').select(VELDEN).eq('id', id!).single()
      if (error) throw new Error(error.message)
      return data as unknown as Recept
    },
  })
}

export function useReceptBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (r: Partial<Recept> & { naam: string }): Promise<number> => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const velden = {
        naam: r.naam.trim(),
        omschrijving: r.omschrijving?.trim() || null,
        basis: r.basis?.trim() || null,
        ingredienten: r.ingredienten?.trimEnd() || null,
        bereiding: r.bereiding?.trimEnd() || null,
        actief: r.actief ?? true,
        bijgewerkt_op: new Date().toISOString(),
        bijgewerkt_door: gebruiker.user?.email ?? null,
      }
      if (r.id) {
        const { error } = await supabase.from('recepten').update(velden).eq('id', r.id)
        if (error) throw new Error(error.message)
        return r.id
      }
      const { data, error } = await supabase.from('recepten').insert(velden).select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: number }).id
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['recepten'] })
      client.invalidateQueries({ queryKey: ['recept'] })
    },
  })
}

export function useReceptWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('recepten').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['recepten'] }),
  })
}

/* ----------------------------------------------------------------- foto's --- */

export function useReceptFotos(receptId: number | undefined) {
  return useQuery({
    queryKey: ['recept-fotos', receptId],
    enabled: Boolean(receptId),
    queryFn: async (): Promise<(ReceptFoto & { url: string })[]> => {
      const { data, error } = await supabase
        .from('recept_fotos')
        .select('id,recept_id,pad,bijschrift,volgorde')
        .eq('recept_id', receptId!)
        .order('volgorde', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      const fotos = (data ?? []) as unknown as ReceptFoto[]
      if (fotos.length === 0) return []

      // Eén keer ondertekenen voor alle foto's tegelijk; een uur is ruim genoeg
      // om een recept door te lezen.
      const { data: adressen, error: fout } = await supabase.storage
        .from('Documenten')
        .createSignedUrls(fotos.map((f) => f.pad), 3600)
      if (fout) throw new Error(fout.message)
      return fotos.map((f, i) => ({ ...f, url: adressen?.[i]?.signedUrl ?? '' }))
    },
  })
}

function veiligeNaam(naam: string) {
  const punt = naam.lastIndexOf('.')
  const kaal = (punt > 0 ? naam.slice(0, punt) : naam)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${kaal || 'foto'}${punt > 0 ? naam.slice(punt).toLowerCase() : ''}`
}

export function useFotoToevoegen(receptId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (bestand: File) => {
      const pad = `recepten/${receptId}/${Date.now()}-${veiligeNaam(bestand.name)}`
      const { error: opslagFout } = await supabase.storage
        .from('Documenten')
        .upload(pad, bestand, { contentType: bestand.type || undefined })
      if (opslagFout) throw new Error(opslagFout.message)

      const { error } = await supabase.from('recept_fotos').insert({ recept_id: receptId, pad })
      if (error) {
        await supabase.storage.from('Documenten').remove([pad])
        throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['recept-fotos'] }),
  })
}

export function useFotoWeg() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (foto: ReceptFoto) => {
      const { error } = await supabase.from('recept_fotos').delete().eq('id', foto.id)
      if (error) throw new Error(error.message)
      await supabase.storage.from('Documenten').remove([foto.pad])
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['recept-fotos'] }),
  })
}

/* --------------------------------------------------- koppeling aan de MEP --- */

export function useReceptAanTaak() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ taakId, receptId }: { taakId: number; receptId: number | null }) => {
      const { error } = await supabase
        .from('mep_sjablonen')
        .update({ recept_id: receptId })
        .eq('id', taakId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mep-taken'] }),
  })
}
