import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/* De weerreeks uit dagboek_dagen.
 *
 * Wordt gevuld door de edge function `weer-verzamelen`, elke ochtend om 05:30.
 * Zie supabase/functions/weer-verzamelen — die kijkt de hele reeks na, niet
 * alleen de laatste dag, zodat een gat zich vanzelf dicht.
 *
 * Het archief van Open-Meteo loopt een paar dagen achter, dus de nieuwste rij
 * is gisteren of eergisteren. Een voorspelling zit er nog niet in; zolang dat zo
 * is kijkt dit scherm terug en niet vooruit. */

export type Weerdag = {
  datum: string
  temp_min: number | null
  temp_max: number | null
  neerslag_mm: number | null
  zonuren: number | null
  wind_kmh: number | null
  weerstype: string | null
}

const VELDEN = 'datum,temp_min,temp_max,neerslag_mm,zonuren,wind_kmh,weerstype'

/** De laatste dagen, nieuwste eerst. */
export function useWeerreeks(dagen = 7) {
  return useQuery({
    queryKey: ['weerreeks', dagen],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Weerdag[]> => {
      const { data, error } = await supabase
        .from('dagboek_dagen')
        .select(VELDEN)
        .order('datum', { ascending: false })
        .limit(dagen)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Weerdag[]
    },
  })
}

export type ReeksStand = {
  dagen: number
  eerste: string | null
  laatste: string | null
  /** Kalenderdagen tussen eerste en laatste waarvoor geen rij bestaat. */
  gaten: number
}

/* Alleen de datums, geen metingen: tweehonderd korte strings is niets, en
   daarmee kun je laten zien dát de reeks dicht is in plaats van het te beweren.
   Een verzamelaar die stilvalt zonder dat iemand het merkt was precies het
   probleem — dus hoort de stand op het scherm. */
export function useReeksStand() {
  return useQuery({
    queryKey: ['weerreeks-stand'],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ReeksStand> => {
      const { data, error } = await supabase
        .from('dagboek_dagen')
        .select('datum')
        .order('datum', { ascending: true })
      if (error) throw new Error(error.message)
      const datums = (data ?? []).map((r) => (r as { datum: string }).datum)
      if (datums.length === 0) return { dagen: 0, eerste: null, laatste: null, gaten: 0 }

      const eerste = datums[0]
      const laatste = datums[datums.length - 1]
      const kalenderdagen =
        Math.round(
          (new Date(`${laatste}T00:00:00Z`).getTime() - new Date(`${eerste}T00:00:00Z`).getTime()) /
            86_400_000,
        ) + 1
      return { dagen: datums.length, eerste, laatste, gaten: kalenderdagen - datums.length }
    },
  })
}
