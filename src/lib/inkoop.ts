/* Inkoopadministratie: de facturen van de groothandel.

   Deze gegevens stonden in een losse applicatie met een eigen voordeur. Ze
   staan nu in dezelfde database, in een eigen schema `inkoop`, zodat er maar
   één waarheid is.

   Let op bij bedragen: de database geeft ze als tekst terug, niet als getal.
   Dat is expres — zo kan er onderweg geen cent verdwijnen in een afronding —
   maar het betekent dat je er niet zomaar mee kunt rekenen. Daar is `getal`
   voor. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

const inkoop = supabase.schema('inkoop')

export type Status = 'nieuw' | 'verwerkt' | 'controleren' | 'afgekeurd'

export type Factuuroverzicht = {
  id: number
  leverancier_id: number
  leveranciernaam: string
  nummer: string
  datum: string | null
  referentie: string | null
  som_regels: string | null
  btw: string | null
  totaal_incl: string | null
  verschil: string | null
  status: Status
  melding: string | null
  opslagpad: string | null
  bestandsnaam: string | null
  ontvangen: string
  regels: number
  emballage: number
}

export type Regelsoort = 'Levering' | 'Emballage' | 'Retour/credit' | 'Gratis'

export type Documentregel = {
  id: number
  document_id: number
  regelnr: number | null
  afleverdatum: string | null
  leveringsnr: string | null
  referentie: string | null
  artikelnr: string
  omschrijving: string | null
  merk: string | null
  inhoud: string | null
  aantal: string
  eenheid: string | null
  prijs: string | null
  bedrag: string
  btw_pct: number | null
  soort: Regelsoort
  artikelnr_norm: string
  artikelnaam: string | null
  op_bestellijst: boolean
}

/* ----------------------------------------------------------- weergave --- */

/** Wat uit de database komt is tekst; hier wordt het pas een getal. */
export function getal(waarde: string | number | null | undefined): number {
  if (waarde === null || waarde === undefined || waarde === '') return 0
  const n = Number(waarde)
  return Number.isFinite(n) ? n : 0
}

const nl = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

export function euro(waarde: string | number | null | undefined): string {
  return nl.format(getal(waarde))
}

/* Bij kleine bedragen zegt twee cijfers achter de komma niets: een saus van
   € 0,0044 per ml staat er dan als € 0,00 bij. Onder een euro dus drie
   cijfers — het verschil tussen 4 en 5 tienden van een cent is bij duizend
   milliliter een halve euro. */
