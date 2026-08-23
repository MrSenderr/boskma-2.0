import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { Knop, Veld } from '../components/ui'
import { useAuth } from '../lib/auth'
import { vraagInloglink } from '../lib/wie'

type Manier = 'medewerker' | 'beheer'

export function Inloggen() {
  const { inloggen } = useAuth()
  const [manier, setManier] = useState<Manier>('medewerker')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [verstuurd, setVerstuurd] = useState<{ testmodus?: boolean; naar?: string } | null>(null)

  async function metWachtwoord(e: FormEvent) {
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

  async function metLink(e: FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const r = await vraagInloglink(email)
    setBezig(false)
    if (!r.ok) {
      setFout(r.error ?? 'Er ging iets mis. Probeer het zo nog eens.')
      return
    }
    // Ook als het adres niet bekend is tonen we hetzelfde scherm: anders kun je
    // hiermee uitvinden wie er bij Boskma werkt.
    setVerstuurd({ testmodus: r.testmodus, naar: r.verstuurd_naar })
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

        {verstuurd ? (
          <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <p className="font-display text-lg">Kijk in je mail</p>
            <p className="text-sm text-muted">
              Als dit adres bij ons bekend is, staat er nu een mail met een knop om in
              te loggen. Die link is een uur geldig.
            </p>
            {verstuurd.testmodus && verstuurd.naar && (
              <p className="rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
                Testmodus: de mail ging naar {verstuurd.naar}, niet naar de medewerker.
              </p>
            )}
            <Knop
              soort="rustig"
              onClick={() => {
                setVerstuurd(null)
                setEmail('')
              }}
            >
              Ander adres proberen
            </Knop>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex gap-1 rounded-[4px] bg-bg p-1">
              {(['medewerker', 'beheer'] as Manier[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setManier(m)
                    setFout(null)
                  }}
                  aria-pressed={manier === m}
                  className={`min-h-11 flex-1 rounded-[3px] px-2 text-sm font-semibold transition-colors ${
                    manier === m ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface-2'
                  }`}
                >
                  {m === 'medewerker' ? 'Medewerker' : 'Beheer'}
                </button>
              ))}
            </div>

            {manier === 'medewerker' ? (
              <form onSubmit={metLink} className="flex flex-col gap-4">
                <Veld
                  label="E-mailadres"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fout={fout ?? undefined}
                />
                <Knop type="submit" breed bezig={bezig}>
                  Stuur mij een inloglink
                </Knop>
                <p className="text-sm text-muted">
                  Geen wachtwoord nodig. Je krijgt een mail met een knop; daarna blijf
                  je ingelogd op dit toestel.
                </p>
              </form>
            ) : (
              <form onSubmit={metWachtwoord} className="flex flex-col gap-4">
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
