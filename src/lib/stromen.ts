/* Wat er vanzelf binnenhoort te komen.
 *
 * Vier dingen komen binnen zonder dat je er iets voor doet: de inkoopfacturen
 * van Veldboer, de facturen uit je mail, het rooster uit eitje en het weer. Ze
 * lopen alle vier via iets buiten deze app — een script in Gmail, de oude
 * inkoop-app, een cron.
 *
 * Valt er een stil, dan is er geen foutmelding. Er gebeurt gewoon niets meer.
 * De database slaat alarm (zie stromen_controleren); dit is de kant die laat
 * zien dát het goed gaat. Een alarm dat alleen bestaat als er iets mis is,
 * vertrouw je niet: je weet nooit of het nog aanstaat. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Stroom = {
  id: number
  sleutel: string
  naam: string
  uitleg: string | null
  max_dagen: number
  pad: string | null
  laatste_op: string | null
  gecontroleerd_op: string | null
  actief: boolean
}

export type Stand = 'goed' | 'stil' | 'nooit'

/** Hoeveel dagen geleden er voor het laatst iets binnenkwam. */
export function dagenStil(s: Stroom, vandaag = new Date()): number | null {
  if (!s.laatste_op) return null
  const toen = new Date(`${s.laatste_op}T12:00:00`)
  const nu = new Date(vandaag)
  nu.setHours(12, 0, 0, 0)
  return Math.round((nu.getTime() - toen.getTime()) / 86_400_000)
}

export function standVan(s: Stroom, vandaag = new Date()): Stand {
  const dagen = dagenStil(s, vandaag)
  if (dagen === null) return 'nooit'
  return dagen > s.max_dagen ? 'stil' : 'goed'
}

/** Alleen wat er mis is. Gaat alles goed, dan is dit leeg. */
export function watStilstaat(stromen: Stroom[], vandaag = new Date()): Stroom[] {
  return stromen.filter((s) => s.actief && standVan(s, vandaag) !== 'goed')
}

export function useStromen() {
  return useQuery({
    queryKey: ['stromen'],
    queryFn: async (): Promise<Stroom[]> => {
      const { data, error } = await supabase.from('stromen').select('*').order('sleutel')
      if (error) throw new Error(error.message)
      return (data ?? []) as Stroom[]
    },
  })
}
