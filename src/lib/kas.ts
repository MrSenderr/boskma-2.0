import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* De kastelling. Zie docs/Modules/kas.md.

   Alles rekent in CENTEN, als hele getallen. Rekenen met 0,05 en 0,10 als
   kommagetallen levert na genoeg optellingen 0,30000000000000004 op, en bij een
   kastelling is dat het verschil tussen "klopt" en "klopt niet". Pas bij het
   tonen wordt er door honderd gedeeld. */

export type Soort = 'munt' | 'biljet'

export type Coupure = {
  waarde_cent: number
  soort: Soort
  gewenst: number
  volgorde: number
}

export type Telling = {
  id: number
  datum: string
  gemaakt_op: string
  door_naam: string | null
  geteld_cent: number
  blijft_cent: number
  eruit_munt_cent: number
  eruit_biljet_cent: number
  opmerking: string | null
}

export type TellingRegel = {
  telling_id: number
  waarde_cent: number
  geteld: number
  blijft: number
  eruit: number
}

export type KluisMutatie = {
  id: number
  soort: 'uit_kassa' | 'naar_bank' | 'naar_kassa' | 'correctie'
  munt_cent: number
  biljet_cent: number
  telling_id: number | null
  datum: string
  opmerking: string | null
  door_naam: string | null
}

/** € 12,35 uit 1235. Nooit andersom rekenen. */
export function euro(cent: number) {
  const teken = cent < 0 ? '−' : ''
  const heel = Math.abs(cent)
  return `${teken}€ ${Math.floor(heel / 100)},${String(heel % 100).padStart(2, '0')}`
}

/** "€ 0,05" of "€ 20" — voor het label van een coupure. */
export function coupureNaam(cent: number) {
  return cent < 100 ? `${cent} ct` : `€ ${cent / 100}`
}

/* ------------------------------------------------------------------ splitsen --- */

export type Verdeling = {
  waarde_cent: number
  soort: Soort
  geteld: number
  gewenst: number
  /** Wat er in de lade blijft: nooit meer dan er geteld is. */
  blijft: number
  /** Wat eruit gaat naar de kluis. */
  eruit: number
  /** Hoeveel je er tekort komt om op het gewenste aantal te komen. */
  tekort: number
}

/** De hele splitsing, per coupure. Simpel en voorspelbaar: van elke coupure
 *  blijft het gewenste aantal liggen, de rest gaat eruit, en wat er niet is
 *  wordt als tekort gemeld. Geen slimmigheid die je later niet meer kunt
 *  navertellen. */
export function verdeel(coupures: Coupure[], geteld: Record<number, number>): Verdeling[] {
  return coupures
    .slice()
    .sort((a, b) => a.volgorde - b.volgorde)
    .map((c) => {
      const aantal = geteld[c.waarde_cent] ?? 0
      const blijft = Math.min(aantal, c.gewenst)
      return {
        waarde_cent: c.waarde_cent,
        soort: c.soort,
        geteld: aantal,
        gewenst: c.gewenst,
        blijft,
        eruit: aantal - blijft,
        tekort: Math.max(0, c.gewenst - aantal),
      }
    })
}

export function tel(verdeling: Verdeling[]) {
  const som = (kies: (v: Verdeling) => number, soort?: Soort) =>
    verdeling.filter((v) => !soort || v.soort === soort).reduce((n, v) => n + kies(v) * v.waarde_cent, 0)

  return {
    geteld: som((v) => v.geteld),
    blijft: som((v) => v.blijft),
    eruitMunt: som((v) => v.eruit, 'munt'),
    eruitBiljet: som((v) => v.eruit, 'biljet'),
    tekort: verdeling.filter((v) => v.tekort > 0),
  }
}

/** Wat er in de lade hoort te liggen als alles klopt. */
export function kasbedrag(coupures: Coupure[]) {
  return coupures.reduce((n, c) => n + c.gewenst * c.waarde_cent, 0)
}

/* -------------------------------------------------------------------- lezen --- */

export function useCoupures() {
  return useQuery({
    queryKey: ['kas-coupures'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Coupure[]> => {
      const { data, error } = await supabase
        .from('kas_coupures')
        .select('waarde_cent,soort,gewenst,volgorde')
        .order('volgorde', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Coupure[]
    },
  })
}

export function useCoupureZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ waarde_cent, gewenst }: { waarde_cent: number; gewenst: number }) => {
      const { error } = await supabase
        .from('kas_coupures')
        .update({ gewenst: Math.max(0, Math.floor(gewenst)) })
        .eq('waarde_cent', waarde_cent)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['kas-coupures'] }),
  })
}

