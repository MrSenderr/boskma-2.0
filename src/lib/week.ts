import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Apparaat } from './apparaten'
import type { Meting } from './metingen'
import type { Levering } from './leveringen'
import type { Doorschuif } from './frituurvet'
import { RONDES, apparatenVoor } from './rondes'
import { isOpen, type Rooster } from './openingstijden'

/* De weekafsluiting. Zie docs/Modules/haccp/haccpmodule.md.

   De app zet het overzicht klaar, Sander tikt het af. Dat aftikken ís de
   handtekening van de leiding die de hygiënecode vraagt, dus die kan alleen van
   hem komen — dat staat in de database vast, niet hier. */

export type WeekNummer = { jaar: number; week: number }

/** ISO-weeknummer: weken lopen maandag t/m zondag, en week 1 is de week met de
 *  eerste donderdag van het jaar. */
export function isoWeekVan(d: Date): WeekNummer {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Naar de donderdag van deze week; die bepaalt bij welk jaar de week hoort.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const jaar = t.getUTCFullYear()
  const eersteJan = new Date(Date.UTC(jaar, 0, 1))
  const week = Math.ceil(((t.getTime() - eersteJan.getTime()) / 86_400_000 + 1) / 7)
  return { jaar, week }
}

/** Maandag en zondag van een ISO-week, als jjjj-mm-dd. */
export function weekGrenzen({ jaar, week }: WeekNummer) {
  const vierdeJan = new Date(Date.UTC(jaar, 0, 4))
  const maandagWeek1 = new Date(vierdeJan)
  maandagWeek1.setUTCDate(vierdeJan.getUTCDate() - ((vierdeJan.getUTCDay() || 7) - 1))
  const maandag = new Date(maandagWeek1)
  maandag.setUTCDate(maandagWeek1.getUTCDate() + (week - 1) * 7)
  const zondag = new Date(maandag)
  zondag.setUTCDate(maandag.getUTCDate() + 6)
  const str = (x: Date) => x.toISOString().slice(0, 10)
  return { van: str(maandag), tot: str(zondag) }
}

export function vorigeWeek({ jaar, week }: WeekNummer): WeekNummer {
  const { van } = weekGrenzen({ jaar, week })
  const d = new Date(van + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 7)
  return isoWeekVan(d)
}

export function volgendeWeek({ jaar, week }: WeekNummer): WeekNummer {
  const { van } = weekGrenzen({ jaar, week })
  const d = new Date(van + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 7)
  return isoWeekVan(d)
}

export type DagStand = {
  datum: string
  open: boolean
  rondes: { moment: string; label: string; gedaan: number; totaal: number }[]
}

export type Weekoverzicht = {
  van: string
  tot: string
  dagen: DagStand[]
  metingen: Meting[]
  afwijkingen: Meting[]
  takenGedaan: number
  leveringen: Levering[]
  doorschuiven: Doorschuif[]
}

/** Alles wat er in één week is vastgelegd. Let op: hoeveel er gemeten hád
 *  moeten worden, wordt afgeleid uit de apparaten zoals ze nu staan. Is er later
 *  een koeling bijgekomen, dan lijkt het alsof die er die week ook al stond. */
