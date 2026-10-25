/* Digitaal tekenen van een contract.
 *
 * De volgorde ligt vast en dat is geen smaak: de medewerker tekent, dan tekent
 * Sander mee. Een contract dat alleen de werkgever heeft getekend is geen
 * contract maar een aanbod.
 *
 * De controlecode is wat deze module bij elkaar houdt. Bij het starten wordt de
 * SHA-256 van de PDF vastgelegd. De serverfunctie rekent hem opnieuw uit op het
 * moment dat de getekende versie wordt gemaakt, en weigert als hij veranderd
 * is. Daarmee kun je achteraf laten zien dat er getekend is wát er gelezen is,
 * en niet alleen dát er getekend is.
 *
 * Papier blijft kunnen: printen, tekenen, scannen en uploaden als getekend
 * contract. Dat loopt langs deze module heen en blijft werken zoals het werkte.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { naamVan, type Persoon } from './personeel'
import { plusMaanden, vandaagIso } from './datums'

export type Ondertekening = {
  id: string
  medewerker_id: string
  document_id: number
  voorstel_id: string | null
  origineel_sha256: string
  origineel_naam: string
  ouder_nodig: boolean
  gestart_op: string
  gestart_door: string | null
  verstuurd_op: string | null
  geopend_op: string | null
  medewerker_naam: string | null
  medewerker_krabbel: string | null
  medewerker_op: string | null
  ouder_naam: string | null
  ouder_relatie: string | null
  ouder_krabbel: string | null
  ouder_op: string | null
  werkgever_naam: string | null
  werkgever_krabbel: string | null
  werkgever_op: string | null
  getekend_document_id: number | null
  afgerond_op: string | null
  ingetrokken_op: string | null
  ingetrokken_reden: string | null
}

export type Stand =
  /** Klaargezet, de medewerker weet er nog niets van. */
  | 'klaargezet'
  /** Bij de medewerker, nog niet getekend. */
  | 'bij_medewerker'
  /** De medewerker heeft getekend; Sander moet meetekenen. */
  | 'jouw_beurt'
  /** Allebei getekend, de getekende versie moet nog gemaakt worden. */
  | 'afmaken'
  | 'klaar'
  | 'ingetrokken'

export const STANDNAAM: Record<Stand, string> = {
  klaargezet: 'Klaargezet',
  bij_medewerker: 'Bij de medewerker',
  jouw_beurt: 'Jij moet nog tekenen',
  afmaken: 'Afmaken',
  klaar: 'Getekend',
  ingetrokken: 'Ingetrokken',
}

export function standVan(o: Ondertekening): Stand {
  if (o.ingetrokken_op) return 'ingetrokken'
  if (o.afgerond_op) return 'klaar'
  if (o.werkgever_op) return 'afmaken'
  if (o.medewerker_op) return 'jouw_beurt'
  if (o.verstuurd_op) return 'bij_medewerker'
  return 'klaargezet'
}

/** Ligt dit stuk nu bij de medewerker? */
export function wachtOpMedewerker(o: Ondertekening): boolean {
  return Boolean(o.verstuurd_op) && !o.ingetrokken_op && !o.medewerker_op
}

/** Moet Sander nu iets doen, en wat? */
export function wachtOpWerkgever(o: Ondertekening): boolean {
  if (o.ingetrokken_op || o.afgerond_op) return false
  return Boolean(o.medewerker_op)
}

/* Onder de 18 laat het scherm een vak voor een ouder zien. Of een
   handtekening van een ouder nodig is, is nog niet uitgezocht (open punt voor
   Pieter); daarom wel een plek en geen verplichting. Leeftijd onbekend telt
   niet als minderjarig — dan verzin je een reden voor een extra vak. */
export function ouderNodig(p: Persoon, vandaag = vandaagIso()): boolean {
  const geboren = p.geboortedatum?.slice(0, 10)
  if (!geboren || !/^\d{4}-\d{2}-\d{2}$/.test(geboren)) return false
  // De dag waarop hij 18 wordt. Ligt die in de toekomst, dan is hij nu jonger.
  return plusMaanden(geboren, 18 * 12) > vandaag
}

/* De controlecode verkort: het eerste en het laatste blokje. Genoeg om een
   document te herkennen, en niet drie regels op een telefoon. Voluit staat hij
   op de laatste bladzijde van het getekende contract, en daar hoort hij ook:
   daar vergelijk je hem mee. */
export function codeKort(code: string): string {
  if (code.length <= 20) return code
  return `${code.slice(0, 8)} … ${code.slice(-8)}`
}

/* -------------------------------------------------------------- ophalen --- */

const VELDEN = '*'

export function useOndertekeningen(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['ondertekeningen', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Ondertekening[]> => {
      const { data, error } = await supabase
        .from('ondertekeningen')
        .select(VELDEN)
        .eq('medewerker_id', medewerkerId as string)
        .order('gestart_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Ondertekening[]
    },
  })
}

/* De policy eigen_ondertekening laat alleen door wat verstuurd is en niet is
   ingetrokken. Hier staat dus geen extra filter: dat zou doen alsof de
   beveiliging in de browser zit. */
