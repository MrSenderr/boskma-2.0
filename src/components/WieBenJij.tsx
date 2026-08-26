import { UserRound } from 'lucide-react'
import { Kaart, Kopje, Laden } from './ui'
import { useWieWerkt, useWieWerktErLijst } from '../lib/wieWerkt'

/* Op een tablet: wie staat er nu achter het scherm? Grote knoppen, één tik, en
   de keuze blijft een uur staan. Zie docs/Modules/tablets.md. */

export function WieBenJij() {
  const { kies } = useWieWerkt()
  const { data, isPending } = useWieWerktErLijst()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Kopje>Wie ben jij?</Kopje>
        <p className="mt-1 text-sm text-muted">
          Wat je aftikt komt op jouw naam te staan. De keuze blijft een uur staan.
        </p>
      </div>

      {isPending ? (
        <Laden />
      ) : (data ?? []).length === 0 ? (
        <Kaart className="p-5">
          <p className="text-sm text-muted">
            Er staan geen medewerkers in de lijst. Voeg ze toe onder Personeel.
          </p>
        </Kaart>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(data ?? []).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => kies(w)}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-card border-[1.5px] border-line-strong bg-surface px-3 py-4 text-center font-display text-lg hover:border-accent hover:bg-surface-2"
            >
              <UserRound className="size-5 text-muted" aria-hidden />
              {w.naam}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Een balkje met wie er nu werkt, en de mogelijkheid om te wisselen. */
export function WieWerktBalk() {
  const { werker, vergeet } = useWieWerkt()
  if (!werker) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-sm">
      <UserRound className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        Je werkt als <span className="font-semibold">{werker.naam}</span>
      </span>
      <button
        type="button"
        onClick={vergeet}
        className="min-h-11 rounded-[4px] px-3 font-semibold text-muted hover:bg-surface hover:text-text"
      >
        Iemand anders
      </button>
    </div>
  )
}
