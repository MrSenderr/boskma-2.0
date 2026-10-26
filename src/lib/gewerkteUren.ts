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

/* Maanden waarin érgens in de zaak uren zijn verloond, als 'JJJJ-MM'.
 *
 * Waarom dit nodig is: de uitdraai van Eitje draagt een etiket met een periode,
 * en dat etiket klopt niet altijd. De uitdraai van 25 oktober 2026 was gelabeld
 * als heel 2026 terwijl er alleen uren vanaf juli in zaten. Zou de app dat
 * etiket geloven, dan tellen januari tot en met juni als maanden zonder werk,
 * en komt er een gemiddelde uit dat veel te laag is — precies het getal dat
 * vijf jaar lang opeisbaar blijft.
 *
 * Dat één medewerker een maand niet werkt is normaal; dat de héle zaak een
 * maand stilligt niet. Staat er van niemand iets in een maand, dan is dat een
 * gat in de uitdraai. */
export function maandenVan(regels: { datum: string }[]): Set<string> {
  return new Set(regels.map((r) => r.datum.slice(0, 7)))
}

/* Een ingelezen periode terugbrengen tot de maanden waarin werkelijk uren
   staan. Wat de uitdraai claimt maar niet bevat, geldt als niet ingelezen. */
export function beperkTotMaanden(periodes: Periode[], maanden: Set<string>): Periode[] {
  const uit: Periode[] = []
  for (const p of periodes) {
    let maand = p.van.slice(0, 7)
    while (maand <= p.tot.slice(0, 7)) {
      if (maanden.has(maand)) {
        const eersteVanDeMaand = `${maand}-01`
        const laatsteVanDeMaand = laatsteDagVan(maand)
        uit.push({
          van: p.van > eersteVanDeMaand ? p.van : eersteVanDeMaand,
          tot: p.tot < laatsteVanDeMaand ? p.tot : laatsteVanDeMaand,
        })
      }
      maand = volgendeMaand(maand)
    }
  }
  return voegSamen(uit)
}

function volgendeMaand(maand: string): string {
  const [jaar, nr] = maand.split('-').map(Number)
  return nr === 12 ? `${jaar + 1}-01` : `${jaar}-${String(nr + 1).padStart(2, '0')}`
}

function laatsteDagVan(maand: string): string {
  const [jaar, nr] = maand.split('-').map(Number)
  // Dag 0 van de volgende maand is de laatste dag van deze.
  return new Date(Date.UTC(jaar, nr, 0)).toISOString().slice(0, 10)
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
  /* Het gemiddelde over de maanden die zijn ingelezen. Null als er niets is
     ingelezen; kijk naar `volledig` of dat de volle twaalf maanden zijn. */
  urenPerWeek: number | null
  urenPerMaand: number | null
  /** Berust dit op de hele twaalf maanden? */
  volledig: boolean
  /** Hoeveel maanden het gemiddelde beslaat, afgerond op één cijfer. */
  maandenGedekt: number
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
  /* Delen door wat er ís ingelezen, niet door twaalf maanden. Anders telt een
     ontbrekende maand als een maand zonder werk en komt het gemiddelde te laag
     uit. Of het genoeg is om een aanbod op te baseren zegt `volledig`, niet
     dit getal. */
  const weken = dekking.dagenGedekt / 7
  const maanden = dekking.dagenGedekt / 30.44

  return {
    urenPerWeek: dekking.dagenGedekt > 0 ? rond(totaalUren / weken) : null,
    urenPerMaand: dekking.dagenGedekt > 0 ? rond(totaalUren / maanden) : null,
    volledig: dekking.volledig,
    maandenGedekt: Math.round(maanden * 10) / 10,
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

      /* In welke maanden er érgens in de zaak uren staan. Het etiket van een
         uitdraai klopt niet altijd — die van 25 oktober 2026 claimde heel 2026
         terwijl er alleen uren vanaf juli in zaten — en wat geclaimd maar niet
         geleverd is mag niet als "nul uur gewerkt" meetellen. */
      const { data: maanden, error: mfout } = await supabase.rpc('maanden_met_uren')
      if (mfout) throw new Error(mfout.message)

      const geclaimd = (imports ?? []).map((i) => ({
        van: String(i.periode_van),
        tot: String(i.periode_tot ?? i.periode_van),
      }))
      const echt = new Set(
        ((maanden ?? []) as { maand: string }[] | string[]).map((m) =>
          typeof m === 'string' ? m : m.maand,
        ),
      )

      return gemiddeldeUren({
        regels: (regels ?? []) as unknown as Urenregel[],
        periodes: beperkTotMaanden(geclaimd, echt),
        venster,
      })
    },
  })
}