export function useWeekoverzicht(week: WeekNummer, rooster: Rooster | undefined) {
  const { van, tot } = weekGrenzen(week)

  return useQuery({
    queryKey: ['weekoverzicht', van, Boolean(rooster)],
    enabled: Boolean(rooster),
    queryFn: async (): Promise<Weekoverzicht> => {
      const [app, temps, taken, lev, vet] = await Promise.all([
        supabase.from('haccp_apparaten').select('id,naam,type,actief,min_temp,max_temp,signaal_min,signaal_max,meetmoment,volgorde,opmerking'),
        supabase
          .from('haccp_temps')
          .select('id,apparaat_id,apparaat_naam,temperatuur,afwijking,datum,tijd,door_naam,actie,opmerking,meetmoment')
          .gte('datum', van).lte('datum', tot)
          .order('datum', { ascending: true }).order('tijd', { ascending: true }),
        supabase.from('haccp_taak_gedaan').select('taak_id,datum').gte('datum', van).lte('datum', tot),
        supabase
          .from('haccp_leveringen')
          .select('id,datum,leverancier,temperatuur,ok,opmerking,door_naam,employee_naam,created_at')
          .gte('datum', van).lte('datum', tot)
          .order('datum', { ascending: true }),
        supabase
          .from('haccp_frituurvet')
          .select('id,gedaan_op,datum,door_naam')
          .gte('datum', van).lte('datum', tot)
          .order('gedaan_op', { ascending: true }),
      ])

      for (const r of [app, temps, taken, lev, vet]) {
        if (r.error) throw new Error(r.error.message)
      }

      const apparaten = (app.data ?? []) as unknown as Apparaat[]
      const metingen = (temps.data ?? []) as unknown as Meting[]

      const dagen: DagStand[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(van + 'T12:00:00Z')
        d.setUTCDate(d.getUTCDate() + i)
        const datum = d.toISOString().slice(0, 10)
        // Een dag dat de zaak dicht is telt niet mee. Anders staat er elke
        // maandag "0 van 6 gemeten" in het rood, en dat is geen verzuim maar
        // een gesloten deur.
        const open = isOpen(rooster, datum)
        dagen.push({
          datum,
          open,
          rondes: RONDES.map((r) => {
            const hoort = open ? apparatenVoor(apparaten, r.moment) : []
            const opDieDag = metingen.filter((m) => m.datum === datum && m.meetmoment === r.moment)
            return {
              moment: r.moment,
              label: r.label,
              gedaan: hoort.filter((a) => opDieDag.some((m) => m.apparaat_id === a.id)).length,
              totaal: hoort.length,
            }
          }),
        })
      }

      return {
        van,
        tot,
        dagen,
        metingen,
        afwijkingen: metingen.filter((m) => m.afwijking),
        takenGedaan: (taken.data ?? []).length,
        leveringen: (lev.data ?? []) as unknown as Levering[],
        doorschuiven: (vet.data ?? []) as unknown as Doorschuif[],
      }
    },
  })
}

export type Weekakkoord = {
  id: number
  jaar: number
  iso_week: number
  akkoord_op: string
  door: string | null
  opmerking: string | null
}

export function useWeekakkoord(week: WeekNummer) {
  return useQuery({
    queryKey: ['weekakkoord', week.jaar, week.week],
    queryFn: async (): Promise<Weekakkoord | null> => {
      const { data, error } = await supabase
        .from('haccp_weekakkoord')
        .select('id,jaar,iso_week,akkoord_op,door,opmerking')
        .eq('jaar', week.jaar)
        .eq('iso_week', week.week)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as unknown as Weekakkoord) ?? null
    },
  })
}

export function useWeekAftikken() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { week: WeekNummer; opmerking: string | null }) => {
      const { data: gebruiker } = await supabase.auth.getUser()
      const { error } = await supabase.from('haccp_weekakkoord').insert({
        jaar: v.week.jaar,
        iso_week: v.week.week,
        door: gebruiker.user?.email ?? null,
        opmerking: v.opmerking,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['weekakkoord'] }),
  })
}

/** Alle afgetekende weken, voor de uitdraai. */
export function useWeekakkoorden(van: string, tot: string) {
  return useQuery({
    queryKey: ['weekakkoorden', van, tot],
    queryFn: async (): Promise<Weekakkoord[]> => {
      const { data, error } = await supabase
        .from('haccp_weekakkoord')
        .select('id,jaar,iso_week,akkoord_op,door,opmerking')
        .gte('akkoord_op', van)
        .lte('akkoord_op', tot + 'T23:59:59')
        .order('akkoord_op', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Weekakkoord[]
    },
  })
}
