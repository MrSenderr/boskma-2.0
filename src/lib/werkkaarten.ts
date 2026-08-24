import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Werkkaarten: hoe je een gerecht opbouwt. Zie docs/Modules/werkkaarten.md.

   Los van recepten, met opzet. Een recept gaat over de voorbereiding, een
   werkkaart over de service — hoe stapel ik dit broodje terwijl er twintig
   mensen staan. */

export type Weergave = 'lijst' | 'stapel'

export type Categorie = {
  id: number
  naam: string
  volgorde: number
  weergave: Weergave
  gedeelde_bereiding: string | null
  bereiding_minuten: number | null
  bereiding_label: string | null
  actief: boolean
}

export type Werkkaart = {
  id: number
  categorie_id: number
  naam: string
  weergave: Weergave | null
  gebruikt_gedeelde: boolean
  eigen_bereiding: string | null
  bereiding_minuten: number | null
  bereiding_label: string | null
  foto_pad: string | null
  broodje: boolean
  volgorde: number
  actief: boolean
}

export type Stap = {
  id: number
  kaart_id: number
  volgorde: number
  tekst: string
  apparaat: boolean
  minuten: number | null
  kleur: string | null
}

/** De kleuren van de stapel, zoals op de papieren kaart. */
export const KLEUREN: { waarde: string; label: string; klasse: string }[] = [
  { waarde: 'groente', label: 'Groente', klasse: 'bg-[#3E8E5A] text-white' },
  { waarde: 'vlees', label: 'Vlees', klasse: 'bg-[#5A3220] text-white' },
  { waarde: 'bacon', label: 'Bacon', klasse: 'bg-[#B4462E] text-white' },
  { waarde: 'kaas', label: 'Kaas of ei', klasse: 'bg-[#E8C33C] text-[#2A2100]' },
  { waarde: 'saus', label: 'Saus', klasse: 'bg-[#E08A2E] text-[#2A1600]' },
  { waarde: 'brood', label: 'Brood', klasse: 'bg-[#C8A06A] text-[#2A1D06]' },
  { waarde: 'overig', label: 'Overig', klasse: 'bg-surface-2 text-text' },
]

export function kleurKlasse(kleur: string | null) {
  return KLEUREN.find((k) => k.waarde === kleur)?.klasse ?? 'bg-surface-2 text-text'
}

export function weergaveVan(kaart: Werkkaart, categorie: Categorie | undefined): Weergave {
  return kaart.weergave ?? categorie?.weergave ?? 'lijst'
}

export function useCategorieen() {
  return useQuery({
    queryKey: ['werkkaart-categorieen'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Categorie[]> => {
      const { data, error } = await supabase
        .from('werkkaart_categorieen')
        .select('id,naam,volgorde,weergave,gedeelde_bereiding,bereiding_minuten,bereiding_label,actief')
        .eq('actief', true)
        .order('volgorde', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Categorie[]
    },
  })
}

export function useWerkkaarten() {
  return useQuery({
    queryKey: ['werkkaarten'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Werkkaart[]> => {
      const { data, error } = await supabase
        .from('werkkaarten')
        .select('id,categorie_id,naam,weergave,gebruikt_gedeelde,eigen_bereiding,bereiding_minuten,bereiding_label,foto_pad,broodje,volgorde,actief')
        .eq('actief', true)
        .order('volgorde', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Werkkaart[]
    },
  })
}

export function useStappen(kaartId: number | undefined) {
  return useQuery({
    queryKey: ['werkkaart-stappen', kaartId],
    enabled: Boolean(kaartId),
    queryFn: async (): Promise<Stap[]> => {
      const { data, error } = await supabase
        .from('werkkaart_stappen')
        .select('id,kaart_id,volgorde,tekst,apparaat,minuten,kleur')
        .eq('kaart_id', kaartId!)
        .order('volgorde', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Stap[]
    },
  })
}

/* ---------------------------------------------------------------- beheren --- */

export function useKaartBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (k: Partial<Werkkaart> & { naam: string; categorie_id: number }): Promise<number> => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const velden = {
        categorie_id: k.categorie_id,
        naam: k.naam.trim(),
        weergave: k.weergave ?? null,
        gebruikt_gedeelde: k.gebruikt_gedeelde ?? true,
        eigen_bereiding: k.eigen_bereiding?.trim() || null,
        bereiding_minuten: k.bereiding_minuten ?? null,
        bereiding_label: k.bereiding_label?.trim() || null,
        broodje: k.broodje ?? false,
        volgorde: k.volgorde ?? 999,
        actief: k.actief ?? true,
        bijgewerkt_op: new Date().toISOString(),
        bijgewerkt_door: gebruiker.user?.email ?? null,
      }
      if (k.id) {
        const { error } = await supabase.from('werkkaarten').update(velden).eq('id', k.id)
        if (error) throw new Error(error.message)
        return k.id
      }
      const { data, error } = await supabase.from('werkkaarten').insert(velden).select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: number }).id
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkkaarten'] }),
  })
}

export function useKaartWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('werkkaarten').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkkaarten'] }),
  })
}

/** De hele stappenlijst in één keer wegschrijven. Simpeler dan per stap
 *  bijhouden wat er veranderd is, en bij een handvol stappen kost het niets. */
export function useStappenBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ kaartId, stappen }: { kaartId: number; stappen: Omit<Stap, 'id' | 'kaart_id'>[] }) => {
      const { error: weg } = await supabase.from('werkkaart_stappen').delete().eq('kaart_id', kaartId)
      if (weg) throw new Error(weg.message)
      if (stappen.length === 0) return
      const { error } = await supabase.from('werkkaart_stappen').insert(
        stappen.map((s, i) => ({
          kaart_id: kaartId,
          volgorde: i + 1,
          tekst: s.tekst.trim(),
          apparaat: s.apparaat,
          minuten: s.minuten,
          kleur: s.kleur,
        })),
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkkaart-stappen'] }),
  })
}
