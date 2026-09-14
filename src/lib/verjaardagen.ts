import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/* Verjaardagen van collega's, voor het startscherm van een medewerker.

   Heette vandaag.ts en bevatte ook de persoonlijke taken; die zijn met de
   takenmodule verdwenen. */

export type Verjaardag = { naam: string; dag: number; maand: number }

/** Collega's zien elkaars naam en dag, niet het geboortejaar. Die afscherming
 *  zit in de database, niet hier. */
export function useVerjaardagen() {
  return useQuery({
    queryKey: ['verjaardagen'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Verjaardag[]> => {
      const { data, error } = await supabase.rpc('verjaardagen')
      if (error) throw new Error(error.message)
      return (data ?? []) as Verjaardag[]
    },
  })
}

/** Wie is er vandaag jarig, en wie deze week nog? */
export function jarigen(lijst: Verjaardag[]) {
  const nu = new Date()
  const dag = nu.getDate()
  const maand = nu.getMonth() + 1
  const vandaag = lijst.filter((v) => v.dag === dag && v.maand === maand)

  const komend = lijst
    .map((v) => {
      const dit = new Date(nu.getFullYear(), v.maand - 1, v.dag)
      if (dit < new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()))
        dit.setFullYear(nu.getFullYear() + 1)
      const dagen = Math.round((dit.getTime() - new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime()) / 86_400_000)
      return { ...v, dagen }
    })
    .filter((v) => v.dagen > 0 && v.dagen <= 7)
    .sort((a, b) => a.dagen - b.dagen)

  return { vandaag, komend }
}
