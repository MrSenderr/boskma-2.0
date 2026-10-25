import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Wat een medewerker van zichzelf ziet en mag wijzigen. Zie
   docs/modules/personeel/personeelsmodule.md.

   Elke wijziging wordt gemeld aan Sander — ook een adreswijziging, want die moet
   naar het loonbureau. Rekeningnummer en mailadres wachten eerst op zijn akkoord. */

export type MijnGegevens = {
  id: string
  voornaam: string | null
  achternaam: string | null
  geboortedatum: string | null
  telefoonnummer: string | null
  email: string | null
  onboarding_data: Record<string, unknown> | null
  functie: string | null
  ingangsdatum: string | null
}

export type Wijziging = {
  id: number
  medewerker_id: string
  veld: string
  oude_waarde: string | null
  nieuwe_waarde: string | null
  goedkeuring_nodig: boolean
  status: string
  aangevraagd_op: string
  verwerkt_op?: string | null
  /** Wanneer het loonbureau het heeft gehoord. Leeg = nog doorgeven. */
  naar_loonbureau_op?: string | null
}

export const VELDNAMEN: Record<string, string> = {
  telefoonnummer: 'Telefoonnummer',
  straat: 'Straat',
  huisnummer: 'Huisnummer',
  toevoeging: 'Toevoeging',
  postcode: 'Postcode',
  woonplaats: 'Woonplaats',
  noodcontact_naam: 'Noodcontact',
  noodcontact_tel: 'Noodcontact telefoon',
  tshirt_maat: 'Kledingmaat',
  iban: 'Rekeningnummer',
  email: 'E-mailadres',
}

/** Wat het loonbureau moet weten als het verandert. */
export const NAAR_LOONBUREAU = ['straat', 'huisnummer', 'toevoeging', 'postcode', 'woonplaats', 'iban']

export function useMijnGegevens(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['mijn-gegevens', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<MijnGegevens> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select('id,voornaam,achternaam,geboortedatum,telefoonnummer,email,onboarding_data,functie,ingangsdatum')
        .eq('id', medewerkerId!)
        .single()
      if (error) throw new Error(error.message)
      return data as unknown as MijnGegevens
    },
  })
}

export function useMijnWijzigingen(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['mijn-wijzigingen', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Wijziging[]> => {
      const { data, error } = await supabase
        .from('wijzigingen')
        .select('id,medewerker_id,veld,oude_waarde,nieuwe_waarde,goedkeuring_nodig,status,aangevraagd_op')
        .eq('status', 'open')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Wijziging[]
    },
  })
}

export function useGegevenWijzigen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ veld, waarde }: { veld: string; waarde: string }) => {
      const { data, error } = await supabase.rpc('mijn_gegeven_wijzigen', {
        p_veld: veld,
        p_waarde: waarde,
      })
      if (error) throw new Error(error.message)
      return data as 'ongewijzigd' | 'doorgevoerd' | 'wacht_op_akkoord'
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['mijn-gegevens'] })
      client.invalidateQueries({ queryKey: ['mijn-wijzigingen'] })
    },
  })
}

/* ------------------------------------------------------------- beheerkant --- */

export type OpenWijziging = Wijziging & {
  sollicitaties: { voornaam: string | null; achternaam: string | null } | null
}

export function useOpenWijzigingen() {
  return useQuery({
    queryKey: ['open-wijzigingen'],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OpenWijziging[]> => {
      const { data, error } = await supabase
        .from('wijzigingen')
        .select(
          'id,medewerker_id,veld,oude_waarde,nieuwe_waarde,goedkeuring_nodig,status,aangevraagd_op,sollicitaties(voornaam,achternaam)',
        )
        .eq('status', 'open')
        .order('aangevraagd_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as OpenWijziging[]
    },
  })
}

export function useWijzigingAfhandelen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, akkoord }: { id: number; akkoord: boolean }) => {
      const { error } = await supabase.rpc('wijziging_afhandelen', { p_id: id, p_akkoord: akkoord })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['open-wijzigingen'] })
      client.invalidateQueries({ queryKey: ['persoon'] })
    },
  })
}

/* ------------------------------------------------- wat iemand zelf wijzigde --- */

/* Het spoor van wijzigingen op de kaart van één medewerker.
 *
 * Alle wijzigingen, niet alleen de wachtende. Een melding die verdwijnt zodra
 * je hem wegtikt laat je met de vraag zitten of dat rekeningnummer altijd al
 * zo was of vorige maand is veranderd — en of je het hebt doorgegeven. */
export function useWijzigingenVan(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['wijzigingen-van', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Wijziging[]> => {
      const { data, error } = await supabase
        .from('wijzigingen')
        .select(
          'id,medewerker_id,veld,oude_waarde,nieuwe_waarde,goedkeuring_nodig,status,aangevraagd_op,verwerkt_op,naar_loonbureau_op',
        )
        .eq('medewerker_id', medewerkerId as string)
        .order('aangevraagd_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Wijziging[]
    },
  })
}

/* Moet het loonbureau dit nog horen?
 *
 * Alleen bij velden die de loonbetaling raken, alleen als de wijziging ook
 * werkelijk is doorgevoerd — een afgewezen verzoek hoeft nergens heen — en
 * alleen als het nog niet is doorgegeven. */
export function moetNaarLoonbureau(w: Wijziging): boolean {
  if (!NAAR_LOONBUREAU.includes(w.veld)) return false
  if (w.status === 'afgewezen') return false
  if (w.goedkeuring_nodig && w.status === 'open') return false
  return !w.naar_loonbureau_op
}

export function useWijzigingDoorgegeven(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) return
      const { error } = await supabase
        .from('wijzigingen')
        .update({ naar_loonbureau_op: new Date().toISOString() })
        .in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['wijzigingen-van', medewerkerId] })
      client.invalidateQueries({ queryKey: ['open-wijzigingen'] })
    },
  })
}
