/* De koppeling met eitje aansturen vanuit de app.
 *
 * Het echte werk doet de serverfunctie `eitje-uren`; dit is alleen de
 * afstandsbediening. Drie stappen, in deze volgorde, en die volgorde doet
 * ertoe:
 *
 *   1. kijken  — wie staat er in eitje, en wie daarvan kennen we hier
 *   2. proef   — passen de nummers van de API op die uit de Excel
 *   3. ophalen — pas ná een geslaagde proef
 *
 * Stap 2 bestaat omdat urenregels bewaard worden onder het nummer dat eitje
 * eraan geeft. Zijn dat andere nummers dan die uit de Excel, dan komt elke
 * dienst er een tweede keer in en verdubbelt elk urentotaal — zonder
 * foutmelding, want er is niets kapot. Alleen het gemiddelde is dan twee keer
 * te hoog, en dat gemiddelde gaat mee in een aanbod voor vaste uren.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Openstaand = { naam: string; reden: string }

export type Verkenning = {
  medewerkers_in_eitje: number
  gekoppeld: number
  /** Het oudste medewerker-record in eitje: zo ver kan er terug gehaald worden. */
  oudste_medewerker_vanaf: string | null
  niet_gekoppeld: Openstaand[]
}

export type Proefuitslag = {
  veilig: boolean
  uitkomst: string
  uitleg?: string
  week?: { van: string; tot: string }
  uit_eitje?: number
  staat_hier_al?: number
  nummers_die_passen?: number
  niet_gekoppeld?: Openstaand[]
}

export type WieKan = {
  van: string
  tot: string
  verlof_tot: string
  beschikbaarheid: number
  niet_beschikbaar: number
  verlof: number
  ziek: number
  /* Wat eitje niet kent voor onze sleutels. Staat er expres bij: een lege
     lijst omdat niemand ziek is en een lege lijst omdat we het niet mogen
     vragen, zien er op het scherm hetzelfde uit. */
  niet_opgehaald?: string[]
}

export type Ophaalstand = {
  periode: { van: string; tot: string }
  weken: number
  regels: number
  nieuw: number
  bijgewerkt: number
  nummers_vastgelegd: number
  /** De dag waar de volgende ronde begint, of null als alles binnen is. */
  volgende: string | null
  nog_te_gaan: number
  niet_gekoppeld: Openstaand[]
  /** Alleen bij bijwerken: wie er de komende weken kan. */
  wiekan?: WieKan
}

/* Wat de serverfunctie zegt als het misgaat, in plaats van "non-2xx status
   code". Die melding zegt niets, en dit is precies de plek waar een nette
   uitleg uitmaakt: "de sleutels van eitje staan er nog niet" is iets om op te
   lossen, "non-2xx" is iets om naar te staren. */
async function foutTekst(fout: unknown): Promise<string> {
  const antwoord = (fout as { context?: Response } | null)?.context
  if (antwoord && typeof antwoord.json === 'function') {
    try {
      const body = await antwoord.clone().json()
      if (body?.error) return String(body.error)
    } catch {
      // Geen json erin; dan blijft de oorspronkelijke melding over.
    }
  }
  return fout instanceof Error ? fout.message : 'Dit lukte niet.'
}

async function roep<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('eitje-uren', { body })
  if (error) throw new Error(await foutTekst(error))
  if (data && data.ok === false) throw new Error(data.error ?? 'Dit lukte niet.')
  return data as T
}

/** Stap 1: kijken wat er in eitje staat. Schrijft niets. */
export function useEitjeVerkennen() {
  return useMutation({ mutationFn: () => roep<Verkenning>({ modus: 'verken' }) })
}

/* Eenmalig rondkijken: wat staat er in eitje dat wij met de hand bijhouden,
 * en hoe ver terug geeft eitje beschikbaarheid nog?
 *
 * Eigen serverfunctie, los van eitje-uren. Die laatste draait elke nacht en
 * daar ga je niet in rommelen voor een eenmalige vraag.
 *
 * We tonen alleen aantallen op het scherm. In de voorbeeldrijen staan namen
 * van medewerkers; die hoeven niet op een scherm dat in de zaak openstaat. */
export type Rondkijkdeel =
  | { aantal: number; velden: string[]; voorbeeld: unknown[] }
  | { fout: string }

export type Rondkijken = {
  ok: true
  week: string
  uitkomst: Record<string, Rondkijkdeel>
}

