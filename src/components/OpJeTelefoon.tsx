import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { Kaart, Knop } from './ui'
import {
  alGeinstalleerd,
  isWeggeklikt,
  klikWeg,
  soortToestel,
  stappenVoor,
} from '../lib/installeren'

/* "Zet de app op je beginscherm" — één keer, op het toestel waar het over gaat.

   Daarna opent hij zonder adresbalk, staat hij tussen de andere apps en kunnen
   er meldingen binnenkomen. Zonder deze uitleg blijft het voor de meeste
   mensen gewoon een website die ze af en toe opzoeken.

   Chrome op Android kan het zelf aanbieden; dan is het één knop in plaats van
   drie stappen. Die kans krijg je maar één keer per bezoek, dus we vangen hem
   op zodra de browser hem geeft. */

type Installatiekans = Event & { prompt: () => Promise<void> }

export function OpJeTelefoon() {
  const [weg, setWeg] = useState(true)
  const [kans, setKans] = useState<Installatiekans | null>(null)
  const [toestel, setToestel] = useState(soortToestel())

  useEffect(() => {
    setToestel(soortToestel())
    setWeg(alGeinstalleerd() || isWeggeklikt())

    function opvangen(e: Event) {
      // Zonder dit toont Chrome zijn eigen balkje onderin, en dan staan er twee.
      e.preventDefault()
      setKans(e as Installatiekans)
    }
    window.addEventListener('beforeinstallprompt', opvangen)
    return () => window.removeEventListener('beforeinstallprompt', opvangen)
  }, [])

  const stappen = stappenVoor(toestel)
  // Op een laptop valt er niets uit te leggen, tenzij de browser het zelf
  // aanbiedt.
  if (weg || (stappen.length === 0 && !kans)) return null

  function verberg() {
    klikWeg()
    setWeg(true)
  }

  return (
    <Kaart className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg">Zet de app op je beginscherm</p>
          <p className="mt-1 text-sm text-muted">
            Dan hoef je hem niet meer op te zoeken: hij staat tussen je andere apps, opent zonder
            adresbalk en kan je een seintje geven.
          </p>
        </div>
        <button
          type="button"
          onClick={verberg}
          aria-label="Deze uitleg verbergen"
          className="shrink-0 text-muted hover:text-text"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {kans ? (
        <div>
          <Knop
            onClick={async () => {
              await kans.prompt()
              verberg()
            }}
          >
            Op mijn beginscherm zetten
          </Knop>
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5 pl-1 text-sm">
          {stappen.map((stap, i) => (
            <li key={stap} className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <span>{stap}</span>
            </li>
          ))}
        </ol>
      )}
    </Kaart>
  )
}
