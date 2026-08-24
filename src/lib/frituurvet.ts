import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Het frituurvet loopt in een doorschuifsysteem. Zie
   docs/Modules/haccp/haccpmodule.md.

   Verse olie gaat in de laatste pan. Bij één handeling schuift alles een plek
   op: pan 3 naar pan 2, pan 2 naar pan 1, en pan 1 gaat naar de
   afgewerktvetbak. Er wordt dus geen verversdatum per pan bijgehouden, maar het
   doorschuiven zelf — uit die momenten valt de rest af te leiden. */

/** Zoveel pannen staan er. Eén getal, zodat een vierde pan later geen verbouwing
 *  is maar een cijfer. */
export const AANTAL_PANNEN = 3

export type Doorschuif = {
  id: number
  gedaan_op: string
  datum: string
  door_naam: string | null
}

export function useDoorschuiven(hoeveel = 30) {
  return useQuery({
    queryKey: ['frituurvet', hoeveel],
    staleTime: 0,
    queryFn: async (): Promise<Doorschuif[]> => {
      const { data, error } = await supabase
        .from('haccp_frituurvet')
        .select('id,gedaan_op,datum,door_naam')
        .order('gedaan_op', { ascending: false })
        .limit(hoeveel)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Doorschuif[]
    },
  })
}

export function useDoorschuiven_bewaren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: { medewerkerId: string | null | undefined; doorNaam: string }) => {
      const { error } = await supabase.from('haccp_frituurvet').insert({
        medewerker_id: v.medewerkerId ?? null,
        door_naam: v.doorNaam,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['frituurvet'] }),
  })
}

export type PanStand = {
  /** 1 is de oudste pan, die bij het volgende doorschuiven de bak in gaat. */
  nummer: number
  /** Wanneer deze olie als verse olie het systeem in ging. */
  versOp: string | null
  /** Hoeveel dagen deze olie in totaal meedraait. */
  dagen: number | null
}

function dagenTussen(vanaf: string) {
  return Math.floor((Date.now() - new Date(vanaf).getTime()) / 86_400_000)
}

/** Bij één doorschuif krijgen alle pannen tegelijk nieuwe inhoud, dus "hoe lang
 *  zit het in deze pan" is voor alle drie hetzelfde en zegt niets. Wat wél iets
 *  zegt is hoe lang de olie meedraait sinds hij vers in de laatste pan ging.
 *
 *  De olie in de laatste pan ging vers het systeem in bij het laatste
 *  doorschuiven, de pan ervoor bij het doorschuiven daarvoor, enzovoort. De
 *  momenten komen nieuw-naar-oud binnen, dus de pannen lopen mee met de lijst.
 *
 *  Staat er nog niet genoeg vastgelegd — bij een verse start bijvoorbeeld — dan
 *  blijft het leeg. Een verzonnen datum is erger dan geen datum. */
export function standVanDePannen(doorschuiven: Doorschuif[]): PanStand[] {
  const pannen: PanStand[] = []

  for (let pan = AANTAL_PANNEN; pan >= 1; pan--) {
    const vers = doorschuiven[AANTAL_PANNEN - pan]
    pannen.push({
      nummer: pan,
      versOp: vers?.gedaan_op ?? null,
      dagen: vers ? dagenTussen(vers.gedaan_op) : null,
    })
  }

  return pannen.sort((a, b) => a.nummer - b.nummer)
}

/** Wanneer er voor het laatst is doorgeschoven. */
export function laatsteDoorschuif(doorschuiven: Doorschuif[]) {
  return doorschuiven[0] ?? null
}
