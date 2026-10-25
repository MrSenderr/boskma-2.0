/* Het gemiddelde aantal uren over twaalf maanden.
 *
 * Waar dit voor dient: na twaalf maanden op een oproepovereenkomst moet er een
 * aanbod komen voor vaste uren, en dat aanbod moet minstens gelijk zijn aan
 * het gemiddelde van de voorafgaande twaalf maanden (art. 7:628a lid 5 BW).
 * Bied je te weinig, dan kan de medewerker het verschil alsnog opeisen — en
 * die vordering verjaart pas na vijf jaar.
 *
 * Twee dingen bepalen daarom hoe dit rekent.
 *
 * **Verloonde uren, niet alleen gewerkte.** De wet spreekt van verloonde uren.
 * Betaald verlof hoort daar dus bij; die uren zijn uitbetaald. Eitje levert ze
 * apart aan onder `soort`, dus ze zijn te onderscheiden.
 *
 * **Geen antwoord als de gegevens het niet dragen.** Een gemiddelde over drie
 * weken is geen gemiddelde over twaalf maanden. Ontbreken er weken, dan geeft
 * deze module geen getal maar laat hij zien wat er mist. Een verzonnen
 * gemiddelde zou hier rechtstreeks in een aanbod belanden dat juridisch
 * bindend is.
 *
 * Welke weken er zijn ingelezen staat niet in de urenregels zelf — een week
 * zonder regels kan betekenen dat er niet gewerkt is, of dat de week nooit is
 * geïmporteerd. Dat verschil komt uit het importlogboek (`rooster_imports`),
 * waar per import de periode staat.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { dagenTussen, plusMaanden, vandaagIso } from './datums'

export type Urenregel = {
  datum: string
  minuten: number
  soort: string | null
}

export type Periode = { van: string; tot: string }

/* Welke soorten uit Eitje als verloond tellen. Alles wat uitbetaald is telt
   mee; onbetaald verlof niet. Komt er een soort voorbij die hier niet staat,
   dan telt hij níet mee en wordt hij apart gemeld — liever een vraag dan een
   stil verkeerd getal. */
export const VERLOOND = ['gewerkte uren', 'verlof', 'bijzonder verlof']

export function telMee(soort: string | null): boolean {
  return VERLOOND.includes((soort ?? '').trim().toLowerCase())
}

/** De twaalf maanden vóór deze dag. */
export function twaalfMaandenVoor(datum = vandaagIso()): Periode {
  return { van: plusMaanden(datum, -12), tot: datum }
}

/* --------------------------------------------------------------- dekking --- */

/** Periodes samenvoegen die elkaar overlappen of aansluiten. */
export function voegSamen(periodes: Periode[]): Periode[] {
  const op = [...periodes].filter((p) => p.van <= p.tot).sort((a, b) => a.van.localeCompare(b.van))
  const uit: Periode[] = []
  for (const p of op) {
    const laatste = uit[uit.length - 1]
    // Aansluitend telt als één: 5-11 oktober en 12-18 oktober is twee weken
    // zonder gat ertussen.
    if (laatste && dagenTussen(laatste.tot, p.van) <= 1) {
      if (p.tot > laatste.tot) laatste.tot = p.tot
    } else {
      uit.push({ ...p })
    }
  }
  return uit
}

export type Dekking = {
  /** Wat er binnen het venster is ingelezen, samengevoegd. */
  gedekt: Periode[]
  /** Wat er binnen het venster ontbreekt. */
  gaten: Periode[]
  dagenGedekt: number
  dagenTotaal: number
  volledig: boolean
}

export function dekkingVan(periodes: Periode[], venster: Periode): Dekking {
  const binnen = voegSamen(
    periodes
      .map((p) => ({
        van: p.van < venster.van ? venster.van : p.van,
        tot: p.tot > venster.tot ? venster.tot : p.tot,
      }))
      .filter((p) => p.van <= p.tot && p.tot >= venster.van && p.van <= venster.tot),
  )

  const gaten: Periode[] = []
  let cursor = venster.van
  for (const p of binnen) {
    if (p.van > cursor) gaten.push({ van: cursor, tot: vorigeDag(p.van) })
    if (p.tot >= cursor) cursor = volgendeDag(p.tot)
  }
  if (cursor <= venster.tot) gaten.push({ van: cursor, tot: venster.tot })

  const dagenGedekt = binnen.reduce((som, p) => som + dagenTussen(p.van, p.tot) + 1, 0)
  const dagenTotaal = dagenTussen(venster.van, venster.tot) + 1

  return { gedekt: binnen, gaten, dagenGedekt, dagenTotaal, volledig: gaten.length === 0 }
}