/* ----------------------------------------------------- waarop het berust --- */

const MAANDNAAM = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

const maandTekst = (maand: string, metJaar = true) => {
  const [jaar, nr] = maand.split('-')
  return metJaar ? `${MAANDNAAM[Number(nr) - 1]} ${jaar}` : MAANDNAAM[Number(nr) - 1]
}

/* De ingelezen periode in gewone taal: "juli t/m oktober 2026".
 *
 * Dit komt in de brief aan de medewerker en op het blad voor het loonbureau te
 * staan. "Het gemiddelde over de afgelopen twaalf maanden" opschrijven terwijl
 * het over vier maanden gaat, is een onwaarheid in een stuk dat later bewijs
 * kan worden. */
export function periodeTekst(g: Gemiddelde): string | null {
  if (g.dekking.gedekt.length === 0) return null
  const eerste = g.dekking.gedekt[0].van.slice(0, 7)
  const laatste = g.dekking.gedekt[g.dekking.gedekt.length - 1].tot.slice(0, 7)
  const reeks =
    eerste === laatste
      ? maandTekst(eerste)
      : eerste.slice(0, 4) === laatste.slice(0, 4)
        ? `${maandTekst(eerste, false)} t/m ${maandTekst(laatste)}`
        : `${maandTekst(eerste)} t/m ${maandTekst(laatste)}`

  // Alleen "twaalf maanden" opschrijven als het er ook twaalf zijn.
  if (g.volledig) return `de twaalf maanden tot ${maandTekst(laatste)}`
  /* Zit er een gat middenin, dan is "juli t/m oktober" te mooi gezegd: dan
     ontbreekt er een maand tussenin en hoort dat erbij te staan. */
  return g.dekking.gedekt.length > 1 ? `${reeks} (met onderbrekingen)` : reeks
}

/** Het gemiddelde zoals een voorstel het meekrijgt: getal, periode en of het
 *  de volle twaalf maanden beslaat. Die drie horen bij elkaar. */
export type Onderbouwing = {
  uren: number | null
  over: string | null
  volledig: boolean
  maandenGedekt: number
}

export function onderbouwingVan(g: Gemiddelde | undefined | null): Onderbouwing {
  if (!g) return { uren: null, over: null, volledig: false, maandenGedekt: 0 }
  return {
    uren: g.urenPerWeek,
    over: periodeTekst(g),
    volledig: g.volledig,
    maandenGedekt: g.maandenGedekt,
  }
}

/* ------------------------------------------------- ervaring voor vakkracht --- */

/* Hoeveel uur iemand sinds zijn achttiende verjaardag heeft gewerkt.
 *
 * Voor de vraag of iemand vakkracht is: de cao noemt 1.976 uur ervaring in
 * dezelfde functie, opgebouwd ná het achttiende jaar.
 *
 * Dit getal is met opzet géén antwoord op die vraag, alleen een geheugensteun.
 * Het telt wat er bij Boskma is geschreven, en dat begint pas in 2026. Uren
 * bij een vorige werkgever tellen volgens de cao gewoon mee maar staan hier
 * niet in, dus het werkelijke aantal is altijd minstens dit en meestal meer.
 * Daarom staat er in het scherm bij wat eronder valt. */
export function useErvaringsuren(
  medewerkerId: string | null | undefined,
  geboortedatum: string | null | undefined,
) {
  const achttien = geboortedatum ? plusMaanden(geboortedatum.slice(0, 10), 18 * 12) : null
  return useQuery({
    queryKey: ['ervaringsuren', medewerkerId, achttien],
    enabled: Boolean(medewerkerId && achttien),
    queryFn: async (): Promise<{ uren: number; vanaf: string; sinds: string | null }> => {
      const { data, error } = await supabase
        .from('gewerkte_uren')
        .select('datum,minuten,soort')
        .eq('medewerker_id', medewerkerId as string)
        .gte('datum', achttien as string)
      if (error) throw new Error(error.message)

      const regels = (data ?? []) as { datum: string; minuten: number | null; soort: string | null }[]
      const meetellend = regels.filter((r) => telMee(r.soort))
      const minuten = meetellend.reduce((s, r) => s + (r.minuten ?? 0), 0)
      const dagen = meetellend.map((r) => r.datum).sort()
      return {
        uren: Math.round(minuten / 60),
        vanaf: achttien as string,
        sinds: dagen[0] ?? null,
      }
    },
  })
}
