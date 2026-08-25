import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Wat er op het Vandaag-scherm staat naast de ronde: verjaardagen van collega's
   en losse taken die aan iemand zijn toegewezen. */

export type Verjaardag = { naam: string; dag: number; maand: number }

export type PersoonlijkeTaak = {
  id: number
  medewerker_id: string
  tekst: string
  toelichting: string | null
  datum: string
  gedaan_op: string | null
}

/** Collega's zien elkaars naam en dag, niet het geboortejaar. Die afscherming
 *  zit in de database, niet hier. */
export function useVerjaardagen() {
  return useQuery({
    queryKey: ['verjaardagen'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Verjaardag[]> => {
      const { data, error } = await supabase.rpc('verjaardagen')
      if (error) throw new Error(error.message)
      return (data ?? []) as Verjaardag[]
    },
  })
}

/** Wie is er vandaag jarig, en wie deze week nog? */
export function jarigen(lijst: Verjaardag[]) {
  const nu = new Date()
  const dag = nu.getDate()
  const maand = nu.getMonth() + 1
  const vandaag = lijst.filter((v) => v.dag === dag && v.maand === maand)

  const komend = lijst
    .map((v) => {
      const dit = new Date(nu.getFullYear(), v.maand - 1, v.dag)
      if (dit < new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()))
        dit.setFullYear(nu.getFullYear() + 1)
      const dagen = Math.round((dit.getTime() - new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime()) / 86_400_000)
      return { ...v, dagen }
    })
    .filter((v) => v.dagen > 0 && v.dagen <= 7)
    .sort((a, b) => a.dagen - b.dagen)

  return { vandaag, komend }
}

/** De datum is een deadline, geen startdag: een klus is meteen zichtbaar en de
 *  datum zegt wanneer hij af moet. Ververst vaak genoeg dat een taak die je net
 *  hebt gegeven binnen een minuut op zijn scherm staat. */
export function useMijnTaken(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['persoonlijke-taken', medewerkerId],
    enabled: Boolean(medewerkerId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PersoonlijkeTaak[]> => {
      const vandaag = new Date().toLocaleDateString('sv-SE')
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select('id,medewerker_id,tekst,toelichting,datum,gedaan_op')
        .eq('medewerker_id', medewerkerId!)
        .order('datum', { ascending: true })
      if (error) throw new Error(error.message)
      const alles = (data ?? []) as unknown as PersoonlijkeTaak[]
      // Alles wat nog open staat, plus wat vandaag is afgevinkt — zodat je ziet
      // dat je vinkje is aangekomen.
      return alles.filter((t) => !t.gedaan_op || (t.gedaan_op ?? '').slice(0, 10) === vandaag)
    },
  })
}

/** Hoe dringend is deze taak? */
export function urgentie(taak: PersoonlijkeTaak): 'gedaan' | 'telaat' | 'vandaag' | 'later' {
  if (taak.gedaan_op) return 'gedaan'
  const vandaag = new Date().toLocaleDateString('sv-SE')
  if (taak.datum < vandaag) return 'telaat'
  if (taak.datum === vandaag) return 'vandaag'
  return 'later'
}

export function useTakenVan(medewerkerId: string) {
  return useQuery({
    queryKey: ['taken-van', medewerkerId],
    queryFn: async (): Promise<PersoonlijkeTaak[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select('id,medewerker_id,tekst,toelichting,datum,gedaan_op')
        .eq('medewerker_id', medewerkerId)
        .order('datum', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PersoonlijkeTaak[]
    },
  })
}

export function useTaakAfvinken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, gedaan }: { id: number; gedaan: boolean }) => {
      const { error } = await supabase.rpc('taak_afvinken', { taak: id, gedaan })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['persoonlijke-taken'] })
      client.invalidateQueries({ queryKey: ['taken-van'] })
    },
  })
}

export function useTaakGeven() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (t: { medewerker_id: string; tekst: string; datum: string; aangemaakt_door: string }) => {
      const { error } = await supabase.from('persoonlijke_taken').insert(t)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken-van'] }),
  })
}

export function useTaakWeghalen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('persoonlijke_taken').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken-van'] }),
  })
}

/* ------------------------------------------------------------- beheerkant --- */

export type TaakVanIemand = PersoonlijkeTaak & {
  gezien_op: string | null
  sollicitaties: { voornaam: string | null; achternaam: string | null } | null
}

const MET_NAAM =
  'id,medewerker_id,tekst,toelichting,datum,gedaan_op,gezien_op,sollicitaties(voornaam,achternaam)'

/** Afgevinkt en nog niet door jou gezien. Blijft staan tot je hem aftikt, net
 *  als de gewijzigde gegevens en de reacties op verslagen. */
export function useAfgevinkteTaken() {
  return useQuery({
    queryKey: ['taken-afgevinkt'],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TaakVanIemand[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select(MET_NAAM)
        .not('gedaan_op', 'is', null)
        .is('gezien_op', null)
        .order('gedaan_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as TaakVanIemand[]
    },
  })
}

/** Wat er blijft liggen: over de datum heen en nog niet gedaan. */
export function useTakenOverDatum() {
  const vandaag = new Date().toLocaleDateString('sv-SE')
  return useQuery({
    queryKey: ['taken-over-datum', vandaag],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TaakVanIemand[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select(MET_NAAM)
        .is('gedaan_op', null)
        .lt('datum', vandaag)
        .order('datum', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as TaakVanIemand[]
    },
  })
}

export function useTaakGezien() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('persoonlijke_taken')
        .update({ gezien_op: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['taken-afgevinkt'] }),
  })
}

/** Alles, voor het logboek. */
export function useAlleTaken(dagen = 90) {
  const vanaf = new Date()
  vanaf.setDate(vanaf.getDate() - dagen + 1)
  const grens = vanaf.toLocaleDateString('sv-SE')
  return useQuery({
    queryKey: ['taken-alle', dagen],
    queryFn: async (): Promise<TaakVanIemand[]> => {
      const { data, error } = await supabase
        .from('persoonlijke_taken')
        .select(MET_NAAM)
        .gte('datum', grens)
        .order('datum', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as TaakVanIemand[]
    },
  })
}
