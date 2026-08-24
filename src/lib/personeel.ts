import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Velden voor de lijst. Bewust zonder onboarding_data — daar staan BSN en
 *  IBAN in, en die horen niet in een overzicht. */
const LIJST_VELDEN =
  'id,voornaam,achternaam,status,fase,aangemeld_op,aangenomen_op,' +
  'onboarding_verstuurd_op,onboarding_ingevuld_op,' +
  'loonbureau_verstuurd_op,loonbureau_bevestigd_op,uit_dienst_op'

const KAART_VELDEN =
  LIJST_VELDEN +
  ',geboortedatum,telefoonnummer,email,motivatie,onboarding_data,' +
  'contracttype,contractduur,functie,ingangsdatum,einddatum,uurloon,proefperiode,contract_door_loonbureau'

export type Fase = 'sollicitant' | 'medewerker'

export type Persoon = {
  id: string
  voornaam: string | null
  achternaam: string | null
  status: string | null
  fase: Fase
  aangemeld_op: string | null
  aangenomen_op: string | null
  onboarding_verstuurd_op: string | null
  onboarding_ingevuld_op: string | null
  loonbureau_verstuurd_op: string | null
  loonbureau_bevestigd_op: string | null
  uit_dienst_op: string | null
  // alleen op de kaart
  geboortedatum?: string | null
  telefoonnummer?: string | null
  email?: string | null
  motivatie?: string | null
  onboarding_data?: Record<string, unknown> | null
  // vult Sander zelf in, voor het mutatieformulier
  contracttype?: string | null
  contractduur?: 'bepaalde' | 'onbepaalde' | null
  functie?: string | null
  ingangsdatum?: string | null
  einddatum?: string | null
  uurloon?: number | null
  proefperiode?: boolean | null
  contract_door_loonbureau?: boolean | null
}

export const CONTRACTTYPES = ['Nuluren-overeenkomst (oproep)', 'Vaste uren'] as const

export const FUNCTIES = [
  { naam: 'Medewerker fastservice I', groep: 2 },
  { naam: 'Medewerker fastservice II', groep: 3 },
] as const

/** Welke contractvelden moeten ingevuld zijn voordat het naar het loonbureau kan. */
export function ontbrekendeContractvelden(p: Persoon): string[] {
  const mist: string[] = []
  if (!p.contracttype) mist.push('contracttype')
  if (!p.contractduur) mist.push('contractduur')
  if (!p.functie) mist.push('functie')
  if (!p.ingangsdatum) mist.push('ingangsdatum')
  if (p.contractduur === 'bepaalde' && !p.einddatum) mist.push('einddatum')
  if (p.uurloon === null || p.uurloon === undefined) mist.push('uurloon')
  if (p.proefperiode === null || p.proefperiode === undefined) mist.push('proefperiode')
  return mist
}

export function naamVan(p: Persoon) {
  return [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Naamloos'
}

/* ------------------------------------------------------------------ status --- */

export type Toestand = {
  sleutel: string
  label: string
  /** goed = klaar, letop = jij bent aan zet, neutraal = wachten op een ander */
  soort: 'goed' | 'letop' | 'fout' | 'neutraal'
}

const SOLLICITANT: Record<string, Toestand> = {
  nieuw: { sleutel: 'nieuw', label: 'Nieuw', soort: 'fout' },
  eerste_contact: { sleutel: 'eerste_contact', label: 'Contact gehad', soort: 'neutraal' },
  gesprek: { sleutel: 'gesprek', label: 'Gesprek', soort: 'letop' },
  afgewezen: { sleutel: 'afgewezen', label: 'Afgewezen', soort: 'neutraal' },
}

/** De toestand van een medewerker wordt afgeleid uit de tijdstippen, niet apart
 *  bijgehouden. Zo kan hij nooit iets anders beweren dan er gebeurd is. */
export function toestandVan(p: Persoon): Toestand {
  if (p.fase === 'sollicitant') {
    return SOLLICITANT[p.status ?? 'nieuw'] ?? SOLLICITANT.nieuw
  }
  if (p.uit_dienst_op) return { sleutel: 'uit_dienst', label: 'Uit dienst', soort: 'neutraal' }
  if (p.loonbureau_bevestigd_op) return { sleutel: 'in_dienst', label: 'In dienst', soort: 'goed' }
  if (p.loonbureau_verstuurd_op) return { sleutel: 'naar_loonbureau', label: 'Naar loonbureau', soort: 'neutraal' }
  if (p.onboarding_ingevuld_op) return { sleutel: 'compleet', label: 'Compleet', soort: 'letop' }
  if (p.onboarding_verstuurd_op) return { sleutel: 'link_verstuurd', label: 'Link verstuurd', soort: 'neutraal' }
  return { sleutel: 'aangenomen', label: 'Link nog versturen', soort: 'fout' }
}

/** In het archief: afgewezen sollicitanten en medewerkers die uit dienst zijn. */
export function inArchief(p: Persoon) {
  return p.status === 'afgewezen' || Boolean(p.uit_dienst_op)
}

/* ------------------------------------------------------------------ datums --- */

export function korteDatum(datum: string | null | undefined) {
  if (!datum) return '—'
  return new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function sinds(datum: string | null | undefined) {
  if (!datum) return '—'
  const dagen = Math.floor((Date.now() - new Date(datum).getTime()) / 86_400_000)
  if (dagen <= 0) return 'vandaag'
  if (dagen === 1) return '1 dag'
  if (dagen < 31) return `${dagen} dagen`
  return korteDatum(datum)
}

/* ------------------------------------------------------------------ query --- */

export function usePersonen() {
  return useQuery({
    queryKey: ['personen'],
    queryFn: async (): Promise<Persoon[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select(LIJST_VELDEN)
        .order('aangemeld_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Persoon[]
    },
  })
}

export function usePersoon(id: string | undefined) {
  return useQuery({
    queryKey: ['persoon', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Persoon> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select(KAART_VELDEN)
        .eq('id', id!)
        .single()
      if (error) throw new Error(error.message)
      return data as unknown as Persoon
    },
  })
}

/* --------------------------------------------------------------- wijzigen --- */

function nu() {
  return new Date().toISOString()
}

export function usePersoonWijzigen(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (velden: Partial<Persoon>) => {
      const { error } = await supabase.from('sollicitaties').update(velden).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['personen'] })
      client.invalidateQueries({ queryKey: ['persoon', id] })
    },
  })
}

/** Aannemen: dezelfde kaart, andere fase. Niets wordt overgetypt. */
export const aannemen = (): Partial<Persoon> => ({
  fase: 'medewerker',
  status: 'aangenomen',
  aangenomen_op: nu(),
})

export const afwijzen = (): Partial<Persoon> => ({ status: 'afgewezen' })

export const terugNaarSollicitant = (): Partial<Persoon> => ({
  fase: 'sollicitant',
  status: 'gesprek',
  aangenomen_op: null,
})

/** Vangnet voor de enkele registratie die nog op een mailadres staat. In de
 *  database staan namen, maar een uitdraai voor een controle mag nooit ineens
 *  "daan@..." laten zien omdat er ergens iets is misgegaan. */
export function toonNaam(naam: string | null | undefined) {
  if (!naam) return '—'
  if (!naam.includes('@')) return naam
  return (
    naam
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())
      .trim() || naam
  )
}
