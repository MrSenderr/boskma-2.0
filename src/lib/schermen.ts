import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* De schermen in de zaak. Zie docs/Modules/schermen/schermenmodule.md.

   Op elk scherm draait een klein pagina'tje dat zich elke 30 seconden meldt en
   ophaalt wat het moet tonen. Twee dingen die daaruit volgen en die dit scherm
   moet respecteren:

   * Een reeks wint van een vast beeld. Staan er actieve regels in
     screen_rotatie, dan kijkt het scherm niet naar actieve_afbeelding_url.
   * "Al twee minuten niets gehoord" betekent dat er iets hangt, want vier
     rondjes overslaan doet een scherm niet zomaar. */

const MELDT_ZICH_ELKE = 30_000
export const STIL_TE_LANG = MELDT_ZICH_ELKE * 4

export type Scherm = {
  id: number
  naam: string
  beschrijving: string | null
  actieve_afbeelding_url: string | null
  bijgewerkt_op: string | null
  last_seen: string | null
}

export type Afbeelding = {
  id: number
  bestandsnaam: string
  url: string
  geupload_op: string
  map: string | null
}

export type Reeks = {
  screen_id: number
  aantal: number
}

export function leeftNog(scherm: Scherm) {
  if (!scherm.last_seen) return false
  return Date.now() - new Date(scherm.last_seen).getTime() < STIL_TE_LANG
}

