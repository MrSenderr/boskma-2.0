import { Link } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import { Kaart, Kopje } from './ui'
import { dagenStil, standVan, useStromen, watStilstaat, type Stroom } from '../lib/stromen'

/* Of alles nog vanzelf binnenkomt.
 *
 * Gaat het goed, dan staat hier één regel. Dat is met opzet: een alarm dat
 * alleen bestaat als er iets mis is vertrouw je niet, want je weet nooit of het
 * nog aanstaat. Nu zie je elke ochtend dat het werkt.
 *
 * Staat er iets stil, dan wordt het een kaart met wat er niet meer binnenkomt,
 * sinds wanneer, en waar je moet kijken. */

function hoelang(s: Stroom): string {
  const dagen = dagenStil(s)
  if (dagen === null) return 'nog nooit iets binnengekomen'
  if (dagen === 0) return 'vandaag nog'
  if (dagen === 1) return 'gisteren voor het laatst'
  return `${dagen} dagen geleden voor het laatst`
}

export function Stromen() {
  const { data } = useStromen()
  if (!data || data.length === 0) return null

  const actief = data.filter((s) => s.actief)
  const stil = watStilstaat(actief)

  if (stil.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Check className="size-4 shrink-0 text-good" aria-hidden />
        Alles komt binnen: {actief.map((s) => s.naam.toLowerCase()).join(', ')}.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Er komt iets niet meer binnen</Kopje>
      <Kaart className="flex flex-col border-warn py-2">
        {stil.map((s) => (
          <div key={s.id} className="flex flex-col gap-0.5 border-b border-line px-4 py-3 last:border-0">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
                {s.naam}
              </span>
              <span className="text-sm text-muted">{hoelang(s)}</span>
            </span>
            {s.uitleg && <span className="pl-6 text-sm text-muted">{s.uitleg}</span>}
            {s.pad && (
              <Link to={s.pad} className="w-fit pl-6 text-sm font-semibold text-muted underline hover:text-text">
                Kijken
              </Link>
            )}
          </div>
        ))}
      </Kaart>
      <p className="text-sm text-muted">
        {standVan(stil[0]) === 'nooit'
          ? 'Hier is nog nooit iets binnengekomen — waarschijnlijk is het nooit aangezet.'
          : 'Meestal is een script in je Gmail uitgezet, of een mailadres veranderd.'}
      </p>
    </section>
  )
}
