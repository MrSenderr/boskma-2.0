/* Prijsmutaties: wat je vorige maand betaalde tegenover wat je nu betaalt.

   De hele lijst draait om één getal: impact, het prijsverschil maal wat je
   ervan afnam. Daarop sorteren we, niet op percentage. Een artikel dat 40%
   duurder wordt maar dat je zelden koopt kost je minder dan frites die een
   dubbeltje stijgen.

   Acties tellen gewoon mee als prijs — dat is wat je betaalde — maar ze staan
   er apart bij. Een afgelopen actie is een stijging die je niet ziet
   aankomen: de leverancier heeft niets verhoogd en toch betaal je meer. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { getal } from './inkoop'

const inkoop = supabase.schema('inkoop')

export type Prijsmutatie = {
  leverancier_id: number
  leveranciernaam: string
  artikelnr: string
  omschrijving: string | null
  merk: string | null
  eerste: string
  laatste: string
  laagste: string
  hoogste: string
  van: string | null
  tot: string | null
  keer_gekocht: number
  laatste_was_actie: boolean
  eerste_was_actie: boolean
  normale_prijs: string | null
  keer_op_actie: number
  totaal_aantal: string
  impact: string
}

export type Meting = {
  id: number
  factuurdatum: string
  factuurnummer: string
  prijs: string
  aantal: string
  bedrag: string
  eenheid: string | null
  artikelnaam: string | null
  merk: string | null
  artikelinhoud: string | null
  artikelnr: string
  op_bestellijst: boolean
  leverancier_id: number
  actie: boolean
}

/* --------------------------------------------------------- rekenen --- */

export function verschil(m: Pick<Prijsmutatie, 'eerste' | 'laatste'>): number {
  return getal(m.laatste) - getal(m.eerste)
}

/** Het percentage is er om te begrijpen, niet om op te sorteren. */
export function procent(m: Pick<Prijsmutatie, 'eerste' | 'laatste'>): number {
  const eerste = getal(m.eerste)
  return eerste === 0 ? 0 : (verschil(m) / eerste) * 100
}

export type Verdeling = {
  omhoog: Prijsmutatie[]
  omlaag: Prijsmutatie[]
  saldo: number
}

/** Duurder en goedkoper apart, allebei met de zwaarste bovenaan. */
export function verdeel(mutaties: Prijsmutatie[]): Verdeling {
  const opImpact = [...mutaties].sort((a, b) => Math.abs(getal(b.impact)) - Math.abs(getal(a.impact)))
  return {
    omhoog: opImpact.filter((m) => getal(m.impact) > 0),
    omlaag: opImpact.filter((m) => getal(m.impact) < 0),
    saldo: mutaties.reduce((s, m) => s + getal(m.impact), 0),
  }
}

/* --------------------------------------------------------- grafiek --- */

/* Een lijntje met een punt per levering. Boven en onder zit marge, anders
   plakt een vlakke lijn tegen de rand en lijkt een cent verschil een
   aardverschuiving. */

export const GRAFIEK = { breedte: 640, hoogte: 150, rand: 26 }

export type Punt = { x: number; y: number; meting: Meting }

export type Grafiek = {
  punten: Punt[]
  lijn: string
  normaalY: number | null
  laagste: number
  hoogste: number
}

export function grafiek(metingen: Meting[], normalePrijs: number | null): Grafiek {
  const { breedte: B, hoogte: H, rand: P } = GRAFIEK
  const prijzen = metingen.map((m) => getal(m.prijs))
  const laagste = prijzen.length ? Math.min(...prijzen) : 0
  const hoogste = prijzen.length ? Math.max(...prijzen) : 0

  const laag = laagste * 0.96
  const hoog = hoogste * 1.04 || 1
  const bereik = hoog - laag || 1

  const x = (i: number) => P + (i * (B - 2 * P)) / Math.max(1, metingen.length - 1)
  const y = (p: number) => H - P - ((p - laag) / bereik) * (H - 2 * P)

  const punten = metingen.map((meting, i) => ({ x: x(i), y: y(getal(meting.prijs)), meting }))

  return {
    punten,
    lijn: punten.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    normaalY: normalePrijs === null ? null : y(normalePrijs),
    laagste,
    hoogste,
  }
}

/* De gewone prijs is het ijkpunt: daar springt hij naartoe als de actie
   afloopt. Zonder metingen buiten een actie weten we die niet, en dan is elke
   uitspraak erover een gok. */
export function normalePrijs(metingen: Meting[]): number | null {
  const gewoon = metingen.filter((m) => !m.actie).map((m) => getal(m.prijs))
  return gewoon.length ? gewoon.reduce((a, b) => a + b, 0) / gewoon.length : null
}

/* --------------------------------------------------------- ophalen --- */

export function usePrijsmutaties() {
  return useQuery({
    queryKey: ['inkoop', 'prijsmutaties'],
    queryFn: async (): Promise<Prijsmutatie[]> => {
      const { data, error } = await inkoop.from('prijsmutaties').select('*')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Prijsmutatie[]
    },
  })
}

export function usePrijsverloop(leverancierId: number, artikelnr: string) {
  return useQuery({
    queryKey: ['inkoop', 'prijsverloop', leverancierId, artikelnr],
    enabled: Number.isFinite(leverancierId) && artikelnr.length > 0,
    queryFn: async (): Promise<Meting[]> => {
      const { data, error } = await inkoop
        .from('factuurregels')
        .select(
          'id, factuurdatum, factuurnummer, prijs, aantal, bedrag, eenheid, artikelnaam, merk, artikelinhoud, artikelnr, op_bestellijst, leverancier_id, actie',
        )
        .eq('artikelnr_norm', artikelnr)
        .eq('leverancier_id', leverancierId)
        .eq('soort', 'Levering')
        .not('prijs', 'is', null)
        .order('factuurdatum')
        .order('id')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Meting[]
    },
  })
}
