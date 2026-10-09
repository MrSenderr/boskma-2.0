import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { leesbareFout } from '../lib/fouten'

/* Een melding onderin beeld, voor wat misging terwijl je ergens anders keek.

   Bewust geen vervanger van Mislukt: die staat in de weg tot je hem oplost.
   Dit is voor een actie die niet doorging terwijl de rest van het scherm nog
   gewoon bruikbaar is. */

export function useToast() {
  const [melding, setMelding] = useState<string | null>(null)

  useEffect(() => {
    if (!melding) return
    const t = setTimeout(() => setMelding(null), 8000)
    return () => clearTimeout(t)
  }, [melding])

  /* Door leesbareFout heen: de database en Supabase praten Engels en in hun
     eigen termen, en daar sta je in de zaak niets mee. Herkent hij de fout
     niet, dan blijft de oorspronkelijke tekst staan. */
  const toon = useCallback((tekst: string) => setMelding(leesbareFout(tekst).tekst), [])

  const toast = melding ? (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="pointer-events-auto flex max-w-prose items-start gap-3 rounded-[4px] border border-bad bg-bad-soft px-4 py-3 text-sm text-bad shadow-lg">
        <span>{melding}</span>
        <button
          type="button"
          onClick={() => setMelding(null)}
          aria-label="Melding sluiten"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  ) : null

  return { toon, toast }
}
