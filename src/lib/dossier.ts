import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { korteDatum } from './personeel'

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
  toegevoegd_door: string | null
  mime_type: string | null
  bytes: number | null
  sha256: string | null
  notitie: string | null
  /** Niet meer actueel. Het bestand blijft staan en blijft opvraagbaar. */
  vervallen_op: string | null
  /** Gevuld als er een opvolger is, leeg als het gewoon weggehaald is. */
  vervangen_door: number | null
}

/* Wat er in een dossier mag. De ID-kopie staat er bewust niet bij: die gaat na
   veertien dagen weg — zie de edge function ruim-id-kopieen-op. Deze lijst moet
   gelijk blijven aan de CHECK op dossier_documenten.soort. */
export const SOORTEN: { waarde: string; label: string }[] = [
  { waarde: 'contract', label: 'Contract' },
  { waarde: 'contract_getekend', label: 'Getekend contract' },
  { waarde: 'loonheffing', label: 'Loonheffingsverklaring' },
  { waarde: 'mutatieformulier', label: 'Mutatieformulier' },
  { waarde: 'loonstrook', label: 'Loonstrook' },
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

const DOC_VELDEN =
  'id,medewerker_id,soort,naam,pad,toegevoegd_op,toegevoegd_door,' +
  'mime_type,bytes,sha256,notitie,vervallen_op,vervangen_door'

export function useDocumenten(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['dossier-documenten', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Document[]> => {
      const { data, error } = await supabase
        .from('dossier_documenten')
        .select(DOC_VELDEN)
        .eq('medewerker_id', medewerkerId!)
        .order('toegevoegd_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Document[]
    },
  })
}

/** Wat nu geldt, en wat er ooit gegolden heeft. Vervallen documenten blijven
    staan maar horen niet tussen de actuele te zitten. */
export function splitsDocumenten(documenten: Document[] | undefined) {
  const alles = documenten ?? []
  return {
    actueel: alles.filter((d) => !d.vervallen_op),
    vervallen: alles.filter((d) => d.vervallen_op),
  }
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

/** 25 MB. De echte grens hoort op de bak zelf te staan, want die kan een browser
 *  niet omzeilen; dit is de nette melding ervoor. */
export const MAX_BYTES = 25 * 1024 * 1024

/* Wat een bestand werkelijk is, staat in de eerste bytes — niet in de naam.
   Iemand die iets hernoemt naar .pdf komt hier dus niet langs. */
const KOPPEN: { type: string; begin: number[] }[] = [
  { type: 'application/pdf', begin: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: 'image/jpeg', begin: [0xff, 0xd8, 0xff] },
  { type: 'image/png', begin: [0x89, 0x50, 0x4e, 0x47] },
  // docx en xlsx zijn zip-bestanden; het oude .doc heeft zijn eigen kop
  { type: 'application/zip', begin: [0x50, 0x4b, 0x03, 0x04] },
  { type: 'application/msword', begin: [0xd0, 0xcf, 0x11, 0xe0] },
]

async function herkenBestand(bestand: File) {
  const kop = new Uint8Array(await bestand.slice(0, 8).arrayBuffer())
  return KOPPEN.find((k) => k.begin.every((b, i) => kop[i] === b)) ?? null
}

/** Een vingerafdruk van de inhoud. Hetzelfde bestand geeft hetzelfde nummer, ook
 *  als de bestandsnaam verschilt — daarmee vangen we dubbel uploaden af. */
async function vingerafdruk(bestand: File) {
  const hash = await crypto.subtle.digest('SHA-256', await bestand.arrayBuffer())
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function useDocumentToevoegen(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ bestand, soort }: { bestand: File; soort: string }) => {
      if (bestand.size === 0) throw new Error('Dit bestand is leeg.')
      if (bestand.size > MAX_BYTES) {
        const mb = (bestand.size / 1024 / 1024).toFixed(1)
        throw new Error(`Dit bestand is ${mb} MB. Boven de 25 MB gaat het er niet in.`)
      }

      const herkend = await herkenBestand(bestand)
      if (!herkend) {
        throw new Error(
          'Dit lijkt geen PDF, foto of Word-bestand te zijn. Alleen PDF, JPEG, PNG, Word en Excel.',
        )
      }

      const sha256 = await vingerafdruk(bestand)

      // Eerst zelf kijken of het er al ligt. De database vangt het ook af, maar
      // dan hoor je alleen dát het dubbel is, niet welk document je al had.
      const { data: bestaand } = await supabase
        .from('dossier_documenten')
        .select('naam,soort,toegevoegd_op')
        .eq('medewerker_id', medewerkerId)
        .eq('sha256', sha256)
        .maybeSingle()
      if (bestaand) {
        const d = bestaand as { naam: string; soort: string; toegevoegd_op: string }
        throw new Error(
          `Dit bestand staat er al, als "${d.naam}" — ${soortLabel(d.soort)}, ` +
            `toegevoegd op ${korteDatum(d.toegevoegd_op)}.`,
        )
      }

      // Onder de map van de medewerker, want daar hangt zijn leesrecht aan.
      const pad = `dossier/${medewerkerId}/${Date.now()}-${veiligeNaam(bestand.name)}`
      const mimeType = bestand.type || herkend.type
      const { error: opslagFout } = await supabase.storage
        .from('Documenten')
        .upload(pad, bestand, { contentType: mimeType })
      if (opslagFout) throw new Error(opslagFout.message)

      const { data: gebruiker } = await supabase.auth.getUser()
      const { error } = await supabase.from('dossier_documenten').insert({
        medewerker_id: medewerkerId,
        soort,
        naam: bestand.name,
        pad,
        mime_type: mimeType,
        bytes: bestand.size,
        sha256,
        toegevoegd_door: gebruiker.user?.email ?? null,
      })
      if (error) {
        // Geen losse bestanden achterlaten waar niets naar verwijst.
        await supabase.storage.from('Documenten').remove([pad])
        if (error.code === '23505') throw new Error('Dit bestand staat er al in het dossier.')
        throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

/** Weggooien bestaat niet. Een document dat niet meer geldt krijgt een stempel en
 *  zakt naar onderen; het bestand blijft staan. Zo is later nog te zien wat er
 *  destijds is afgesproken — en dat is precies waar een dossier voor is. */
export function useDocumentLatenVervallen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ doc, vervangenDoor }: { doc: Document; vervangenDoor?: number }) => {
      const { error } = await supabase
        .from('dossier_documenten')
        .update({
          vervallen_op: new Date().toISOString(),
          vervangen_door: vervangenDoor ?? null,
        })
        .eq('id', doc.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

/** Voor als je de verkeerde hebt aangetikt. */
export function useDocumentTerughalen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Document) => {
      const { error } = await supabase
        .from('dossier_documenten')
        .update({ vervallen_op: null, vervangen_door: null })
        .eq('id', doc.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

/** De soort of de notitie corrigeren. Het bestand zelf blijft wat het is. */
export function useDocumentWijzigen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, soort, notitie }: { id: number; soort?: string; notitie?: string }) => {
      const velden: Record<string, string | null> = {}
      if (soort !== undefined) velden.soort = soort
      if (notitie !== undefined) velden.notitie = notitie.trim() || null
      if (Object.keys(velden).length === 0) return
      const { error } = await supabase.from('dossier_documenten').update(velden).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['dossier-documenten'] }),
  })
}

/** Hoe groot een bestand is, in iets wat je kunt lezen. */
export function leesbareGrootte(bytes: number | null) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
