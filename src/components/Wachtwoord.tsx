import { useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import { Kaart, Knop, Veld } from './ui'
import { useAuth } from '../lib/auth'
import { KORTSTE, zetWachtwoord } from '../lib/wachtwoord'

/* Een nieuw wachtwoord kiezen.

   Je oude wordt niet gevraagd: het gaat om het account waarmee je nu bent
   ingelogd, en wie binnenkomt met een herstelcode weet het oude juist niet.
   Twee keer intypen, want een typefout merk je anders pas als je buitenstaat. */

export function Wachtwoord() {
  const { email } = useAuth()
  const [een, setEen] = useState('')
  const [twee, setTwee] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState(false)

  async function bewaar() {
    setFout(null)
    if (een !== twee) {
      setFout('De twee velden zijn niet hetzelfde.')
      return
    }
    setBezig(true)
    const melding = await zetWachtwoord(een)
    setBezig(false)
    if (melding) {
      setFout(melding)
      return
    }
    setEen('')
    setTwee('')
    setKlaar(true)
  }

  return (
    <Kaart className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        <div>
          <p className="font-display text-lg">Wachtwoord wijzigen</p>
          <p className="mt-1 text-sm text-muted">
            {email ? `Voor ${email}. ` : ''}Je hoeft je oude niet te weten — het gaat om het
            account waarmee je nu bent ingelogd. Minstens {KORTSTE} tekens.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Veld
          label="Nieuw wachtwoord"
          type="password"
          autoComplete="new-password"
          value={een}
          onChange={(e) => {
            setEen(e.target.value)
            setKlaar(false)
          }}
        />
        <Veld
          label="Nog een keer"
          type="password"
          autoComplete="new-password"
          value={twee}
          onChange={(e) => {
            setTwee(e.target.value)
            setKlaar(false)
          }}
          fout={fout ?? undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Knop onClick={bewaar} bezig={bezig} disabled={een.length < KORTSTE || twee.length === 0}>
          Opslaan
        </Knop>
        {klaar && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-good">
            <Check className="size-4" aria-hidden />
            Je wachtwoord is gewijzigd.
          </span>
        )}
      </div>
    </Kaart>
  )
}
