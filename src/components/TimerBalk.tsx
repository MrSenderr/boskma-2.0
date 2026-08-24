import { Timer as TimerIcoon, X } from 'lucide-react'
import { alsKlok, resterend, useTimers } from '../lib/timers'

/* De lopende timers, altijd in beeld — ook als je naar een andere kaart bladert.
   Zie docs/Modules/werkkaarten.md. */

export function TimerBalk() {
  const { timers, stop } = useTimers()
  if (timers.length === 0) return null

  return (
    <div className="sticky top-0 z-20 flex flex-wrap gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
      {timers.map((t) => {
        const over = resterend(t)
        // Afgelopen: de hele knop wegtikken, want dan wil je er vanaf. Lopend:
        // alleen het kruisje, zodat je hem niet per ongeluk uitzet terwijl er
        // iets in de oven staat.
        if (t.afgelopen) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => stop(t.id)}
              className="flex min-h-11 animate-pulse items-center gap-2 rounded-[4px] bg-bad px-3 py-2 text-sm font-semibold text-white"
            >
              <TimerIcoon className="size-4 shrink-0" aria-hidden />
              <span className="max-w-[12rem] truncate">{t.naam}</span>
              <span>klaar — tik om weg te halen</span>
            </button>
          )
        }
        return (
          <span
            key={t.id}
            className="flex items-center gap-2 rounded-[4px] bg-surface-2 px-3 py-2 text-sm font-semibold text-text"
          >
            <TimerIcoon className="size-4 shrink-0" aria-hidden />
            <span className="max-w-[10rem] truncate">{t.naam}</span>
            <span className="tabular-nums">{alsKlok(over)}</span>
            <button
              type="button"
              onClick={() => stop(t.id)}
              aria-label={`Timer ${t.naam} stoppen`}
              className="flex size-8 items-center justify-center rounded-[3px] hover:bg-black/10"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        )
      })}
    </div>
  )
}
