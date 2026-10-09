/* Inkomende facturen: wat Kim per mail binnenkrijgt en in public.facturen zet.

   De vraag die dit scherm beantwoordt is "wat moet ik zelf overmaken, en
   wanneer uiterlijk". Incasso's hoeven niets van je; die vinkt de dagelijkse
   ronde zelf af.

   Kim schrijft in deze tabel. Namen van kolommen veranderen breekt haar ronde,
   dus die staan hier precies zoals ze in de database heten. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Betaalwijze = 'incasso' | 'handmatig' | 'vooraf_betaald' | 'onbekend'
export type Status = 'open' | 'betaald' | 'betwist' | 'geannuleerd'

export type Factuur = {
  id: number
  leverancier: string
  factuurnummer: string | null
  soort: 'factuur' | 'creditnota'
  factuurdatum: string | null
  vervaldatum: string | null
  bedrag_incl: number | null
  betaalwijze: Betaalwijze
  iban: string | null
  betalingskenmerk: string | null
  status: Status
  betaald_op: string | null
  basecone_op: string | null
  gmail_thread: string | null
  opmerking: string | null
}

/* ----------------------------------------------------------- weergave --- */

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

export function euro(bedrag: number | null | undefined): string {
  return bedrag === null || bedrag === undefined ? 'bedrag onbekend' : nl.format(bedrag)
}

/** "14 okt" — kort genoeg om naast een bedrag te passen. */
export function kortDatum(datum: string | null | undefined): string {
  if (!datum) return ''
  const d = new Date(`${datum.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function vandaagStr(nu = new Date()): string {
  return nu.toLocaleDateString('sv-SE')
}

function plusDagen(datum: string, dagen: number): string {
  const d = new Date(`${datum.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + dagen)
  return d.toLocaleDateString('sv-SE')
}

/* -------------------------------------------------------------- datum --- */

/** Wanneer de factuur uiterlijk betaald moet zijn.
 *
 *  Niet elke leverancier zet een vervaldatum op de factuur, dus vallen we terug
 *  op factuurdatum + 14, en anders op het moment dat hij naar Basecone ging.
 *  Dezelfde volgorde als facturen_dagelijks() in de database aanhoudt. */
export function uiterlijk(f: Factuur): string | null {
  if (f.vervaldatum) return f.vervaldatum.slice(0, 10)
  if (f.factuurdatum) return plusDagen(f.factuurdatum, 14)
  if (f.basecone_op) return plusDagen(f.basecone_op.slice(0, 10), 14)
  return null
}

export type Urgentie = 'te_laat' | 'bijna' | 'rustig' | 'geen_datum'

export function urgentie(f: Factuur, vandaag = vandaagStr()): Urgentie {
  const d = uiterlijk(f)
  if (!d) return 'geen_datum'
  if (d < vandaag) return 'te_laat'
  if (d <= plusDagen(vandaag, 3)) return 'bijna'
  return 'rustig'
}

export function dagenTeLaat(f: Factuur, vandaag = vandaagStr()): number {
  const d = uiterlijk(f)
  if (!d || d >= vandaag) return 0
  return Math.round(
    (new Date(`${vandaag}T00:00:00`).getTime() - new Date(`${d}T00:00:00`).getTime()) / 86_400_000,
  )
}

/** Op uiterste datum, en wie geen datum heeft onderaan: die kun je niet plannen
 *  maar mag je ook niet kwijtraken. */
export function opUiterlijk(a: Factuur, b: Factuur): number {
  const da = uiterlijk(a)
  const db = uiterlijk(b)
  if (da && db) return da.localeCompare(db) || a.leverancier.localeCompare(b.leverancier)
  if (da) return -1
  if (db) return 1
  return a.leverancier.localeCompare(b.leverancier)
}

export function telOp(lijst: Factuur[]): number {
  return lijst.reduce((som, f) => som + (f.bedrag_incl ?? 0), 0)
}

/** Een bedrag dat je niet kent telt niet mee, en dan klopt het totaal dus niet
 *  helemaal. Dat hoor je te zien in plaats van te raden. */
export function zonderBedrag(lijst: Factuur[]): number {
  return lijst.filter((f) => f.bedrag_incl === null || f.bedrag_incl === undefined).length
}

/* ---------------------------------------------------------- indelen --- */

export type Indeling = {
  zelfBetalen: Factuur[]
  onbekend: Factuur[]
  incasso: Factuur[]
  betaald: Factuur[]
  creditnotas: Factuur[]
}

/** Creditnota's horen niet bij "zelf betalen": daar krijg jij geld van. Ze
 *  staan apart, als één regel. */
export function deelIn(alles: Factuur[], vandaag = vandaagStr()): Indeling {
  const open = alles.filter((f) => f.status === 'open')
  const grens = plusDagen(vandaag, -30)

  return {
    zelfBetalen: open
      .filter((f) => f.soort === 'factuur' && f.betaalwijze === 'handmatig')
      .sort(opUiterlijk),
    onbekend: open
      .filter((f) => f.soort === 'factuur' && f.betaalwijze === 'onbekend')
      .sort(opUiterlijk),
    incasso: open
      .filter((f) => f.soort === 'factuur' && f.betaalwijze === 'incasso')
      .sort(opUiterlijk),
    betaald: alles
      .filter((f) => f.status === 'betaald' && (f.betaald_op ?? '') >= grens)
      .sort((a, b) => (b.betaald_op ?? '').localeCompare(a.betaald_op ?? '')),
    creditnotas: open.filter((f) => f.soort === 'creditnota'),
  }
}

export function gmailLink(thread: string | null | undefined): string | null {
  return thread ? `https://mail.google.com/mail/u/0/#all/${thread}` : null
}

/* -------------------------------------------------------------- data --- */

const VELDEN =
  'id,leverancier,factuurnummer,soort,factuurdatum,vervaldatum,bedrag_incl,betaalwijze,' +
  'iban,betalingskenmerk,status,betaald_op,basecone_op,gmail_thread,opmerking'

export function useFacturen() {
  return useQuery({
    queryKey: ['facturen'],
    queryFn: async (): Promise<Factuur[]> => {
      const { data, error } = await supabase
        .from('facturen')
        .select(VELDEN)
        .in('status', ['open', 'betaald'])
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Factuur[]
    },
  })
}

function useFactuurActie<T>(doe: (waarde: T) => Promise<void>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: doe,
    onSuccess: () => client.invalidateQueries({ queryKey: ['facturen'] }),
  })
}

