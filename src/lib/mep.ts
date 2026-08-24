import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { vandaagStr } from './openingstijden'

/* Mise en place: wat er de volgende opendag klaargemaakt moet worden. Zie
   docs/Modules/mep.md.

   De gang van zaken volgt het papieren formulier. Wie sluit vinkt 's avonds aan
   wat er moet, met hoeveel en wat er bijzonder aan is. De volgende dag werkt de
   keuken het af en tikt het aan.

   Twee dingen die daaruit volgen:
   * 'datum' is de dag wáárvoor het werk is, niet de dag dat het is aangevinkt.
   * Wat niet af komt blijft staan. Een taak van gisteren die nog open is hoort
     vandaag gewoon weer op de lijst — anders verdwijnt werk stilletjes. */

export type MepTaak = {
  id: number
  naam: string
  groep: string | null
  toelichting: string | null
  volgorde: number
  actief: boolean
  recept_id: number | null
}

export type MepDagTaak = {
  id: number
  datum: string
  sjabloon_id: number | null
  naam: string
  hoeveelheid: string | null
  notitie: string | null
  gedaan: boolean
  gedaan_op: string | null
  gedaan_door_naam: string | null
  aangezet_door: string | null
}

const DAGVELDEN =
  'id,datum,sjabloon_id,naam,hoeveelheid,notitie,gedaan,gedaan_op,gedaan_door_naam,aangezet_door'

export const ZONDER_GROEP = 'Overig'

export function groepenVan(taken: MepTaak[]) {
  const namen = new Set<string>()
  taken.forEach((t) => namen.add(t.groep?.trim() || ZONDER_GROEP))
  return [...namen].sort((a, b) =>
    a === ZONDER_GROEP ? 1 : b === ZONDER_GROEP ? -1 : a.localeCompare(b, 'nl'),
  )
}

export function useMepTaken(ookInactieve = false) {
  return useQuery({
    queryKey: ['mep-taken', ookInactieve],
    queryFn: async (): Promise<MepTaak[]> => {
      let vraag = supabase
        .from('mep_sjablonen')
        .select('id,naam,groep,toelichting,volgorde,actief,recept_id')
        .order('volgorde', { ascending: true })
        .order('id', { ascending: true })
      if (!ookInactieve) vraag = vraag.eq('actief', true)
      const { data, error } = await vraag
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as MepTaak[]
    },
  })
}

/** Wat er op één bepaalde dag klaargezet is. */
export function useMepDag(datum: string) {
  return useQuery({
    queryKey: ['mep-dag', datum],
    staleTime: 0,
    queryFn: async (): Promise<MepDagTaak[]> => {
      const { data, error } = await supabase
        .from('mep_dag_taken')
        .select(DAGVELDEN)
        .eq('datum', datum)
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as MepDagTaak[]
    },
  })
}

/** De lijst waar de keuken vandaag mee werkt: wat er voor vandaag klaarstaat,
 *  plus wat er van eerdere dagen nog openstaat. */
export function useMepVandaag() {
  const vandaag = vandaagStr()
  return useQuery({
    queryKey: ['mep-vandaag', vandaag],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async (): Promise<MepDagTaak[]> => {
      const { data, error } = await supabase
        .from('mep_dag_taken')
        .select(DAGVELDEN)
        .lte('datum', vandaag)
        .order('datum', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      const alles = (data ?? []) as unknown as MepDagTaak[]
      // Van eerdere dagen alleen wat nog open is; van vandaag ook het afgevinkte,
      // zodat je ziet dat je vinkje is aangekomen.
      return alles.filter((t) => t.datum === vandaag || !t.gedaan)
    },
  })
}

export function isBlijvenLiggen(taak: MepDagTaak) {
  return taak.datum < vandaagStr() && !taak.gedaan
}

function ververs(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: ['mep-dag'] })
  client.invalidateQueries({ queryKey: ['mep-vandaag'] })
}

export function useMepAanzetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { datum: string; taak: MepTaak; doorNaam: string }) => {
      const { error } = await supabase.from('mep_dag_taken').insert({
        datum: v.datum,
        sjabloon_id: v.taak.id,
        naam: v.taak.naam,
        aangezet_door: v.doorNaam,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => ververs(client),
  })
}

export function useMepAfzetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('mep_dag_taken').delete().eq('id', id).eq('gedaan', false)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => ververs(client),
  })
}

export function useMepAanpassen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; hoeveelheid?: string | null; notitie?: string | null }) => {
      const velden: Record<string, string | null> = {}
      if (v.hoeveelheid !== undefined) velden.hoeveelheid = v.hoeveelheid?.trim() || null
      if (v.notitie !== undefined) velden.notitie = v.notitie?.trim() || null
      const { error } = await supabase.from('mep_dag_taken').update(velden).eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => ververs(client),
  })
}

export function useMepAftikken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      id: number
      gedaan: boolean
      medewerkerId: string | null | undefined
      doorNaam: string
    }) => {
      const { error } = await supabase
        .from('mep_dag_taken')
        .update({
          gedaan: v.gedaan,
          gedaan_op: v.gedaan ? new Date().toISOString() : null,
          gedaan_door: v.gedaan ? (v.medewerkerId ?? null) : null,
          gedaan_door_naam: v.gedaan ? v.doorNaam : null,
        })
        .eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => ververs(client),
  })
}

/* --------------------------------------------------------------- notitie --- */

export function useMepNotitie(datum: string) {
  return useQuery({
    queryKey: ['mep-notitie', datum],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('mep_dag_notitie')
        .select('tekst')
        .eq('datum', datum)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return ((data as { tekst: string | null } | null)?.tekst ?? '')
    },
  })
}

export function useMepNotitieZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { datum: string; tekst: string; doorNaam: string }) => {
      const { error } = await supabase.from('mep_dag_notitie').upsert(
        {
          datum: v.datum,
          tekst: v.tekst.trim() || null,
          bijgewerkt_op: new Date().toISOString(),
          door: v.doorNaam,
        },
        { onConflict: 'datum' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mep-notitie'] }),
  })
}

/* -------------------------------------------------------------- de lijst --- */

export function useMepTaakBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (t: Partial<MepTaak> & { naam: string }) => {
      const velden = {
        naam: t.naam.trim(),
        groep: t.groep?.trim() || null,
        toelichting: t.toelichting?.trim() || null,
        volgorde: t.volgorde ?? 999,
        actief: t.actief ?? true,
      }
      const { error } = t.id
        ? await supabase.from('mep_sjablonen').update(velden).eq('id', t.id)
        : await supabase.from('mep_sjablonen').insert(velden)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mep-taken'] }),
  })
}

export function useMepTaakAanUit() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, actief }: { id: number; actief: boolean }) => {
      const { error } = await supabase.from('mep_sjablonen').update({ actief }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mep-taken'] }),
  })
}