export function stilSinds(scherm: Scherm) {
  if (!scherm.last_seen) return 'nog nooit gezien'
  const minuten = Math.floor((Date.now() - new Date(scherm.last_seen).getTime()) / 60_000)
  if (minuten < 60) return `${minuten} ${minuten === 1 ? 'minuut' : 'minuten'} stil`
  const uren = Math.floor(minuten / 60)
  if (uren < 24) return `${uren} ${uren === 1 ? 'uur' : 'uur'} stil`
  const dagen = Math.floor(uren / 24)
  return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} stil`
}

export function useSchermen() {
  return useQuery({
    queryKey: ['schermen'],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Scherm[]> => {
      const { data, error } = await supabase
        .from('screens')
        .select('id,naam,beschrijving,actieve_afbeelding_url,bijgewerkt_op,last_seen')
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Scherm[]
    },
  })
}

/** Per scherm hoeveel beelden er in een lopende reeks zitten. Nul betekent: het
 *  vaste beeld is wat je ziet. */
export function useLopendeReeksen() {
  return useQuery({
    queryKey: ['schermreeksen'],
    queryFn: async (): Promise<Record<number, number>> => {
      const { data, error } = await supabase
        .from('screen_rotatie')
        .select('screen_id,actief')
      if (error) throw new Error(error.message)
      const telling: Record<number, number> = {}
      ;(data ?? []).forEach((r) => {
        const rij = r as { screen_id: number; actief: boolean | null }
        if (rij.actief === false) return
        telling[rij.screen_id] = (telling[rij.screen_id] ?? 0) + 1
      })
      return telling
    },
  })
}

/** Uitzetten, niet weggooien: de reeks blijft bewaard voor de volgende keer. */
export function useReeksZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ schermId, aan }: { schermId: number; aan: boolean }) => {
      const { error } = await supabase
        .from('screen_rotatie')
        .update({ actief: aan })
        .eq('screen_id', schermId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['schermreeksen'] })
      client.invalidateQueries({ queryKey: ['schermen'] })
    },
  })
}

/** Hoeveel beelden er in de bewaarde reeks van een scherm zitten, ook als hij
 *  uitstaat. */
export function useBewaardeReeksen() {
  return useQuery({
    queryKey: ['bewaarde-reeksen'],
    queryFn: async (): Promise<Record<number, number>> => {
      const { data, error } = await supabase.from('screen_rotatie').select('screen_id')
      if (error) throw new Error(error.message)
      const telling: Record<number, number> = {}
      ;(data ?? []).forEach((r) => {
        const id = (r as { screen_id: number }).screen_id
        telling[id] = (telling[id] ?? 0) + 1
      })
      return telling
    },
  })
}

export function useSchermInstellen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ schermId, url }: { schermId: number; url: string | null }) => {
      const { error } = await supabase
        .from('screens')
        .update({ actieve_afbeelding_url: url, bijgewerkt_op: new Date().toISOString() })
        .eq('id', schermId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['schermen'] }),
  })
}

/* ------------------------------------------------------------ bibliotheek --- */

export const ZONDER_MAP = 'Zonder map'

export function useAfbeeldingen() {
  return useQuery({
    queryKey: ['schermafbeeldingen'],
    queryFn: async (): Promise<Afbeelding[]> => {
      const { data, error } = await supabase
        .from('screen_images')
        .select('id,bestandsnaam,url,geupload_op,map')
        .order('geupload_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Afbeelding[]
    },
  })
}

export function mappenVan(afbeeldingen: Afbeelding[]) {
  const namen = new Set<string>()
  afbeeldingen.forEach((a) => namen.add(a.map?.trim() || ZONDER_MAP))
  return [...namen].sort((a, b) =>
    a === ZONDER_MAP ? 1 : b === ZONDER_MAP ? -1 : a.localeCompare(b, 'nl'),
  )
}

function veiligeNaam(naam: string) {
  const punt = naam.lastIndexOf('.')
  const kaal = (punt > 0 ? naam.slice(0, punt) : naam)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const ext = punt > 0 ? naam.slice(punt).toLowerCase() : ''
  return `${kaal || 'beeld'}${ext}`
}

export function useAfbeeldingUploaden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ bestand, map }: { bestand: File; map: string | null }) => {
      const pad = `scherm_${Date.now()}-${veiligeNaam(bestand.name)}`
      const { error: opslagFout } = await supabase.storage
        .from('screen-images')
        .upload(pad, bestand, { contentType: bestand.type || undefined })
      if (opslagFout) throw new Error(opslagFout.message)

      const { data: publiek } = supabase.storage.from('screen-images').getPublicUrl(pad)
      const { error } = await supabase.from('screen_images').insert({
        bestandsnaam: bestand.name,
        url: publiek.publicUrl,
        map: map?.trim() || null,
      })
      if (error) {
        await supabase.storage.from('screen-images').remove([pad])
        throw new Error(error.message)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['schermafbeeldingen'] }),
  })
}

export function useAfbeeldingInMap() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, map }: { id: number; map: string | null }) => {
      const { error } = await supabase
        .from('screen_images')
        .update({ map: map?.trim() || null })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['schermafbeeldingen'] }),
  })
}

export function useAfbeeldingWeggooien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (a: Afbeelding) => {
      const { error } = await supabase.from('screen_images').delete().eq('id', a.id)
      if (error) throw new Error(error.message)
      // Het bestand zelf blijft staan: er kan een scherm of een bewaarde reeks
      // naar wijzen die we hier niet zien, en een zwart scherm in de zaak is
      // erger dan een ongebruikt bestand in de opslag.
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['schermafbeeldingen'] }),
  })
}

/* ------------------------------------------------------------ herstarten --- */

/* Een scherm opnieuw laten opstarten.
 *
 * De app kan niet bij de Pi's — die hangen niet aan dit netwerk en de
 * beheeropzet in `boskma-signage` staat nog op voorbeeldadressen. Dat hoeft
 * ook niet: de daemon op elke Pi kijkt elke dertig seconden zelf in
 * `screen_commands` of er iets voor hem klaarstaat. Deze knop zet daar een
 * regel neer; de Pi haalt hem op.
 *
 * **Eerst opruimen wat er al stond.** Druk je twee keer, dan staan er twee
 * opdrachten en start het scherm twee keer achter elkaar op. Bij een scherm
 * dat al uren stil is, is dat zomaar gebeurd.
 *
 * Alleen `reboot`. De daemon kent ook `screen_on` en `screen_off` via de
 * tv-bediening, en `refresh` — maar die laatste wordt door niets opgepakt:
 * in de daemon staat dat de browser hem afhandelt, en dat doet hij niet. Een
 * knop die een opdracht achterlaat waar niemand naar kijkt, is erger dan geen
 * knop. */
export function useSchermHerstarten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (schermId: number) => {
      const { error: weg } = await supabase
        .from('screen_commands')
        .delete()
        .eq('screen_id', schermId)
        .eq('command', 'reboot')
      if (weg) throw new Error(weg.message)

      const { error } = await supabase
        .from('screen_commands')
        .insert({ screen_id: schermId, command: 'reboot' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['schermen'] })
      void client.invalidateQueries({ queryKey: ['scherm-opdrachten'] })
    },
  })
}

/* Bij welke schermen er nog een herstart klaarstaat.
 *
 * Zolang er een staat, heeft de Pi hem niet opgehaald — en dan weet je dat er
 * nog niets is gebeurd. Een set en niet een lijst-per-scherm: bij één scherm
 * kunnen meerdere opdrachten staan, en dan moet je er niet één willekeurige
 * uit overhouden. We vragen de database alleen naar `reboot`, want dat is het
 * enige dat deze knop neerzet. */
export function useOpenstaandeHerstarts() {
  return useQuery({
    queryKey: ['scherm-opdrachten'],
    refetchInterval: 10_000,
    queryFn: async (): Promise<Set<number>> => {
      const { data, error } = await supabase
        .from('screen_commands')
        .select('screen_id')
        .eq('command', 'reboot')
      if (error) throw new Error(error.message)
      return new Set((data ?? []).map((r) => r.screen_id as number))
    },
  })
}
