/* Wat er per dag nodig is, en met wie dat vastligt.
 *
 * Twee dingen die de app tot nu toe niet wist. De spitsindeling kende alleen
 * de avond van vrijdag tot en met zondag — zes werkplekken, zeven paar handen.
 * Hoeveel mensen er op een dinsdagmiddag moeten staan en hoe laat die beginnen,
 * zat alleen in Sanders hoofd.
 *
 * **Het sjabloon** is per weekdag een rijtje diensten. Afgeleid uit vijf weken
 * van zijn eigen planning en niet verzonnen: alles eindigt om 20:00, en er zijn
 * maar twee soorten — een dagdienst die tussen 10:00 en 12:00 begint en een
 * avonddienst van 17:00 tot 20:00. De vroegste dagdienst is de voorbereiding,
 * en dat is een eigen rol: niet iedereen kan de mep doen.
 *
 * **Een vaste dienst** is een afspraak: Brian werkt elke woensdag overdag. Dat
 * is iets anders dan de vaste dagen, want daar staat een wéns. Van de drie
 * bronnen die straks een voorstel maken is de afspraak de sterkste: die ligt
 * vast vóórdat er iets te verdelen valt. Daarna komt wat eitje weet over
 * beschikbaarheid, en pas daarna de wens.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Soort = 'voorbereiding' | 'dag' | 'avond'

export const SOORTEN: Soort[] = ['voorbereiding', 'dag', 'avond']

export const SOORTTEKST: Record<Soort, string> = {
  voorbereiding: 'Voorbereiding',
  dag: 'Dagdienst',
  avond: 'Avonddienst',
}

export type Sjabloonregel = {
  id: string
  dag: number
  soort: Soort
  begint: string
  eindigt: string
  aantal: number
  opmerking: string | null
}

export type VasteDienst = {
  id: string
  medewerker_id: string
  dag: number
  soort: Soort
  begint: string
  eindigt: string
  opmerking: string | null
}

/* De dagen waarop de zaak open is, in de volgorde waarin je erover praat.
   Maandag staat er niet bij: dan is de zaak dicht. Gaat dat ooit veranderen,
   dan komt het uit `openingsdagen` en niet uit deze lijst. */
export const DAGEN: { nr: number; naam: string }[] = [
  { nr: 2, naam: 'Dinsdag' },
  { nr: 3, naam: 'Woensdag' },
  { nr: 4, naam: 'Donderdag' },
  { nr: 5, naam: 'Vrijdag' },
  { nr: 6, naam: 'Zaterdag' },
  { nr: 7, naam: 'Zondag' },
]

/** "17:00:00" uit de database wordt "17:00" op het scherm. */
export function klok(tijd: string): string {
  return tijd.slice(0, 5)
}

/* Hoeveel mensen er op een dag staan, en hoeveel daarvan tijdens de spits.
 *
 * Dagdiensten lopen door tot sluitingstijd, dus die staan er om vijf uur
 * gewoon bij. Dat is geen detail: het is precies waarom vrijdag met vier
 * dagdiensten en twee avonddiensten toch op zes paar handen uitkomt, en met
 * Sander erbij op de zeven waar de spitsindeling op rekent. */
export function telDag(regels: Sjabloonregel[], dag: number) {
  const vanDieDag = regels.filter((r) => r.dag === dag)
  const overdag = vanDieDag
    .filter((r) => r.soort !== 'avond')
    .reduce((som, r) => som + r.aantal, 0)
  const avond = vanDieDag.filter((r) => r.soort === 'avond').reduce((som, r) => som + r.aantal, 0)
  return { overdag, avond, samen: overdag + avond, regels: opTijd(vanDieDag) }
}

export function opTijd(regels: Sjabloonregel[]): Sjabloonregel[] {
  return [...regels].sort((a, b) => a.begint.localeCompare(b.begint) || a.soort.localeCompare(b.soort))
}

/* --------------------------------------------------------------- ophalen --- */

export function useSjabloon() {
  return useQuery({
    queryKey: ['weeksjabloon'],
    queryFn: async (): Promise<Sjabloonregel[]> => {
      const { data, error } = await supabase
        .from('weeksjabloon')
        .select('id,dag,soort,begint,eindigt,aantal,opmerking')
        .order('dag')
        .order('begint')
      if (error) throw new Error(error.message)
      return (data ?? []) as Sjabloonregel[]
    },
  })
}

export function useVasteDiensten() {
  return useQuery({
    queryKey: ['vaste-diensten'],
    queryFn: async (): Promise<VasteDienst[]> => {
      const { data, error } = await supabase
        .from('vaste_diensten')
        .select('id,medewerker_id,dag,soort,begint,eindigt,opmerking')
        .order('dag')
        .order('begint')
      if (error) throw new Error(error.message)
      return (data ?? []) as VasteDienst[]
    },
  })
}

/* --------------------------------------------------------------- wijzigen --- */

function verversen(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['weeksjabloon'] })
  void qc.invalidateQueries({ queryKey: ['vaste-diensten'] })
}

export function useRegelWijzigen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (regel: Partial<Sjabloonregel> & { id: string }) => {
      const { id, ...rest } = regel
      const { error } = await supabase
        .from('weeksjabloon')
        .update({ ...rest, bijgewerkt_op: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => verversen(qc),
  })
}