export function useTellingen(hoeveel = 60) {
  return useQuery({
    queryKey: ['kas-tellingen', hoeveel],
    queryFn: async (): Promise<Telling[]> => {
      const { data, error } = await supabase
        .from('kas_tellingen')
        .select('id,datum,gemaakt_op,door_naam,geteld_cent,blijft_cent,eruit_munt_cent,eruit_biljet_cent,opmerking')
        .order('datum', { ascending: false })
        .order('id', { ascending: false })
        .limit(hoeveel)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Telling[]
    },
  })
}

export function useTellingRegels(tellingId: number | undefined) {
  return useQuery({
    queryKey: ['kas-regels', tellingId],
    enabled: Boolean(tellingId),
    queryFn: async (): Promise<TellingRegel[]> => {
      const { data, error } = await supabase
        .from('kas_telling_regels')
        .select('telling_id,waarde_cent,geteld,blijft,eruit')
        .eq('telling_id', tellingId!)
        .order('waarde_cent', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as TellingRegel[]
    },
  })
}

/* ------------------------------------------------------------------ bewaren --- */

export function useTellingBewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      verdeling: Verdeling[]
      opmerking: string
      medewerkerId: string | null | undefined
      doorNaam: string
    }) => {
      const totalen = tel(v.verdeling)

      const { data, error } = await supabase
        .from('kas_tellingen')
        .insert({
          geteld_cent: totalen.geteld,
          blijft_cent: totalen.blijft,
          eruit_munt_cent: totalen.eruitMunt,
          eruit_biljet_cent: totalen.eruitBiljet,
          opmerking: v.opmerking.trim() || null,
          medewerker_id: v.medewerkerId ?? null,
          door_naam: v.doorNaam,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      const id = (data as { id: number }).id

      const { error: regelFout } = await supabase.from('kas_telling_regels').insert(
        v.verdeling.map((r) => ({
          telling_id: id,
          waarde_cent: r.waarde_cent,
          geteld: r.geteld,
          blijft: r.blijft,
          eruit: r.eruit,
        })),
      )
      if (regelFout) throw new Error(regelFout.message)

      // Wat uit de lade komt gaat naar de kluis: munten als voorraad, briefgeld
      // tot de eerstvolgende bankstorting.
      if (totalen.eruitMunt > 0 || totalen.eruitBiljet > 0) {
        const { error: kluisFout } = await supabase.from('kluis_mutaties').insert({
          soort: 'uit_kassa',
          munt_cent: totalen.eruitMunt,
          biljet_cent: totalen.eruitBiljet,
          telling_id: id,
          door_naam: v.doorNaam,
        })
        if (kluisFout) throw new Error(kluisFout.message)
      }

      return id
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['kas-tellingen'] })
      client.invalidateQueries({ queryKey: ['kluis'] })
    },
  })
}

/* -------------------------------------------------------------------- kluis --- */

export function useKluis(hoeveel = 60) {
  return useQuery({
    queryKey: ['kluis', hoeveel],
    staleTime: 0,
    queryFn: async (): Promise<{ munt: number; biljet: number; mutaties: KluisMutatie[] }> => {
      // Het saldo is de optelsom van alle mutaties, niet een apart bijgehouden
      // getal: dan kan het niet uit elkaar lopen met de geschiedenis.
      const [alles, laatste] = await Promise.all([
        supabase.from('kluis_mutaties').select('munt_cent,biljet_cent'),
        supabase
          .from('kluis_mutaties')
          .select('id,soort,munt_cent,biljet_cent,telling_id,datum,opmerking,door_naam')
          .order('datum', { ascending: false })
          .order('id', { ascending: false })
          .limit(hoeveel),
      ])
      if (alles.error) throw new Error(alles.error.message)
      if (laatste.error) throw new Error(laatste.error.message)

      const rijen = (alles.data ?? []) as { munt_cent: number; biljet_cent: number }[]
      return {
        munt: rijen.reduce((n, r) => n + r.munt_cent, 0),
        biljet: rijen.reduce((n, r) => n + r.biljet_cent, 0),
        mutaties: (laatste.data ?? []) as unknown as KluisMutatie[],
      }
    },
  })
}

export function useKluisMutatie() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (m: {
      soort: KluisMutatie['soort']
      muntCent: number
      biljetCent: number
      opmerking: string | null
      doorNaam: string
    }) => {
      const { error } = await supabase.from('kluis_mutaties').insert({
        soort: m.soort,
        munt_cent: m.muntCent,
        biljet_cent: m.biljetCent,
        opmerking: m.opmerking?.trim() || null,
        door_naam: m.doorNaam,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['kluis'] }),
  })
}

export function useKluisGrens() {
  return useQuery({
    queryKey: ['instelling', 'kluis_grens'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('instellingen')
        .select('waarde')
        .eq('sleutel', 'kluis_grens')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const w = (data as { waarde?: { biljet_cent?: number } } | null)?.waarde
      return w?.biljet_cent ?? 200000
    },
  })
}
