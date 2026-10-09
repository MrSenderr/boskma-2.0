/* Uitgaande facturen: klanten, prijslijst, en wat jij verstuurt.

   Prijzen zijn inclusief btw, net als op de kaart. De btw wordt eruit gerekend,
   niet erbij opgeteld.

   Het rekenwerk hier staat náást dat in de database: het scherm laat het totaal
   live meelopen terwijl je typt, de database bepaalt wat er op de factuur komt.
   Daarom reken ik hier in hele centen, met dezelfde afrondingen — anders zie je
   straks een cent verschil tussen je scherm en je pdf. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { euro, kortDatum, vandaagStr } from './facturen'

export { euro, kortDatum }

export type Btw = 0 | 9 | 21
export type FactuurStatus = 'concept' | 'verzonden' | 'betaald' | 'gecrediteerd'

export type Klant = {
  id: number
  naam: string
  contactpersoon: string | null
  factuur_email: string | null
  cc_email: string | null
  adres: string | null
  postcode: string | null
  plaats: string | null
  kvk: string | null
  btw_nummer: string | null
  betaaltermijn_dagen: number
  notities: string | null
  actief: boolean
}

export type Product = {
  id: number
  naam: string
  omschrijving: string | null
  prijs_incl: number
  btw_tarief: Btw
  eenheid: string
  actief: boolean
  volgorde: number
}

export type Regel = {
  id?: number
  factuur_id?: number
  volgorde: number
  product_id: number | null
  omschrijving: string
  aantal: number
  prijs_incl: number
  btw_tarief: Btw
}

export type Verkoopfactuur = {
  id: number
  nummer: number | null
  klant_id: number
  factuurdatum: string | null
  vervaldatum: string | null
  leverdatum: string | null
  periode: string | null
  onderwerp: string | null
  notitie_op_factuur: string | null
  interne_notitie: string | null
  status: FactuurStatus
  totaal_excl: number
  btw_9: number
  btw_21: number
  totaal_incl: number
  pdf_pad: string | null
  verzonden_op: string | null
  betaald_op: string | null
  credit_van: number | null
  klanten?: { naam: string } | null
}

/* ----------------------------------------------------------- rekenen --- */

const centen = (euros: number) => Math.round(euros * 100)

/** Wat één regel kost, in centen. Zelfde afronding als de database. */
export function regelCenten(r: Pick<Regel, 'aantal' | 'prijs_incl'>): number {
  return Math.round((Number(r.aantal) || 0) * centen(Number(r.prijs_incl) || 0))
}

export type Totalen = { excl: number; btw9: number; btw21: number; incl: number }

/** Per tarief optellen en dán pas de btw eruit halen. Regel voor regel afronden
 *  loopt op een lange factuur een paar cent uit de pas met wat de klant optelt. */
export function totalenVan(regels: Regel[]): Totalen {
  const per = (t: Btw) =>
    regels.filter((r) => r.btw_tarief === t).reduce((som, r) => som + regelCenten(r), 0)

  const incl9 = per(9)
  const incl21 = per(21)
  const incl0 = per(0)

  const btw9 = Math.round((incl9 * 9) / 109)
  const btw21 = Math.round((incl21 * 21) / 121)
  const incl = incl9 + incl21 + incl0

  return { excl: incl - btw9 - btw21, btw9, btw21, incl }
}

/** Bedragen uit de database staan in euro's; het scherm rekent in centen. */
export function euroUitCenten(c: number): string {
  return euro(c / 100)
}

/** Een regel naar een andere plek in de lijst. De volgorde hier is de volgorde
 *  op de factuur, dus daarna opnieuw nummeren. */
export function verwissel(regels: Regel[], van: number, naar: number): Regel[] {
  const uit = [...regels]
  const [weg] = uit.splice(van, 1)
  uit.splice(naar, 0, weg)
  return uit.map((r, i) => ({ ...r, volgorde: i }))
}

/* ------------------------------------------------------------ datums --- */

export function dagenTeLaat(f: Verkoopfactuur, vandaag = vandaagStr()): number {
  if (!f.vervaldatum || f.status !== 'verzonden') return 0
  if (f.vervaldatum >= vandaag) return 0
  return Math.round(
    (new Date(`${vandaag}T00:00:00`).getTime() -
      new Date(`${f.vervaldatum}T00:00:00`).getTime()) / 86_400_000,
  )
}

