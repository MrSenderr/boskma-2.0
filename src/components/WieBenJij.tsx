import { UserRound, X } from 'lucide-react'
import { Laden } from './ui'
import { useWieWerkt, useWieWerktErLijst } from '../lib/wieWerkt'

/* De naamvraag op een tablet. Komt tevoorschijn op het moment dat je iets
   vastlegt, niet bij binnenkomst: dan komt het werk van een collega die er even
   bijkomt op jouw naam te staan. Zie docs/Modules/tablets.md. */

export function WieBenJij() {
  const { vraag } = useWieWerkt()
  const { data, isPending } = useWieWerktErLijst()

  if (!vraag.open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Wie legt dit vast?"
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-card bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <span className="font-display text-2xl">Wie ben jij?</span>
          <button
            type="button"
            onClick={vraag.annuleer}
            aria-label="Annuleren"
            className="flex size-12 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isPending ? (
            <Laden />
          ) : (data ?? []).length === 0 ? (
            <p className="p-4 text-muted">
              Er staan geen medewerkers in de lijst. Voeg ze toe onder Personeel.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(data ?? []).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => vraag.kies(w)}
                  className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-card border-2 border-line-strong bg-surface px-3 py-5 text-center font-display text-xl hover:border-accent hover:bg-surface-2"
                >
                  <UserRound className="size-7 text-muted" aria-hidden />
                  {w.naam}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