export function useBetaald() {
  return useFactuurActie<number>(async (id) => {
    const { error } = await supabase.rpc('factuur_betaald', { p_id: id })
    if (error) throw new Error(error.message)
  })
}

export function useHeropenen() {
  return useFactuurActie<number>(async (id) => {
    const { error } = await supabase.rpc('factuur_heropenen', { p_id: id })
    if (error) throw new Error(error.message)
  })
}

export function useBetaalwijze() {
  return useFactuurActie<{ id: number; betaalwijze: Betaalwijze; voortaan?: boolean }>(
    async ({ id, betaalwijze, voortaan = true }) => {
      const { error } = await supabase.rpc('factuur_betaalwijze', {
        p_id: id,
        p_betaalwijze: betaalwijze,
        p_voortaan: voortaan,
      })
      if (error) throw new Error(error.message)
    },
  )
}

/* --------------------------------------------------- leveranciers --- */

/* Het schriftje: hoe betaalt elke leverancier. Zodra het ingevuld is, vult een
   nieuwe factuur zichzelf in en komt hij niet meer bij "nog uitzoeken". */

export type Leverancier = {
  leverancier: string
  /** Null als er nog niets over bekend is. */
  betaalwijze: Betaalwijze | null
  /** Door Sander zelf gezet. Alleen daarop vult een nieuwe factuur zich in. */
  bevestigd: boolean
  opmerking: string | null
  aantal: number
  aantal_open: number
  laatste: string | null
}

export function useLeveranciers() {
  return useQuery({
    queryKey: ['leveranciers'],
    queryFn: async (): Promise<Leverancier[]> => {
      const { data, error } = await supabase.rpc('leveranciers_overzicht')
      if (error) throw new Error(error.message)
      return (data ?? []) as Leverancier[]
    },
  })
}

export function useLeverancierZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leverancier,
      betaalwijze,
    }: {
      leverancier: string
      betaalwijze: Betaalwijze
    }) => {
      const { error } = await supabase.rpc('leverancier_betaalwijze_zetten', {
        p_leverancier: leverancier,
        p_betaalwijze: betaalwijze,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['leveranciers'] })
      // Openstaande facturen van deze leverancier zijn meeveranderd.
      client.invalidateQueries({ queryKey: ['facturen'] })
    },
  })
}

export const BETAALWIJZEN: { waarde: Betaalwijze; label: string }[] = [
  { waarde: 'incasso', label: 'Incasso' },
  { waarde: 'handmatig', label: 'Zelf betalen' },
  { waarde: 'vooraf_betaald', label: 'Vooraf betaald' },
]

export function betaalwijzeNaam(w: Betaalwijze | null | undefined): string {
  return BETAALWIJZEN.find((b) => b.waarde === w)?.label ?? 'nog niet ingesteld'
}

/** Nog in te stellen staat bovenaan: dat is het werk dat er ligt. */
export function opWerkEerst(a: Leverancier, b: Leverancier): number {
  if (a.bevestigd !== b.bevestigd) return a.bevestigd ? 1 : -1
  return a.leverancier.localeCompare(b.leverancier, 'nl')
}

export function nogInTeStellen(lijst: Leverancier[]): number {
  return lijst.filter((l) => !l.bevestigd).length
}