export function nogTeOntvangen(lijst: Verkoopfactuur[]): number {
  return lijst.filter((f) => f.status === 'verzonden').reduce((s, f) => s + Number(f.totaal_incl), 0)
}

export type Uitgaand = {
  concepten: Verkoopfactuur[]
  verzonden: Verkoopfactuur[]
  betaald: Verkoopfactuur[]
}

export function deelUitgaandIn(lijst: Verkoopfactuur[], vandaag = vandaagStr()): Uitgaand {
  const grens = new Date(`${vandaag}T00:00:00`)
  grens.setDate(grens.getDate() - 60)
  const vanaf = grens.toLocaleDateString('sv-SE')

  return {
    concepten: lijst
      .filter((f) => f.status === 'concept')
      .sort((a, b) => b.id - a.id),
    // De meest te late bovenaan: dat is waar je achteraan moet.
    verzonden: lijst
      .filter((f) => f.status === 'verzonden')
      .sort((a, b) => (a.vervaldatum ?? '9999').localeCompare(b.vervaldatum ?? '9999')),
    betaald: lijst
      .filter((f) => f.status === 'betaald' && (f.betaald_op ?? '') >= vanaf)
      .sort((a, b) => (b.betaald_op ?? '').localeCompare(a.betaald_op ?? '')),
  }
}

/* -------------------------------------------------------------- data --- */

const FACTUUR_VELDEN =
  'id,nummer,klant_id,factuurdatum,vervaldatum,leverdatum,periode,onderwerp,' +
  'notitie_op_factuur,interne_notitie,status,totaal_excl,btw_9,btw_21,totaal_incl,' +
  'pdf_pad,verzonden_op,betaald_op,credit_van,klanten(naam)'

export function useVerkoopfacturen() {
  return useQuery({
    queryKey: ['verkoopfacturen'],
    queryFn: async (): Promise<Verkoopfactuur[]> => {
      const { data, error } = await supabase
        .from('verkoopfacturen')
        .select(FACTUUR_VELDEN)
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Verkoopfactuur[]
    },
  })
}

export function useVerkoopfactuur(id: number | undefined) {
  return useQuery({
    queryKey: ['verkoopfactuur', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [f, r] = await Promise.all([
        supabase.from('verkoopfacturen').select(FACTUUR_VELDEN).eq('id', id!).single(),
        supabase
          .from('verkoopfactuur_regels')
          .select('id,factuur_id,volgorde,product_id,omschrijving,aantal,prijs_incl,btw_tarief')
          .eq('factuur_id', id!)
          .order('volgorde'),
      ])
      if (f.error) throw new Error(f.error.message)
      if (r.error) throw new Error(r.error.message)
      return {
        factuur: f.data as unknown as Verkoopfactuur,
        regels: (r.data ?? []) as unknown as Regel[],
      }
    },
  })
}

export function useKlanten() {
  return useQuery({
    queryKey: ['klanten'],
    queryFn: async (): Promise<Klant[]> => {
      const { data, error } = await supabase.from('klanten').select('*').order('naam')
      if (error) throw new Error(error.message)
      return (data ?? []) as Klant[]
    },
  })
}

export function useProducten() {
  return useQuery({
    queryKey: ['producten'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('producten')
        .select('*')
        .order('volgorde')
        .order('naam')
      if (error) throw new Error(error.message)
      return (data ?? []) as Product[]
    },
  })
}

/* ---------------------------------------------------------- opslaan --- */

function useVerkoopActie<T>(doe: (waarde: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: doe,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['verkoopfacturen'] })
      client.invalidateQueries({ queryKey: ['verkoopfactuur'] })
      client.invalidateQueries({ queryKey: ['klanten'] })
      client.invalidateQueries({ queryKey: ['producten'] })
    },
  })
}

export type ConceptInvoer = {
  id?: number
  klant_id: number
  onderwerp: string | null
  leverdatum: string | null
  periode: string | null
  notitie_op_factuur: string | null
  regels: Regel[]
}

/** Een concept opslaan. De regels gaan er in hun geheel uit en weer in: dat is
 *  eenvoudiger dan bijhouden wat er precies veranderd is, en het mag — zolang
 *  er geen nummer op staat ligt niets vast. */
