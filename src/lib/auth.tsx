import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBezig(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_gebeurtenis, nieuwe) => {
      setSession(nieuwe)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

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
