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
        return (
          <span
            key={t.id}
            className={`flex items-center gap-2 rounded-[4px] px-3 py-2 text-sm font-semibold ${
              t.afgelopen ? 'animate-pulse bg-bad text-white' : 'bg-surface-2 text-text'
            }`}
          >
            <TimerIcoon className="size-4 shrink-0" aria-hidden />
            <span className="max-w-[10rem] truncate">{t.naam}</span>
            <span className="tabular-nums">{t.afgelopen ? 'klaar' : alsKlok(over)}</span>
            <button
              type="button"
              onClick={() => stop(t.id)}
              aria-label={`Timer ${t.naam} wegklikken`}
              className="flex size-6 items-center justify-center rounded-[3px] hover:bg-black/10"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        )
      })}
    </div>
  )
}