export function useConceptOpslaan() {
  return useVerkoopActie<ConceptInvoer>(async (c) => {
    const kern = {
      klant_id: c.klant_id,
      onderwerp: c.onderwerp,
      leverdatum: c.leverdatum,
      periode: c.periode,
      notitie_op_factuur: c.notitie_op_factuur,
    }

    let id = c.id
    if (id) {
      const { error } = await supabase.from('verkoopfacturen').update(kern).eq('id', id)
      if (error) throw new Error(error.message)
      const weg = await supabase.from('verkoopfactuur_regels').delete().eq('factuur_id', id)
      if (weg.error) throw new Error(weg.error.message)
    } else {
      const { data, error } = await supabase
        .from('verkoopfacturen')
        .insert(kern)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      id = (data as { id: number }).id
    }

    if (c.regels.length > 0) {
      const { error } = await supabase.from('verkoopfactuur_regels').insert(
        c.regels.map((r, i) => ({
          factuur_id: id,
          volgorde: i,
          product_id: r.product_id,
          omschrijving: r.omschrijving,
          aantal: r.aantal,
          prijs_incl: r.prijs_incl,
          btw_tarief: r.btw_tarief,
        })),
      )
      if (error) throw new Error(error.message)
    }
    return id
  })
}

export function useConceptWeg() {
  return useVerkoopActie<number>(async (id) => {
    const { error } = await supabase.from('verkoopfacturen').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

/* De database deelt het id zelf uit en weigert het terug te krijgen. Hetzelfde
   geldt voor het moment van aanmaken. Die laten we er dus uit voordat we een
   rij bijwerken — anders komt er "column id can only be updated to DEFAULT"
   terug en lijkt het alsof je gegevens niet kloppen. */
export function zonderEigenVelden<T extends Record<string, unknown>>(rij: T): Partial<T> {
  const kopie = { ...rij }
  delete kopie.id
  delete kopie.aangemaakt_op
  return kopie
}

export function useKlantOpslaan() {
  return useVerkoopActie<Partial<Klant> & { naam: string }>(async (k) => {
    const velden = zonderEigenVelden(k as Record<string, unknown>)
    if (k.id) {
      const { error } = await supabase.from('klanten').update(velden).eq('id', k.id)
      if (error) throw new Error(error.message)
      return k.id
    }
    const { data, error } = await supabase.from('klanten').insert(velden).select('id').single()
    if (error) throw new Error(error.message)
    return (data as { id: number }).id
  })
}

export function useProductOpslaan() {
  return useVerkoopActie<Partial<Product> & { naam: string; prijs_incl: number }>(async (p) => {
    const velden = zonderEigenVelden(p as Record<string, unknown>)
    if (p.id) {
      const { error } = await supabase.from('producten').update(velden).eq('id', p.id)
      if (error) throw new Error(error.message)
      return p.id
    }
    const { error } = await supabase.from('producten').insert(velden)
    if (error) throw new Error(error.message)
  })
}

export function useProductWeg() {
  return useVerkoopActie<number>(async (id) => {
    const { error } = await supabase.from('producten').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

/* ------------------------------------------------------------- pdf --- */

/** De pdf van een factuur ophalen. Bij een concept komt er een watermerk op en
 *  wordt hij niet bewaard: een concept is geen factuur. */
export type PdfSoort = 'definitief' | 'concept' | 'test'

export async function haalPdf(factuurId: number, soort: PdfSoort): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('verkoopfactuur-pdf', {
    body: { factuur_id: factuurId, soort },
  })
  if (error) throw new Error(error.message)
  if (data instanceof Blob) return data
  throw new Error('De server gaf geen pdf terug.')
}

/* ------------------------------------------------------- versturen --- */

/** De mailtekst die de klant leest.
 *
 *  Staat hier en niet alleen in de edge function: je hoort te zien wat je
 *  verstuurt voordat je op versturen drukt, en wat je dan ziet moet ook zijn
 *  wat er weggaat. De app stuurt deze tekst dus altijd mee. */
export function standaardMailtekst(
  klant: Pick<Klant, 'contactpersoon'>,
  f: Pick<Verkoopfactuur, 'onderwerp' | 'totaal_incl' | 'vervaldatum'>,
  nummer: string,
): string {
  const aanhef = klant.contactpersoon?.trim() || 'administratie'
  const bedrag = euro(Number(f.totaal_incl))
  const voor = f.onderwerp ? ` voor ${f.onderwerp}` : ''
  const uiterlijk = f.vervaldatum
    ? new Date(`${f.vervaldatum}T00:00:00`).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'de vervaldatum'

  return [
    `Beste ${aanhef},`,
    '',
    `In de bijlage vind je factuur ${nummer}${voor}. Het totaalbedrag is ${bedrag} ` +
      `inclusief btw. Graag betalen vóór ${uiterlijk}.`,
    '',
    'Vriendelijke groet,',
    "Sander Boskma – Boskma Foodservice / Snackerie 't Zonnetje",
  ].join('\n')
}

export type Verstuurd = {
  ok: boolean
  test: boolean
  nummer: number | null
  verstuurd_naar: string
  basecone: string
  stap?: string
  error?: string
}

export function useVersturen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      id: number
      tekst: string
      test: boolean
      herinnering?: boolean
    }): Promise<Verstuurd> => {
      const { data, error } = await supabase.functions.invoke('stuur-verkoopfactuur', {
        body: { factuur_id: v.id, tekst: v.tekst, test: v.test, herinnering: v.herinnering },
      })
      if (error) throw new Error(error.message)
      const uit = data as Verstuurd
      // De functie vertelt bij welke stap het misging; dat is bruikbaarder dan
      // "er ging iets mis".
      if (!uit?.ok) throw new Error(`${uit?.stap ?? 'versturen'}: ${uit?.error ?? 'onbekende fout'}`)
      return uit
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['verkoopfacturen'] })
      client.invalidateQueries({ queryKey: ['verkoopfactuur'] })
    },
  })
}

