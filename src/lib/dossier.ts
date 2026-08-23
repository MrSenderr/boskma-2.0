import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Het dossier: gespreksverslagen en documenten. Zie
   docs/modules/personeel/personeelsmodule.md.

   Een verslag is standaard privé. Delen is een bewuste handeling — pas daarna
   bestaat het voor de medewerker, en kan hij er akkoord of niet akkoord op
   geven. Wat gedeeld is blijft staan: een dossier waar dingen uit kunnen
   verdwijnen is geen dossier. */

export type Verslag = {
  id: number
  medewerker_id: string
  titel: string
  tekst: string
  gesprek_op: string
  geschreven_op: string
  geschreven_door: string | null
  gedeeld_op: string | null
  gelezen_op: string | null
  reactie: 'akkoord' | 'niet_akkoord' | null
  reactie_op: string | null
  opmerking: string | null
  reactie_gezien_op: string | null
}

export type Document = {
  id: number
  medewerker_id: string
  soort: string
  naam: string
  pad: string
  toegevoegd_op: string
}

export const SOORTEN: { waarde: string; label: string }[] = [
  { waarde: 'contract', label: 'Contract' },
  { waarde: 'loonheffing', label: 'Loonheffingsverklaring' },
  { waarde: 'mutatieformulier', label: 'Mutatieformulier' },
  { waarde: 'overig', label: 'Overig' },
]

export function soortLabel(soort: string) {
  return SOORTEN.find((s) => s.waarde === soort)?.label ?? 'Document'
}

const VELDEN =
  'id,medewerker_id,titel,tekst,gesprek_op,geschreven_op,geschreven_door,gedeeld_op,gelezen_op,reactie,reactie_op,opmerking,reactie_gezien_op'

/** Voor Sander alles, voor een medewerker alleen wat gedeeld is — dat regelt de
    database, niet dit scherm. */
export function useVerslagen(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['verslagen', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Verslag[]> => {
      const { data, error } = await supabase
        .from('dossier_verslagen')
        .select(VELDEN)
        .eq('medewerker_id', medewerkerId!)
        .order('gesprek_op', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Verslag[]
    },
  })
}

export function useVerslagSchrijven(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { titel: string; tekst: string; gesprek_op: string; delen: boolean }) => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const { error } = await supabase.from('dossier_verslagen').insert({
        medewerker_id: medewerkerId,
        titel: v.titel.trim(),
        tekst: v.tekst.trim(),
        gesprek_op: v.gesprek_op,
        geschreven_door: gebruiker.user?.email ?? null,
        gedeeld_op: v.delen ? new Date().toISOString() : null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['verslagen'] }),
  })
}

export function useVerslagDelen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('dossier_verslagen')
        .update({ gedeeld_op: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['verslagen'] }),
  })
}

/** Alleen wat nog niet gedeeld is. Zodra de medewerker het heeft gezien blijft
    het staan — ook als hij het er niet mee eens is. */
export function useVerslagWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('dossier_verslagen')
        .delete()
        .eq('id', id)
        .is('gedeeld_op', null)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['verslagen'] }),
  })
}

export function useVerslagReageren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { verslag: number; reactie: 'akkoord' | 'niet_akkoord'; opmerking?: string }) => {
      const { error } = await supabase.rpc('verslag_reageren', {
        p_verslag: v.verslag,
        p_reactie: v.reactie,
        p_opmerking: v.opmerking ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['verslagen'] }),
  })
}

/* ------------------------------------------------------------- documenten --- */

export function useDocumenten(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['dossier-documenten', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Document[]> => {
      const { data, error } = await supabase
        .from('dossier_documenten')
        .select('id,medewerker_id,soort,naam,pad,toegevoegd_op')
        .eq('medewerker_id', medewerkerId!)
        .order('toegevoegd_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Document[]
    },
  })
}

/** Een naam die overal veilig is als bestandsnaam, met de extensie erachter. */
function veiligeNaam(naam: string) {
  const punt = naam.lastIndexOf('.')
  const kaal = (punt > 0 ? naam.slice(0, punt) : naam)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const ext = punt > 0 ? naam.slice(punt).toLowerCase() : ''
  return `${kaal || 'document'}${ext}`
}

export function useDocumentToevoegen(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ bestand, soort }: { bestand: File; soort: string }) => {
      // Onder de map van de medewerker, want daar hangt zijn leesrecht aan.
      const pad = `dossier/${medewerkerId}/${Date.now()}-${veiligeNaam(bestand.name)}`
      const { error: opslagFout } = await supabase.storage
        .from('Documenten')
        .upload(pad, bestand, { contentType: bestand.type || undefined })
      if (opslagFout) throw new Error(opslagFout.message)

      const { data: gebruiker } = await supabase.auth.getUser()
      const { error } = await supabase.from('dossier_documenten').insert({
        medewerker_id: medewerkerId,
        soort,
        naam: bestand.name,
        pad,
        toegevoegd_door: gebruiker.user?.email ?? null,
      })
      if (error) {
        // Geen losse bestanden achterlaten waar niets naar verwijst.
        await supabase.storage.from('Documenten').remove([pad])
        throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

export function useDocumentWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Document) => {
      const { error } = await supabase.from('dossier_documenten').delete().eq('id', doc.id)
      if (error) throw new Error(error.message)
      await supabase.storage.from('Documenten').remove([doc.pad])
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

/** Een tijdelijk webadres; na een minuut werkt het niet meer. */
export async function documentOpenen(pad: string) {
  const { data, error } = await supabase.storage.from('Documenten').createSignedUrl(pad, 60)
  if (error) throw new Error(error.message)
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

/** Openen telt als gelezen. Stil op de achtergrond: het is geen handeling van de
    medewerker, alleen een teken dat het verslag is aangekomen. */
export async function verslagGelezen(id: number) {
  await supabase.rpc('verslag_gelezen', { p_verslag: id })
}

/* ------------------------------------------------------------- beheerkant --- */

export type Reactie = Verslag & {
  sollicitaties: { voornaam: string | null; achternaam: string | null } | null
}

/** Wat een medewerker van een verslag vond en jij nog niet hebt gezien. */
export function useNieuweReacties() {
  return useQuery({
    queryKey: ['verslag-reacties'],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Reactie[]> => {
      const { data, error } = await supabase
        .from('dossier_verslagen')
        .select(`${VELDEN},sollicitaties(voornaam,achternaam)`)
        .not('reactie', 'is', null)
        .is('reactie_gezien_op', null)
        .order('reactie_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Reactie[]
    },
  })
}

export function useReactieAftikken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('dossier_verslagen')
        .update({ reactie_gezien_op: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['verslag-reacties'] })
      client.invalidateQueries({ queryKey: ['verslagen'] })
    },
  })
}
