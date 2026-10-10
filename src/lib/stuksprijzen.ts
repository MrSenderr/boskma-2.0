/* Stuksprijzen: wat kost één stuk, één kilo, één liter.

   Op de laatst betaalde prijs, want dat is wat je nu uitgeeft. De
   verpakkingsinhoud staat als tekst op de factuur, dus het omrekenen gebeurt
   hier en niet in de database — zie verpakking.ts.

   De adviesprijs rekent terug vanaf je foodcost-doel. Eén doel voor alles
   deugt niet: een frikandel van 45 cent haalt met gemak 19%, maar een Magnum
   van € 1,91 kun je nooit voor € 6,80 verkopen. Daarom een doel per groep,
   met een algemeen doel als terugval. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { getal } from './inkoop'
import { kostprijzen, type Kostprijzen } from './verpakking'

const inkoop = supabase.schema('inkoop')

export type LaatstePrijs = {
  leverancier_id: number
  leveranciernaam: string
  artikelnr: string
  naam: string | null
  merk: string | null
  inhoud: string | null
  eenheid: string | null
  prijs: string
  factuurdatum: string
  factuurnummer: string
  op_bestellijst: boolean
  groep: string | null
}

export type Artikel = LaatstePrijs & Kostprijzen

export type Doelen = {
  /** Het doel dat geldt als een groep er geen eigen heeft. */
  algemeen: number
  btw: number
  perGroep: Record<string, number>
}

export const STANDAARD: Doelen = { algemeen: 0.28, btw: 0.09, perGroep: {} }

export function doelVan(groep: string | null, doelen: Doelen): number {
  if (groep && doelen.perGroep[groep] !== undefined) return doelen.perGroep[groep]
  return doelen.algemeen
}

/* ------------------------------------------------------- bewerken --- */

export type Verdeeld = {
  /** Artikelen waarvan we de verpakking snappen. */
  bekend: Artikel[]
  /** En die waarvan niet — die staan apart, niet stilletjes weggelaten. */
  onbekend: Artikel[]
}

export function metKostprijzen(rijen: LaatstePrijs[]): Verdeeld {
  const artikelen = rijen
    .map((r) => ({ ...r, ...kostprijzen(getal(r.prijs), r.inhoud) }))
    .sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '', 'nl'))

  return {
    bekend: artikelen.filter((a) => a.verpakking),
    onbekend: artikelen.filter((a) => !a.verpakking),
  }
}

/** Zoeken op naam, merk of artikelnummer. */
export function zoek(artikelen: Artikel[], term: string): Artikel[] {
  const q = term.trim().toLowerCase()
  if (!q) return artikelen
  return artikelen.filter((a) =>
    `${a.naam ?? ''} ${a.merk ?? ''} ${a.artikelnr}`.toLowerCase().includes(q),
  )
}

/* -------------------------------------------------------- ophalen --- */

export function useLaatstePrijzen() {
  return useQuery({
    queryKey: ['inkoop', 'laatsteprijzen'],
    queryFn: async (): Promise<LaatstePrijs[]> => {
      const { data, error } = await inkoop.from('laatste_prijzen').select('*')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as LaatstePrijs[]
    },
  })
}

/** De foodcost-doelen en het btw-tarief, met terugval op wat de oude app ook
 *  gebruikte als er niets is ingesteld. */
export function useDoelen() {
  return useQuery({
    queryKey: ['inkoop', 'doelen'],
    queryFn: async (): Promise<Doelen> => {
      const [instellingen, doelen] = await Promise.all([
        inkoop.from('instellingen').select('sleutel, waarde'),
        inkoop.from('foodcost_doelen').select('groep, doel'),
      ])
      if (instellingen.error) throw new Error(instellingen.error.message)
      if (doelen.error) throw new Error(doelen.error.message)

      const waarde = (sleutel: string) =>
        (instellingen.data ?? []).find((r) => r.sleutel === sleutel)?.waarde

      const alg = Number(waarde('foodcost'))
      const btw = Number(waarde('btw_tarief'))

      return {
        algemeen: Number.isFinite(alg) && alg > 0 ? alg : STANDAARD.algemeen,
        btw: Number.isFinite(btw) && btw >= 0 ? btw : STANDAARD.btw,
        perGroep: Object.fromEntries(
          (doelen.data ?? [])
            .map((r) => [r.groep as string, getal(r.doel as string)])
            .filter(([, d]) => (d as number) > 0),
        ),
      }
    },
  })
}
