import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useWieBenIk } from './wie'
import { huidigeTablet, isTabletSoort, zetTablet, type Tablet } from './tabletmodus'

/* Wie er op een gedeelde tablet aan het werk is. Zie docs/Modules/tablets.md.

   Op een telefoon ben jij ingelogd en klopt alles vanzelf. Een tablet hangt aan
   de muur en blijft ingelogd als het apparaat — dan zou er "Keukentablet" onder
   een temperatuurronde komen te staan, en dat is voor HACCP geen herleidbaar
   dossier.

   Daarom vraagt een tablet bij élke handeling wie het deed. Niet één keer bij
   binnenkomst: dan komt het werk van je collega die er even bijkomt op jouw naam
   te staan. */

/** id is leeg bij een beheerder: die staat niet in de personeelslijst.
 *  Nooit een lege tekst gebruiken — die kolom verwacht een nummer. */
export type Werker = { id: string | null; naam: string }

type Doos = {
  /** Welke tablet dit is, of null voor een gewone telefoon. */
  tablet: Tablet | null
  /** Is dit een tablet? Dan wordt er gevraagd en is alles groter. */
  isTablet: boolean
  /** Wie legt dit vast? Op een telefoon jijzelf, op een tablet wie er kiest.
   *  Geeft null terug als er geannuleerd wordt. */
  vraagWie: () => Promise<Werker | null>
  /** Voor de overlay; niet zelf gebruiken. */
  vraag: { open: boolean; kies: (w: Werker) => void; annuleer: () => void }
  /** Wat er misging bij het vragen. */
  fout: string | null
}

const Context = createContext<Doos | null>(null)

export function WieWerkt({ children }: { children: ReactNode }) {
  const { data: wie } = useWieBenIk()
  const [open, setOpen] = useState(false)
  const wacht = useRef<((w: Werker | null) => void) | null>(null)

  // Alleen het adres bepaalt dit: /keuken of /zaak zet het aan. Er was ook een
  // vlag op het account, maar dat moest door drie lagen kloppen en liep steeds
  // ergens anders vast. Eén weg is beter dan twee.
  const [tablet, setTablet] = useState<Tablet | null>(huidigeTablet)
  const isTablet = tablet !== null

  // Open je /keuken terwijl je nog moet inloggen, dan komt de route er niet aan
  // toe. Daarom hier ook kijken, vóór het inlogscherm.
  useEffect(() => {
    const pad = window.location.pathname.replace(/^\/tablet\//, '/')
    const soort = pad === '/tablet' ? 'algemeen' : pad.slice(1)
    if (isTabletSoort(soort)) {
      zetTablet(soort)
      setTablet(soort)
    }
  }, [])

  // De vlag kan in een ander tabblad gezet zijn, of net door /keuken.
  useEffect(() => {
    const kijk = () => setTablet(huidigeTablet())
    kijk()
    window.addEventListener('storage', kijk)
    return () => window.removeEventListener('storage', kijk)
  })

  const vraagWie = useCallback((): Promise<Werker | null> => {
    if (!isTablet) {
      // Nooit stilzwijgend niets teruggeven: dan doet een tik helemaal niets en
      // sta je te kijken naar een scherm dat zwijgt. Zonder medewerkernummer
      // leggen we vast op naam, dat is beter dan niet vastleggen.
      return Promise.resolve({ id: wie?.medewerker_id ?? null, naam: wie?.naam ?? '' })
    }
    return new Promise((klaar) => {
      // Stond er al een vraag open, dan die eerst netjes afsluiten. Anders
      // blijft de vorige belofte voor eeuwig hangen en lijkt het alsof de app
      // niets doet.
      wacht.current?.(null)
      wacht.current = klaar
      setOpen(true)
    })
  }, [isTablet, wie])

  const kies = useCallback((w: Werker) => {
    setOpen(false)
    wacht.current?.(w)
    wacht.current = null
  }, [])

  const annuleer = useCallback(() => {
    setOpen(false)
    wacht.current?.(null)
    wacht.current = null
  }, [])

  return (
    <Context.Provider value={{ tablet, isTablet, vraagWie, vraag: { open, kies, annuleer }, fout: null }}>
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