export function useEitjeRondkijken() {
  return useMutation({
    mutationFn: async (): Promise<Rondkijken> => {
      const { data, error } = await supabase.functions.invoke('eitje-kijk', { body: {} })
      if (error) throw new Error(await foutTekst(error))
      if (data && data.ok === false) throw new Error(data.error ?? 'Dit lukte niet.')
      return data as Rondkijken
    },
  })
}

/** Stap 2: de proef op de nummering. Schrijft niets. */
export function useEitjeProef() {
  return useMutation({ mutationFn: () => roep<Proefuitslag>({ modus: 'proef' }) })
}

function telOp(stappen: Ophaalstand[]): Ophaalstand | null {
  if (stappen.length === 0) return null
  const eerste = stappen[0]
  const laatste = stappen[stappen.length - 1]
  return {
    periode: { van: eerste.periode.van, tot: laatste.periode.tot },
    weken: stappen.reduce((s, r) => s + r.weken, 0),
    regels: stappen.reduce((s, r) => s + r.regels, 0),
    nieuw: stappen.reduce((s, r) => s + r.nieuw, 0),
    bijgewerkt: stappen.reduce((s, r) => s + r.bijgewerkt, 0),
    nummers_vastgelegd: stappen.reduce((s, r) => s + r.nummers_vastgelegd, 0),
    volgende: laatste.volgende,
    nog_te_gaan: laatste.nog_te_gaan,
    /* Namen die niet gekoppeld konden worden, één keer elk. Dezelfde onbekende
       komt in elke ronde terug. */
    niet_gekoppeld: [
      ...new Map(
        stappen.flatMap((r) => r.niet_gekoppeld).map((o) => [`${o.naam}|${o.reden}`, o]),
      ).values(),
    ],
  }
}

/* Stap 3: de uren ophalen, in ronden.
 *
 * De serverfunctie doet acht weken per keer en vertelt waar hij gebleven is.
 * Dat is geen omslachtigheid maar noodzaak: eitje geeft zeven dagen per
 * aanvraag en vraagt om een seconde pauze ertussen, en een jaar in één keer
 * zou op de tijdslimiet van de serverfunctie stuklopen. Vandaar deze lus, met
 * na elke ronde een bericht naar het scherm — anders staat er ruim een minuut
 * niets te gebeuren.
 */
export function useEitjeTerughalen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      van: string
      tot?: string
      onRonde?: (stand: Ophaalstand) => void
    }) => {
      let van = opdracht.van
      const stappen: Ophaalstand[] = []
      // Een jaar is acht ronden. Honderd is een ruime bovengrens die voorkomt
      // dat een onverwacht antwoord eindeloos door blijft lopen.
      for (let ronde = 0; ronde < 100; ronde++) {
        const stand = await roep<Ophaalstand>({
          modus: 'periode',
          van,
          ...(opdracht.tot ? { tot: opdracht.tot } : {}),
        })
        stappen.push(stand)
        opdracht.onRonde?.(stand)
        if (!stand.volgende || stand.volgende === van) break
        van = stand.volgende
      }
      return telOp(stappen)
    },
    onSuccess: () => {
      /* De uren liggen eronder: het twaalfmaandsgemiddelde en de
         ervaringsteller voor vakkracht rekenen er allebei mee. */
      void qc.invalidateQueries({ queryKey: ['rooster-imports'] })
      void qc.invalidateQueries({ queryKey: ['gemiddelde-uren'] })
      void qc.invalidateQueries({ queryKey: ['ervaringsuren'] })
      void qc.invalidateQueries({ queryKey: ['rooster'] })
    },
  })
}

/** Bijwerken: wat er de laatste twee dagen in eitje is veranderd. */
export function useEitjeBijwerken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => roep<Ophaalstand>({ modus: 'bij' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooster-imports'] })
      void qc.invalidateQueries({ queryKey: ['gemiddelde-uren'] })
      void qc.invalidateQueries({ queryKey: ['ervaringsuren'] })
      void qc.invalidateQueries({ queryKey: ['rooster'] })
    },
  })
}

/** De redenen waarom een naam niet koppelde, in gewone taal. */
export const REDENTEKST: Record<string, string> = {
  onbekend: 'komt hier niet voor',
  meerdere: 'meer dan één mogelijkheid',
  genegeerd: 'op genegeerd gezet',
  open: 'geen naam',
  voornaam: 'alleen op voornaam — niet vastgelegd',
}

export function redenTekst(reden: string): string {
  return REDENTEKST[reden] ?? reden
}