export function fijnEuro(waarde: string | number | null | undefined): string {
  const n = getal(waarde)
  if (n === 0 || Math.abs(n) >= 1) return euro(n)
  return `€ ${n.toLocaleString('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}

/* "1 portie" maar "2 porties". Alleen de eenheden waar het misgaat; gram,
   kilo, ml en liter blijven in het Nederlands hetzelfde. */
const MEERVOUD: Record<string, string> = {
  portie: 'porties',
  stuk: 'stuks',
  verpakking: 'verpakkingen',
}

export function eenheidTekst(aantal: number, eenheid: string): string {
  return aantal === 1 ? eenheid : (MEERVOUD[eenheid] ?? eenheid)
}

/** Aantallen staan met drie cijfers achter de komma in de database, maar 22,000
 *  dozen leest niet. Alleen tonen wat betekenis heeft. */
export function aantalTekst(waarde: string | number | null | undefined): string {
  const n = getal(waarde)
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 3 })
}

/** "vr 9 okt" — kort, met de dag erbij, want bij leveringen gaat het om de dag
 *  van de week: dinsdag en donderdag wordt bezorgd, de rest haal je zelf op. */
export function dagEnDatum(datum: string | null | undefined): string {
  if (!datum) return '—'
  const d = new Date(`${datum.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function volledigeDatum(datum: string | null | undefined): string {
  if (!datum) return ''
  const d = new Date(`${datum.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Een factuur die zijn eigen controlesom niet haalt, telt nergens in mee. */
export function klopt(f: Pick<Factuuroverzicht, 'status' | 'verschil'>): boolean {
  return f.status === 'verwerkt' && Math.abs(getal(f.verschil)) < 0.005
}

/* ------------------------------------------------------- leveringen --- */

export type Blok = {
  sleutel: string
  afleverdatum: string | null
  leveringsnr: string | null
  referentie: string | null
  regels: Documentregel[]
  bedrag: number
}

/* Een factuur is opgebouwd uit leveringsblokken: per afleverdatum een blok met
   een eigen leveringsnummer. Eén factuur kan leveringen van weken eerder
   bevatten, dus op datum sorteren zou de factuur hertekenen; de volgorde van
   de regels is de volgorde zoals hij gedrukt staat. Emballage bovenaan hoort
   bij geen enkele levering en krijgt een blok zonder datum. */
export function inBlokken(regels: Documentregel[]): Blok[] {
  const blokken: Blok[] = []
  for (const r of regels) {
    const sleutel = `${r.afleverdatum ?? ''}|${r.leveringsnr ?? ''}`
    let blok = blokken.find((b) => b.sleutel === sleutel)
    if (!blok) {
      blok = {
        sleutel,
        afleverdatum: r.afleverdatum,
        leveringsnr: r.leveringsnr,
        referentie: r.referentie,
        regels: [],
        bedrag: 0,
      }
      blokken.push(blok)
    }
    blok.regels.push(r)
    blok.bedrag += getal(r.bedrag)
  }
  return blokken
}

/* --------------------------------------------------------- uploaden --- */

export type Uploadstatus = 'nieuw' | 'bezig' | 'klaar' | 'mislukt' | 'duplicaat'

export type Upload = {
  id: number
  bestandsnaam: string
  status: Uploadstatus
  melding: string | null
  document_id: number | null
  aangemaakt_op: string
  verwerkt_op: string | null
}

export type Leverancier = { id: number; naam: string; profiel: string }

/* De hash van de inhoud. Dezelfde pdf levert dezelfde hash op, dus hiermee
   weten we vóór het uitlezen of we hem al hebben — en uitlezen kost geld. */
export async function hashVan(bestand: File): Promise<string> {
  const buffer = await bestand.arrayBuffer()
  const ruw = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(ruw)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function useLeveranciers() {
  return useQuery({
    queryKey: ['inkoop', 'leveranciers'],
    queryFn: async (): Promise<Leverancier[]> => {
      const { data, error } = await inkoop
        .from('leveranciers')
        .select('id, naam, profiel')
        .eq('actief', true)
        .order('naam')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Leverancier[]
    },
  })
}

/* Terwijl er iets wordt uitgelezen kijkt het scherm elke drie seconden of het
   al klaar is. Dat duurt bij Veldboer ongeveer twee minuten. */
export function useUploads() {
  return useQuery({
    queryKey: ['inkoop', 'uploads'],
    refetchInterval: (vraag) => {
      const rijen = (vraag.state.data ?? []) as Upload[]
      return rijen.some((u) => u.status === 'nieuw' || u.status === 'bezig') ? 3000 : false
    },
    queryFn: async (): Promise<Upload[]> => {
      const { data, error } = await inkoop
        .from('uploads')
        .select('id, bestandsnaam, status, melding, document_id, aangemaakt_op, verwerkt_op')
        .order('aangemaakt_op', { ascending: false })
        .limit(10)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Upload[]
    },
  })
}

/* ------------------------------------------------------------- pdf --- */

/* De originele pdf staat in een prive-bucket, dus er is een ondertekende link
   nodig. Een uur geldig: lang genoeg om hem rustig te bekijken, kort genoeg
   dat een gekopieerde link morgen niets meer doet. */
export function usePdfLink(opslagpad: string | null | undefined) {
  return useQuery({
    queryKey: ['inkoop', 'pdf', opslagpad],
    enabled: Boolean(opslagpad),
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('inkoopdocumenten')
        .createSignedUrl(opslagpad as string, 3600)
      if (error) throw new Error(error.message)
      return data.signedUrl
    },
  })
}

/* --------------------------------------------------------- ophalen --- */

export function useInkoopFacturen() {
  return useQuery({
    queryKey: ['inkoop', 'facturen'],
    queryFn: async (): Promise<Factuuroverzicht[]> => {
      const { data, error } = await inkoop
        .from('factuuroverzicht')
        .select('*')
        .order('datum', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Factuuroverzicht[]
    },
  })
}

export function useInkoopFactuur(leverancierId: number, nummer: string) {
  return useQuery({
    queryKey: ['inkoop', 'factuur', leverancierId, nummer],
    enabled: Number.isFinite(leverancierId) && nummer.length > 0,
    queryFn: async (): Promise<{ kop: Factuuroverzicht; regels: Documentregel[] } | null> => {
      const { data: kop, error: fout } = await inkoop
        .from('factuuroverzicht')
        .select('*')
        .eq('leverancier_id', leverancierId)
        .eq('nummer', nummer)
        .maybeSingle()
      if (fout) throw new Error(fout.message)
      if (!kop) return null

      const { data: regels, error: regelfout } = await inkoop
        .from('documentregels')
        .select('*')
        .eq('document_id', (kop as unknown as Factuuroverzicht).id)
        .order('regelnr')
      if (regelfout) throw new Error(regelfout.message)

      return {
        kop: kop as unknown as Factuuroverzicht,
        regels: (regels ?? []) as unknown as Documentregel[],
      }
    },
  })
}