function schuif(datum: string, dagen: number): string {
  const d = new Date(`${datum}T12:00:00`)
  d.setDate(d.getDate() + dagen)
  return d.toLocaleDateString('sv-SE')
}
const vorigeDag = (d: string) => schuif(d, -1)
const volgendeDag = (d: string) => schuif(d, 1)

/* ------------------------------------------------------------ gemiddelde --- */

export type Gemiddelde = {
  /** Null als de gegevens het niet dragen; kijk dan naar `dekking`. */
  urenPerWeek: number | null
  urenPerMaand: number | null
  /** Wat er in de ingelezen weken daadwerkelijk is verloond. */
  totaalUren: number
  /** Uren die buiten de meetelling vielen, met hun soort. */
  nietMeegeteld: { soort: string; uren: number }[]
  venster: Periode
  dekking: Dekking
}

const rond = (n: number) => Math.round(n * 100) / 100

export function gemiddeldeUren(opdracht: {
  regels: Urenregel[]
  /** De periodes die daadwerkelijk zijn ingelezen. */
  periodes: Periode[]
  venster?: Periode
}): Gemiddelde {
  const venster = opdracht.venster ?? twaalfMaandenVoor()
  const dekking = dekkingVan(opdracht.periodes, venster)

  const binnen = opdracht.regels.filter((r) => r.datum >= venster.van && r.datum <= venster.tot)
  const totaalMinuten = binnen.filter((r) => telMee(r.soort)).reduce((s, r) => s + (r.minuten || 0), 0)

  const buiten = new Map<string, number>()
  for (const r of binnen) {
    if (telMee(r.soort)) continue
    const soort = (r.soort ?? 'onbekend').trim() || 'onbekend'
    buiten.set(soort, (buiten.get(soort) ?? 0) + (r.minuten || 0))
  }

  const totaalUren = rond(totaalMinuten / 60)
  const weken = dekking.dagenTotaal / 7
  const maanden = dekking.dagenTotaal / 30.44

  return {
    // Alleen een getal als het hele venster is ingelezen. Anders zou een
    // ontbrekende maand als een maand zonder werk tellen.
    urenPerWeek: dekking.volledig ? rond(totaalUren / weken) : null,
    urenPerMaand: dekking.volledig ? rond(totaalUren / maanden) : null,
    totaalUren,
    nietMeegeteld: [...buiten].map(([soort, min]) => ({ soort, uren: rond(min / 60) })),
    venster,
    dekking,
  }
}

/* --------------------------------------------------------------- ophalen --- */

export function useGemiddeldeUren(medewerkerId: string | null | undefined, tot?: string) {
  return useQuery({
    queryKey: ['gemiddelde-uren', medewerkerId, tot ?? null],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Gemiddelde> => {
      const venster = twaalfMaandenVoor(tot)

      const { data: regels, error } = await supabase
        .from('gewerkte_uren')
        .select('datum,minuten,soort')
        .eq('medewerker_id', medewerkerId as string)
        .gte('datum', venster.van)
        .lte('datum', venster.tot)
      if (error) throw new Error(error.message)

      /* Welke weken zijn ingelezen. Per persoon is dat hetzelfde: de export
         gaat over iedereen tegelijk. */
      const { data: imports, error: fout } = await supabase
        .from('rooster_imports')
        .select('periode_van,periode_tot')
        .eq('soort', 'gewerkt')
        .not('periode_van', 'is', null)
      if (fout) throw new Error(fout.message)

      return gemiddeldeUren({
        regels: (regels ?? []) as unknown as Urenregel[],
        periodes: (imports ?? []).map((i) => ({
          van: String(i.periode_van),
          tot: String(i.periode_tot ?? i.periode_van),
        })),
        venster,
      })
    },
  })
}