export function useRegelToevoegen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (regel: Omit<Sjabloonregel, 'id' | 'opmerking'>) => {
      const { error } = await supabase.from('weeksjabloon').insert(regel)
      if (error) {
        /* De database weigert twee regels met dezelfde dag, tijd en soort. Dat
           is een vergissing en geen fout van de gebruiker, dus hier een zin die
           zegt wat er aan de hand is. */
        if (error.code === '23505') {
          throw new Error('Die dienst staat er al op die dag en die tijd.')
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => verversen(qc),
  })
}

export function useRegelWeg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weeksjabloon').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => verversen(qc),
  })
}

export function useVasteDienstToevoegen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dienst: Omit<VasteDienst, 'id' | 'opmerking'>) => {
      const { error } = await supabase.from('vaste_diensten').insert(dienst)
      if (error) {
        if (error.code === '23505') {
          throw new Error('Voor deze medewerker staat er op die dag en tijd al een vaste dienst.')
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => verversen(qc),
  })
}

export function useVasteDienstWeg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vaste_diensten').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => verversen(qc),
  })
}

/* ------------------------------------------------------- loopt het rond --- */

/* Past wat je hebt afgesproken op wat je nodig hebt?
 *
 * Een vaste dienst is een afspraak met een mens; het sjabloon is wat de zaak
 * nodig heeft. Die twee worden los van elkaar ingevuld en kunnen dus uit elkaar
 * lopen — en dat merk je anders pas als het voorstel iemand niet kwijt kan, of
 * stilletjes een plek dubbel bezet.
 *
 * Twee soorten meldingen, want het zijn twee verschillende problemen:
 *
 * **Te veel** is een fout. Staan er twee mensen vast op de voorbereiding
 * terwijl je er één nodig hebt, dan moet er iets wijken — een van de twee
 * afspraken, of het sjabloon. Dat kan de app niet voor je kiezen.
 *
 * **Een andere tijd** is een vraag. Begint Daan om 11:00 terwijl de
 * voorbereiding om 10:00 staat ingepland, dan kan dat kloppen (hij begint nu
 * eenmaal later) of een vergissing zijn. Daarom een melding en geen slot.
 */

export type Scheefheid = {
  dag: number
  ernst: 'fout' | 'letop'
  tekst: string
}

export function controleer(
  sjabloon: Sjabloonregel[],
  vast: VasteDienst[],
  naamVan: (medewerkerId: string) => string,
): Scheefheid[] {
  const uit: Scheefheid[] = []

  for (const { nr, naam } of DAGEN) {
    const regels = sjabloon.filter((r) => r.dag === nr)
    const afspraken = vast.filter((v) => v.dag === nr)

    for (const soort of SOORTEN) {
      const plekken = regels
        .filter((r) => r.soort === soort)
        .reduce((som, r) => som + r.aantal, 0)
      const vastgelegd = afspraken.filter((v) => v.soort === soort)
      if (vastgelegd.length === 0) continue

      if (vastgelegd.length > plekken) {
        const wie = vastgelegd.map((v) => naamVan(v.medewerker_id)).join(' en ')
        uit.push({
          dag: nr,
          ernst: 'fout',
          tekst:
            plekken === 0
              ? `${wie} ${vastgelegd.length === 1 ? 'staat' : 'staan'} vast op ${SOORTTEKST[soort].toLowerCase()}, maar die staat ${naam.toLowerCase()} niet in het sjabloon.`
              : `${wie} staan vast op ${SOORTTEKST[soort].toLowerCase()}, maar ${naam.toLowerCase()} is er maar ${plekken === 1 ? 'één' : plekken} van nodig.`,
        })
      }

      /* Begintijden die niet voorkomen in het sjabloon. Eén melding per tijd,
         niet per persoon: drie mensen die allemaal om 11:00 beginnen terwijl er
         10:00 staat, is één vraag en geen drie. */
      const tijden = new Set(regels.filter((r) => r.soort === soort).map((r) => r.begint))
      const afwijkend = [...new Set(vastgelegd.map((v) => v.begint))].filter(
        (t) => !tijden.has(t),
      )
      for (const tijd of afwijkend) {
        const namen = vastgelegd
          .filter((v) => v.begint === tijd)
          .map((v) => naamVan(v.medewerker_id))
        const wie = namen.join(' en ')
        // "Daan en Justin begint" is geen Nederlands.
        const werkwoord = namen.length === 1 ? 'begint' : 'beginnen'
        const verwacht = [...tijden].map(klok).join(' of ')
        uit.push({
          dag: nr,
          ernst: 'letop',
          tekst: verwacht
            ? `${wie} ${werkwoord} ${naam.toLowerCase()} om ${klok(tijd)}, terwijl ${SOORTTEKST[soort].toLowerCase()} in het sjabloon om ${verwacht} begint.`
            : `${wie} ${werkwoord} ${naam.toLowerCase()} om ${klok(tijd)} aan ${SOORTTEKST[soort].toLowerCase()}.`,
        })
      }
    }
  }

  // Fouten eerst: die moet je oplossen, de rest mag je wegwuiven.
  return uit.sort((a, b) => (a.ernst === b.ernst ? a.dag - b.dag : a.ernst === 'fout' ? -1 : 1))
}