export function useVerkoopBetaald() {
  return useVerkoopActie<{ id: number; datum: string }>(async ({ id, datum }) => {
    const { error } = await supabase.rpc('verkoopfactuur_betaald', { p_id: id, p_datum: datum })
    if (error) throw new Error(error.message)
  })
}

export function useVerkoopHeropenen() {
  return useVerkoopActie<number>(async (id) => {
    const { error } = await supabase.rpc('verkoopfactuur_heropenen', { p_id: id })
    if (error) throw new Error(error.message)
  })
}

export function useCrediteren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<number> => {
      const { data, error } = await supabase.rpc('verkoopfactuur_crediteren', { p_id: id })
      if (error) throw new Error(error.message)
      return Number(data)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['verkoopfacturen'] })
      client.invalidateQueries({ queryKey: ['verkoopfactuur'] })
    },
  })
}

/** De tekst bij een herinnering. Vriendelijk blijven: meestal is het gewoon
 *  blijven liggen, en je wilt de klant houden. */
export function herinneringstekst(
  klant: Pick<Klant, 'contactpersoon'>,
  f: Pick<Verkoopfactuur, 'nummer' | 'onderwerp' | 'totaal_incl' | 'vervaldatum'>,
): string {
  const aanhef = klant.contactpersoon?.trim() || 'administratie'
  const verviel = f.vervaldatum ? kortDatum(f.vervaldatum) : 'de vervaldatum'
  return [
    `Beste ${aanhef},`,
    '',
    `Factuur ${f.nummer}${f.onderwerp ? ` voor ${f.onderwerp}` : ''} van ` +
      `${euro(Number(f.totaal_incl))} stond open tot ${verviel} en is nog niet betaald. ` +
      'Mogelijk is hij blijven liggen; de factuur zit nog een keer in de bijlage.',
    '',
    'Is er iets niet duidelijk, bel of mail gerust.',
    '',
    'Vriendelijke groet,',
    "Sander Boskma – Boskma Foodservice / Snackerie 't Zonnetje",
  ].join('\n')
}

/* --------------------------------------------- wat het gaat worden --- */

/* Een concept heeft nog geen nummer en geen vervaldatum: die worden pas bij
   het versturen uitgedeeld. Maar in het voorbeeld van de mail moet wél staan
   wat de klant straks leest — anders stuur je "betalen vóór de vervaldatum"
   de deur uit. Allebei zijn ze van tevoren te weten. */

export function useVolgendNummer() {
  return useQuery({
    queryKey: ['factuur-volgend-nummer'],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('instellingen')
        .select('waarde')
        .eq('sleutel', 'factuur_volgend_nummer')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const n = Number((data as { waarde?: { nummer?: number } } | null)?.waarde?.nummer)
      return Number.isInteger(n) ? n : null
    },
  })
}

/** De vervaldatum die de factuur krijgt: vandaag plus de termijn van de klant. */
export function verwachteVervaldatum(betaaltermijn: number, vandaag = new Date()): string {
  const d = new Date(vandaag)
  d.setDate(d.getDate() + betaaltermijn)
  return d.toLocaleDateString('sv-SE')
}
