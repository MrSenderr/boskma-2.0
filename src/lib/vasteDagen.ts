import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Voorkeur voor vaste dagen, ingevuld door de medewerker zelf op /vastedagen
   (public/vastedagen/index.html). Per persoon telt de laatste inzending; dat
   regelt de view rooster_voorkeuren_laatste. */

export type Voorkeur = 'graag' | 'kan' | 'liever_niet' | 'nee'

export type VasteDagen = {
  id: string
  ingevuld_op: string
  wil_vast: boolean
  akkoord_geen_vast: boolean
  di: Voorkeur | null
  wo: Voorkeur | null
  do: Voorkeur | null
  vr: Voorkeur | null
  za: Voorkeur | null
  zo: Voorkeur | null
  za_hele_dag: Voorkeur | null
  zo_hele_dag: Voorkeur | null
  aantal_vast: number | null
  blokkades: string | null
  geldig_tot: string | null
  opmerking: string | null
}

const VELDEN =
  'id,ingevuld_op,wil_vast,akkoord_geen_vast,di,wo,do,vr,za,zo,za_hele_dag,zo_hele_dag,' +
  'aantal_vast,blokkades,geldig_tot,opmerking'

export const DAGEN = [
  { sleutel: 'di', naam: 'Dinsdag' },
  { sleutel: 'wo', naam: 'Woensdag' },
  { sleutel: 'do', naam: 'Donderdag' },
  { sleutel: 'vr', naam: 'Vrijdag' },
  { sleutel: 'za', naam: 'Zaterdag' },
  { sleutel: 'zo', naam: 'Zondag' },
] as const

export const VOORKEUR: Record<Voorkeur, { label: string; soort: 'goed' | 'letop' | 'fout' | 'neutraal' }> = {
  graag: { label: 'Graag', soort: 'goed' },
  kan: { label: 'Kan', soort: 'neutraal' },
  liever_niet: { label: 'Liever niet', soort: 'letop' },
  nee: { label: 'Nee', soort: 'fout' },
}

export function useVasteDagen(persoonId: string) {
  return useQuery({
    queryKey: ['vaste-dagen', persoonId],
    queryFn: async (): Promise<VasteDagen | null> => {
      const { data, error } = await supabase
        .from('rooster_voorkeuren_laatste')
        .select(VELDEN)
        .eq('persoon_id', persoonId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as unknown as VasteDagen) ?? null
    },
  })
}

/* --------------------------------------------- de medewerker zelf --- */

/** Wat ik zelf het laatst heb opgegeven. */
export function useMijnVasteDagen(persoonId: string | null | undefined) {
  return useQuery({
    queryKey: ['mijn-vaste-dagen', persoonId],
    enabled: Boolean(persoonId),
    queryFn: async (): Promise<VasteDagen | null> => {
      const { data, error } = await supabase
        .from('rooster_voorkeuren_laatste')
        .select(VELDEN)
        .eq('persoon_id', persoonId as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as unknown as VasteDagen) ?? null
    },
  })
}

export type Inzending = {
  persoon_id: string
  naam: string
  wil_vast: boolean
  akkoord_geen_vast: boolean
  di: Voorkeur | null
  wo: Voorkeur | null
  do: Voorkeur | null
  vr: Voorkeur | null
  za: Voorkeur | null
  zo: Voorkeur | null
  za_hele_dag: Voorkeur | null
  zo_hele_dag: Voorkeur | null
  aantal_vast: number | null
  blokkades: string | null
  geldig_tot: string | null
  opmerking: string | null
}

/* Opslaan is een nieuwe regel, geen wijziging van de oude. Zo blijft staan wat
   je vorige maand opgaf en kan Sander nazien wanneer er iets veranderde. */
export function useVasteDagenOpslaan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (inzending: Inzending) => {
      const { error } = await supabase.from('rooster_voorkeuren').insert(inzending)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_uit, inzending) => {
      client.invalidateQueries({ queryKey: ['mijn-vaste-dagen', inzending.persoon_id] })
      client.invalidateQueries({ queryKey: ['vaste-dagen', inzending.persoon_id] })
    },
  })
}

/* ------------------------------------------------- het hele overzicht --- */

export type Overzichtsregel = {
  persoon_id: string
  naam: string
  ingevuld_op: string | null
  wil_vast: boolean | null
  akkoord_geen_vast: boolean | null
  di: Voorkeur | null
  wo: Voorkeur | null
  do: Voorkeur | null
  vr: Voorkeur | null
  za: Voorkeur | null
  zo: Voorkeur | null
  za_hele_dag: Voorkeur | null
  zo_hele_dag: Voorkeur | null
  aantal_vast: number | null
  blokkades: string | null
  geldig_tot: string | null
  opmerking: string | null
}

export function useVasteDagenOverzicht() {
  return useQuery({
    queryKey: ['vaste-dagen-overzicht'],
    queryFn: async (): Promise<Overzichtsregel[]> => {
      const { data, error } = await supabase
        .from('vaste_dagen_overzicht')
        .select('*')
        .order('naam')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Overzichtsregel[]
    },
  })
}

/** Heeft deze persoon iets opgegeven? */
export function heeftIngevuld(r: Overzichtsregel): boolean {
  return r.ingevuld_op !== null
}

export type Telling = { sleutel: string; naam: string; graag: number; kan: number }

/* Per dag hoeveel mensen hem graag doen en hoeveel hem kunnen. Dat is de vraag
   bij het maken van het rooster: heb ik genoeg mensen voor dinsdag.

   Wie geen vaste dagen wil telt nergens mee — die vult de dagen immers niet
   in, en meetellen als "kan niet" zou het beeld vertekenen. */
export function perDag(regels: Overzichtsregel[]): Telling[] {
  return DAGEN.map((d) => {
    const antwoorden = regels.filter((r) => r.wil_vast).map((r) => r[d.sleutel])
    return {
      sleutel: d.sleutel,
      naam: d.naam,
      graag: antwoorden.filter((a) => a === 'graag').length,
      kan: antwoorden.filter((a) => a === 'kan').length,
    }
  })
}

/* Op een telefoon past geen tabel van zes kolommen. Daar is dit voor: alleen
   de dagen die iets betekenen, kort opgeschreven. */
export function samenvatting(r: Overzichtsregel): { graag: string[]; kan: string[]; nee: string[] } {
  const uit = { graag: [] as string[], kan: [] as string[], nee: [] as string[] }
  if (!r.wil_vast) return uit
  for (const d of DAGEN) {
    const a = r[d.sleutel]
    if (a === 'graag') uit.graag.push(d.naam)
    else if (a === 'kan') uit.kan.push(d.naam)
    else if (a === 'nee') uit.nee.push(d.naam)
  }
  return uit
}
