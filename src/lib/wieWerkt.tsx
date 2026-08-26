import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useWieBenIk } from './wie'

/* Wie er op een gedeelde tablet aan het werk is. Zie docs/Modules/tablets.md.

   Op een telefoon ben jij ingelogd en klopt alles vanzelf. Een tablet hangt aan
   de muur en blijft ingelogd als het apparaat — dan zou er "Keukentablet" onder
   een temperatuurronde komen te staan, en dat is voor HACCP geen herleidbaar
   dossier.

   Daarom kiest de tablet wie er werkt. Die keuze blijft een uur staan: lang
   genoeg om een ronde te doen zonder zeven keer te kiezen, kort genoeg dat de
   volgende dienst niet op jouw naam doorwerkt. */

const HOELANG = 60 * 60 * 1000
const SLEUTEL = 'boskma.wie-werkt'

export type Werker = { id: string; naam: string }

type Doos = {
  /** Wie er nu werkt; op een telefoon is dat gewoon de ingelogde persoon. */
  werker: Werker | null
  /** Moet er gekozen worden voordat je iets kunt vastleggen? */
  kiezenNodig: boolean
  kies: (w: Werker) => void
  vergeet: () => void
}

const Context = createContext<Doos | null>(null)

function lees(): Werker | null {
  try {
    const rauw = localStorage.getItem(SLEUTEL)
    if (!rauw) return null
    const { werker, tot } = JSON.parse(rauw) as { werker: Werker; tot: number }
    if (Date.now() > tot) {
      localStorage.removeItem(SLEUTEL)
      return null
    }
    return werker
  } catch {
    return null
  }
}

export function WieWerkt({ children }: { children: ReactNode }) {
  const { data: wie } = useWieBenIk()
  const [gekozen, setGekozen] = useState<Werker | null>(lees)

  const isTablet = wie?.is_apparaat === true

  // De keuze verloopt vanzelf; even nakijken zodat een tablet die de hele dag
  // aanstaat niet blijft hangen op de ochtenddienst.
  useEffect(() => {
    if (!isTablet) return
    const klok = setInterval(() => setGekozen(lees()), 60_000)
    return () => clearInterval(klok)
  }, [isTablet])

  const kies = useCallback((w: Werker) => {
    localStorage.setItem(SLEUTEL, JSON.stringify({ werker: w, tot: Date.now() + HOELANG }))
    setGekozen(w)
  }, [])

  const vergeet = useCallback(() => {
    localStorage.removeItem(SLEUTEL)
    setGekozen(null)
  }, [])

  const werker: Werker | null = isTablet
    ? gekozen
    : wie?.medewerker_id
      ? { id: wie.medewerker_id, naam: wie.naam ?? '' }
      : null

  return (
    <Context.Provider value={{ werker, kiezenNodig: isTablet && !gekozen, kies, vergeet }}>
      {children}
    </Context.Provider>
  )
}

export function useWieWerkt() {
  const doos = useContext(Context)
  if (!doos) throw new Error('useWieWerkt hoort binnen <WieWerkt> te staan')
  return doos
}

/** De namen om uit te kiezen. Komt langs een functie in de database, want een
 *  tablet mag de personeelstabel niet lezen — hij krijgt alleen naam en nummer,
 *  geen adres of loon. */
export function useWieWerktErLijst() {
  return useQuery({
    queryKey: ['wie-werkt-er'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Werker[]> => {
      const { data, error } = await supabase.rpc('wie_werkt_er')
      if (error) throw new Error(error.message)
      return (data ?? []) as Werker[]
    },
  })
}