export function useMijnOndertekeningen() {
  return useQuery({
    queryKey: ['mijn-ondertekeningen'],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Ondertekening[]> => {
      const { data, error } = await supabase
        .from('ondertekeningen')
        .select(VELDEN)
        .order('gestart_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Ondertekening[]
    },
  })
}

/* ------------------------------------------------------------ Sanders kant --- */

/* Klaarzetten. De controlecode komt uit het document zoals het is geüpload;
   de server rekent hem bij het afmaken opnieuw uit over de bytes in de opslag
   en vergelijkt. Staat er geen code bij het document, dan is er niets om op te
   vergelijken en gaat het niet door. */
export function useOndertekeningStarten(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      persoon: Persoon
      document: { id: number; naam: string; sha256: string | null }
      voorstelId?: string | null
    }) => {
      if (!opdracht.document.sha256) {
        throw new Error(
          'Van dit document is geen controlecode bekend. Upload het opnieuw, dan kan het getekend worden.',
        )
      }
      const { error } = await supabase.from('ondertekeningen').insert({
        medewerker_id: medewerkerId,
        document_id: opdracht.document.id,
        voorstel_id: opdracht.voorstelId ?? null,
        origineel_sha256: opdracht.document.sha256,
        origineel_naam: opdracht.document.naam,
        ouder_nodig: ouderNodig(opdracht.persoon),
        gestart_door: (await supabase.auth.getUser()).data.user?.email ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['ondertekeningen', medewerkerId] }),
  })
}

/** Het stuk bij de medewerker leggen: mail en, als hij die aan heeft, een push. */
export function useOndertekeningVersturen(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (o: Ondertekening) => {
      const { data, error } = await supabase.functions.invoke('stuur-ondertekening', {
        body: { ondertekening: o.id },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Versturen lukte niet.')
      return data as { testmodus: boolean; verstuurd_naar: string; apparaten: number }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['ondertekeningen', medewerkerId] }),
  })
}

/** Sander tekent mee. Kan pas als de medewerker heeft getekend; dat houdt de
 *  database ook tegen (constraint werkgever_tekent_mee). */
export function useWerkgeverTekent(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: { id: string; naam: string; krabbel: string | null }) => {
      const naam = opdracht.naam.trim()
      if (naam.length < 2) throw new Error('Vul je naam voluit in.')
      const { error } = await supabase
        .from('ondertekeningen')
        .update({
          werkgever_naam: naam,
          werkgever_krabbel: opdracht.krabbel,
          werkgever_op: new Date().toISOString(),
          bijgewerkt_op: new Date().toISOString(),
        })
        .eq('id', opdracht.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['ondertekeningen', medewerkerId] }),
  })
}

/* Het getekende stuk maken en meteen naar het loonbureau. Dat laatste gaat
   langs dezelfde weg als een gescand contract (stuur-getekend-contract), zodat
   er één plek is waar het adres, de testmodus en de cc staan. Mislukt het
   versturen, dan blijft het getekende contract gewoon staan en kun je het
   vanaf het dossier alsnog versturen — daar is al een knop voor. */
export function useOndertekeningAfmaken(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (o: Ondertekening) => {
      const { data, error } = await supabase.functions.invoke('teken-contract', {
        body: { ondertekening: o.id },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Het getekende contract maken lukte niet.')

      const documentId = data.document_id as number
      let verstuurd: { testmodus?: boolean; verstuurd_naar?: string } | null = null
      let verstuurFout: string | null = null
      try {
        const { data: post, error: postFout } = await supabase.functions.invoke(
          'stuur-getekend-contract',
          { body: { document_id: documentId } },
        )
        if (postFout) throw new Error(postFout.message)
        if (post && post.ok === false) throw new Error(post.error ?? 'Versturen lukte niet.')
        verstuurd = post
      } catch (e) {
        verstuurFout = e instanceof Error ? e.message : 'Versturen lukte niet.'
      }
      return { documentId, verstuurd, verstuurFout }
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['ondertekeningen', medewerkerId] })
      client.invalidateQueries({ queryKey: ['dossier-documenten', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contract-standen'] })
    },
  })
}

export function useOndertekeningIntrekken(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reden }: { id: string; reden?: string }) => {
      const { error } = await supabase
        .from('ondertekeningen')
        .update({
          ingetrokken_op: new Date().toISOString(),
          ingetrokken_reden: reden ?? null,
          bijgewerkt_op: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['ondertekeningen', medewerkerId] }),
  })
}

/* ------------------------------------------------------- de medewerkerkant --- */

export async function ondertekeningGeopend(id: string) {
  await supabase.rpc('ondertekening_geopend', { p_id: id })
}

export function useIkTeken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      id: string
      naam: string
      krabbel: string | null
      ouderNaam?: string
      ouderRelatie?: string
      ouderKrabbel?: string | null
    }) => {
      const { error } = await supabase.rpc('ondertekening_tekenen', {
        p_id: opdracht.id,
        p_naam: opdracht.naam,
        p_krabbel: opdracht.krabbel,
        p_ouder_naam: opdracht.ouderNaam?.trim() || null,
        p_ouder_relatie: opdracht.ouderRelatie?.trim() || null,
        p_ouder_krabbel: opdracht.ouderKrabbel ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mijn-ondertekeningen'] }),
  })
}

/** De naam zoals hij op de kaart staat, als voorzet in het naamveld. */
export function voorgesteldeNaam(p: Persoon): string {
  return naamVan(p)
}
