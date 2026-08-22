import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { Knop, Veld } from '../components/ui'
import { useAuth } from '../lib/auth'

export function Inloggen() {
  const { inloggen } = useAuth()
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function verstuur(e: FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const melding = await inloggen(email, wachtwoord)
    setBezig(false)
    if (melding) {
      setFout(melding)
      setWachtwoord('')
    }
  }

  // Het inlogscherm is altijd petrol, ongeacht licht of donker: zo zie je
  // meteen van wie de app is.
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#003A41] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-[#F0EBD5]">
          <Logo className="w-28" />
          <div className="text-center">
            <p className="font-display text-xl">Boskma Foodservice</p>
            <p className="text-xs uppercase tracking-[0.28em] text-[#F0EBD5]/60">
              Snackerie 't Zonnetje
            </p>
          </div>
        </div>

        <form
          onSubmit={verstuur}
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6"
        >
          <Veld
            label="E-mailadres"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Veld
            label="Wachtwoord"
            type="password"
            autoComplete="current-password"
            required
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            fout={fout ?? undefined}
          />
          <Knop type="submit" breed bezig={bezig}>
            Inloggen
          </Knop>
        </form>
      </div>
    </div>
  )
}
