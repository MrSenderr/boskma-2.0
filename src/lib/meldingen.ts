import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Melden: er is iets stuk, iets is bijna op. Zie docs/Modules/meldingen.md.

   Dit ging tot nu toe via een appje dat tussen twintig andere berichten
   verdween. Nu komt het op één plek binnen en blijft het staan tot Sander het
   aftikt — hij kan het wegtikken, maar het verdwijnt niet vanzelf.

   Openstaande meldingen zijn voor iedereen zichtbaar. Dat voorkomt dat vier
   mensen dezelfde kapotte frituur melden, en het laat zien dat er iets mee
   gebeurt. */

export type Soort = 'stuk' | 'voorraad' | 'hygiene' | 'overig'

export type Melding = {
  id: number
  soort: Soort
  tekst: string
  apparaat_id: number | null
  apparaat_naam: string | null
  foto_pad: string | null
  door_naam: string | null
  gemeld_op: string
  status: string
  afgehandeld_op: string | null
  afgehandeld_door: string | null
  reactie: string | null
}

export const SOORTEN: { waarde: Soort; label: string; kort: string; klasse: string }[] = [
  { waarde: 'stuk', label: 'Er is iets stuk', kort: 'Stuk', klasse: 'border-bad text-bad' },
  { waarde: 'voorraad', label: 'Iets is bijna op', kort: 'Bijna op', klasse: 'border-warn text-warn' },
  { waarde: 'hygiene', label: 'Hygiëne of veiligheid', kort: 'Hygiëne', klasse: 'border-accent text-accent' },
  { waarde: 'overig', label: 'Iets anders', kort: 'Overig', klasse: 'border-line-strong text-text' },
]

export function soortLabel(soort: string) {
  return SOORTEN.find((s) => s.waarde === soort)?.kort ?? 'Melding'
}

const VELDEN =
  'id,soort,tekst,apparaat_id,apparaat_naam,foto_pad,door_naam,gemeld_op,status,afgehandeld_op,afgehandeld_door,reactie'

export function useOpenMeldingen() {
  return useQuery({
    queryKey: ['meldingen', 'open'],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Melding[]> => {
      const { data, error } = await supabase
        .from('meldingen')
        .select(VELDEN)
        .eq('status', 'open')
        .order('gemeld_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Melding[]
    },
  })
}

/** Wat er de afgelopen tijd is afgehandeld, zodat je kunt terugkijken. */
export function useAfgehandeld(hoeveel = 20) {
  return useQuery({
    queryKey: ['meldingen', 'afgehandeld', hoeveel],
    queryFn: async (): Promise<Melding[]> => {
      const { data, error } = await supabase
        .from('meldingen')
        .select(VELDEN)
        .eq('status', 'afgehandeld')
        .order('afgehandeld_op', { ascending: false })
        .limit(hoeveel)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Melding[]
    },
  })
}

function veiligeNaam(naam: string) {
  const punt = naam.lastIndexOf('.')
  const kaal = (punt > 0 ? naam.slice(0, punt) : naam)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${kaal || 'foto'}${punt > 0 ? naam.slice(punt).toLowerCase() : ''}`
}

export function useMelden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (m: {
      soort: Soort
      tekst: string
      apparaatId?: number | null
      apparaatNaam?: string | null
      foto?: File | null
      medewerkerId: string | null | undefined
      doorNaam: string
    }) => {
      let pad: string | null = null
      if (m.foto) {
        pad = `meldingen/${Date.now()}-${veiligeNaam(m.foto.name)}`
        const { error } = await supabase.storage
          .from('Documenten')
          .upload(pad, m.foto, { contentType: m.foto.type || undefined })
        // Een foto die niet lukt mag de melding niet tegenhouden — de tekst is
        // het belangrijkst.
        if (error) pad = null
      }

      const { data, error } = await supabase
        .from('meldingen')
        .insert({
          soort: m.soort,
          tekst: m.tekst.trim(),
          apparaat_id: m.apparaatId ?? null,
          apparaat_naam: m.apparaatNaam ?? null,
          foto_pad: pad,
          medewerker_id: m.medewerkerId ?? null,
          door_naam: m.doorNaam,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      // De mail is het duwtje, niet de melding zelf. Lukt hij niet, dan staat de
      // melding er nog steeds en ziet Sander hem op zijn startscherm.
      const id = (data as { id: number }).id
      try {
        await supabase.functions.invoke('stuur-melding', { body: { melding_id: id } })
      } catch {
        // stilte is hier het juiste antwoord
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['meldingen'] }),
  })
}

export function useMeldingAfhandelen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reactie }: { id: number; reactie: string | null }) => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('meldingen')
        .update({
          status: 'afgehandeld',
          afgehandeld_op: new Date().toISOString(),
          afgehandeld_door: gebruiker.user?.email ?? null,
          reactie: reactie?.trim() || null,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['meldingen'] }),
  })
}

/** Een tijdelijk adres voor de foto bij een melding. */
export async function fotoUrl(pad: string) {
  const { data, error } = await supabase.storage.from('Documenten').createSignedUrl(pad, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
