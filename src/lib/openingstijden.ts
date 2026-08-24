import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Wanneer de zaak open is. Zie docs/Modules/openingstijden.md.

   Dit is geen instelling die ergens in een hoekje staat: de hele app hangt
   eraan. Een gesloten dag hoort geen temperatuurronde te verwachten, hoort niet
   rood te kleuren in de weekafsluiting, en hoort geen gat te zijn in een
   uitdraai voor een controle — een dichte deur is geen verzuim.

   Dagnummers volgen ISO: 1 = maandag, 7 = zondag. */

export type Openingsdag = {
  dag: number
  open: boolean
  van: string | null
  tot: string | null
}

export type AfwijkendeDag = {
  datum: string
  open: boolean
  van: string | null
  tot: string | null
  reden: string | null
}

export type Rooster = {
  week: Openingsdag[]
  afwijkingen: AfwijkendeDag[]
}

export const DAGNAMEN: { dag: number; naam: string; kort: string }[] = [
  { dag: 1, naam: 'Maandag', kort: 'ma' },
  { dag: 2, naam: 'Dinsdag', kort: 'di' },
  { dag: 3, naam: 'Woensdag', kort: 'wo' },
  { dag: 4, naam: 'Donderdag', kort: 'do' },
  { dag: 5, naam: 'Vrijdag', kort: 'vr' },
  { dag: 6, naam: 'Zaterdag', kort: 'za' },
  { dag: 7, naam: 'Zondag', kort: 'zo' },
]

/** Hoeveel eerder dan sluitingstijd de sluitingsronde aan de beurt is. Om acht
 *  uur gaat de deur dicht en begint het schoonmaken; het laatste uur ervoor is
 *  het moment om langs de koelingen te gaan. */
export const RONDE_VOOR_SLUITEN_UREN = 1

export function isoDag(datum: string) {
  const d = new Date(datum + 'T12:00:00')
  return d.getDay() === 0 ? 7 : d.getDay()
}

export function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE')
}

export type DagStand = { open: boolean; van: string | null; tot: string | null; reden: string | null }

/** Wat geldt er op deze datum? Een afwijkende dag wint van het weekrooster. */
export function standVanDeDag(rooster: Rooster | undefined, datum: string): DagStand {
  // Zonder rooster doen we alsof er gewerkt wordt. Een dag ten onrechte
  // meetellen valt op; een dag ten onrechte overslaan verdwijnt stil uit je
  // dossier, en dat is erger.
  if (!rooster) return { open: true, van: null, tot: null, reden: null }

  const afwijking = rooster.afwijkingen.find((a) => a.datum === datum)
  if (afwijking) {
    return { open: afwijking.open, van: afwijking.van, tot: afwijking.tot, reden: afwijking.reden }
  }
  const dag = rooster.week.find((d) => d.dag === isoDag(datum))
  if (!dag) return { open: true, van: null, tot: null, reden: null }
  return { open: dag.open, van: dag.van, tot: dag.tot, reden: null }
}

export function isOpen(rooster: Rooster | undefined, datum: string) {
  return standVanDeDag(rooster, datum).open
}

/** Vanaf welk uur de sluitingsronde aan de beurt is. */
export function sluitingsrondeVanaf(rooster: Rooster | undefined, datum: string): number {
  const tot = standVanDeDag(rooster, datum).tot
  if (!tot) return 19
  const uur = Number(tot.slice(0, 2))
  return Number.isNaN(uur) ? 19 : uur - RONDE_VOOR_SLUITEN_UREN
}

/** De eerstvolgende dag dat er weer gewerkt wordt. Op zondagavond is dat
 *  dinsdag, niet "morgen" — en dat is precies waar het anders misgaat. */
export function volgendeOpendag(rooster: Rooster | undefined, vanaf: string): string {
  const d = new Date(vanaf + 'T12:00:00')
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1)
    const datum = d.toLocaleDateString('sv-SE')
    if (isOpen(rooster, datum)) return datum
  }
  // Veertien dagen dicht bestaat niet; dan is er iets mis met het rooster en
  // nemen we gewoon morgen.
  const morgen = new Date(vanaf + 'T12:00:00')
  morgen.setDate(morgen.getDate() + 1)
  return morgen.toLocaleDateString('sv-SE')
}

export function useRooster() {
  return useQuery({
    queryKey: ['rooster'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Rooster> => {
      const vanaf = new Date()
      vanaf.setMonth(vanaf.getMonth() - 6)
      const [week, afwijkingen] = await Promise.all([
        supabase.from('openingsdagen').select('dag,open,van,tot').order('dag'),
        supabase
          .from('afwijkende_dagen')
          .select('datum,open,van,tot,reden')
          .gte('datum', vanaf.toLocaleDateString('sv-SE'))
          .order('datum'),
      ])
      if (week.error) throw new Error(week.error.message)
      if (afwijkingen.error) throw new Error(afwijkingen.error.message)
      return {
        week: (week.data ?? []) as unknown as Openingsdag[],
        afwijkingen: (afwijkingen.data ?? []) as unknown as AfwijkendeDag[],
      }
    },
  })
}

export function useOpeningsdagZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (d: Openingsdag) => {
      const { error } = await supabase
        .from('openingsdagen')
        .update({ open: d.open, van: d.open ? d.van : null, tot: d.open ? d.tot : null })
        .eq('dag', d.dag)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['rooster'] }),
  })
}

export function useAfwijkendeDagZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (a: AfwijkendeDag) => {
      const { error } = await supabase.from('afwijkende_dagen').upsert(
        {
          datum: a.datum,
          open: a.open,
          van: a.open ? a.van : null,
          tot: a.open ? a.tot : null,
          reden: a.reden?.trim() || null,
        },
        { onConflict: 'datum' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['rooster'] }),
  })
}

export function useAfwijkendeDagWeg() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (datum: string) => {
      const { error } = await supabase.from('afwijkende_dagen').delete().eq('datum', datum)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['rooster'] }),
  })
}
