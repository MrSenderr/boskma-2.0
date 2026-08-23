import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { zetModus } from './modus'

type AuthWaarde = {
  session: Session | null
  bezig: boolean
  email: string | null
  inloggen: (email: string, wachtwoord: string) => Promise<string | null>
  uitloggen: () => Promise<void>
}

const AuthContext = createContext<AuthWaarde | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [bezig, setBezig] = useState(true)
  const client = useQueryClient()
  const vorigeGebruiker = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      vorigeGebruiker.current = data.session?.user.id ?? null
      setSession(data.session)
      setBezig(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_gebeurtenis, nieuwe) => {
      // Alles wat is opgehaald hoorde bij de vorige gebruiker. Zonder dit blijft
      // de app na uitloggen en opnieuw inloggen de oude naam en rol tonen — en
      // dan denk je dat je als iemand anders bent ingelogd.
      const nu = nieuwe?.user.id ?? null
      if (nu !== vorigeGebruiker.current) {
        vorigeGebruiker.current = nu
        client.clear()
        // De schakelaar stond misschien op medewerker omdat de vorige gebruiker
        // dat moest. Terug naar beheer; wie geen beheerder is wordt toch weer
        // omgezet door de schil.
        zetModus('beheer')
      }
      setSession(nieuwe)
    })
    return () => sub.subscription.unsubscribe()
  }, [client])

  /** Geeft null terug bij succes, anders een leesbare foutmelding. */
  async function inloggen(email: string, wachtwoord: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: wachtwoord,
    })
    if (!error) return null
    if (error.message.toLowerCase().includes('invalid login')) {
      return 'Onjuist e-mailadres of wachtwoord.'
    }
    return 'Inloggen lukte niet. Controleer je internetverbinding.'
  }

  async function uitloggen() {
    await supabase.auth.signOut()
    client.clear()
    zetModus('beheer')
  }

  return (
    <AuthContext.Provider
      value={{ session, bezig, email: session?.user.email ?? null, inloggen, uitloggen }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const waarde = useContext(AuthContext)
  if (!waarde) throw new Error('useAuth moet binnen een AuthProvider staan')
  return waarde
}
