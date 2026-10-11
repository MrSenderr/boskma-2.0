/* Wie doet er iets met de app.

   Eén regel per persoon: wanneer voor het eerst, wanneer voor het laatst, en
   hoeveel losse dagen. Verder niets — geen klikgedrag, geen schermen. De vraag
   is of iemand de app gebruikt, niet wat hij er doet.

   Waarom niet het inlogmoment van Supabase: dat verspringt alleen als iemand
   opnieuw inlogt. Blijf je ingelogd, en dat doet iedereen, dan staat daar
   maanden later nog dezelfde datum. */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Bezoek = {
  email: string
  eerst_gezien: string
  laatst_gezien: string
  dagen: number
}

const SLEUTEL = 'boskma-gezien'
const UUR = 60 * 60 * 1000

/** Niet bij elke schermwissel een berichtje naar de server; één keer per uur
 *  is genoeg om een dag te herkennen. */
function alGemeld(): boolean {
  try {
    const eerder = Number(window.localStorage.getItem(SLEUTEL))
    return Number.isFinite(eerder) && Date.now() - eerder < UUR
  } catch {
    // Privévenster of geblokkeerde opslag: dan maar elke keer melden.
    return false
  }
}

function onthoud() {
  try {
    window.localStorage.setItem(SLEUTEL, String(Date.now()))
  } catch {
    /* niets aan te doen, en niet erg */
  }
}

/** Meldt dat je er bent. Gaat dit mis, dan merk je daar niets van: het is een
 *  streepje in een lijstje, geen onderdeel van je werk. */
export function useMeldAanwezig(ingelogd: boolean) {
  useEffect(() => {
    if (!ingelogd || alGemeld()) return
    supabase
      .rpc('ik_ben_er')
      .then(({ error }) => {
        if (!error) onthoud()
      })
  }, [ingelogd])
}

export function useAppBezoek() {
  return useQuery({
    queryKey: ['app-bezoek'],
    queryFn: async (): Promise<Bezoek[]> => {
      const { data, error } = await supabase
        .from('app_bezoek')
        .select('email, eerst_gezien, laatst_gezien, dagen')
      if (error) throw new Error(error.message)
      return (data ?? []) as Bezoek[]
    },
  })
}

/** "vandaag", "gisteren", "3 dagen geleden" — bij een lijst leest dat sneller
 *  dan een datum die je zelf moet uitrekenen. */
export function geledenTekst(wanneer: string | null | undefined, nu = new Date()): string {
  if (!wanneer) return 'nog nooit'
  const toen = new Date(wanneer)
  if (Number.isNaN(toen.getTime())) return 'nog nooit'

  const dag = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dagen = Math.round((dag(nu) - dag(toen)) / 86400000)

  if (dagen <= 0) return 'vandaag'
  if (dagen === 1) return 'gisteren'
  if (dagen < 14) return `${dagen} dagen geleden`
  if (dagen < 60) return `${Math.round(dagen / 7)} weken geleden`
  return toen.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}
