import { Link } from 'react-router-dom'
import { ChevronRight, UtensilsCrossed } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt } from '../components/ui'
import { useCategorieen, useWerkkaarten } from '../lib/werkkaarten'
import { magIk, useMijnRechten } from '../lib/rechten'

/* De categorieën. Twee tikken naar een gerecht, niets typen met vette vingers.
   Zie docs/Modules/werkkaarten.md. */

export function Werkkaarten() {
  const { data: categorieen, isPending, error, refetch } = useCategorieen()
  const { data: kaarten } = useWerkkaarten()
  const { data: rechten } = useMijnRechten()

  if (isPending) return <Laden tekst="Werkkaarten laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (categorieen.length === 0) {
    return <Leeg titel="Nog geen werkkaarten" uitleg="Er staan nog geen categorieën klaar." />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Kopje>Werkkaarten</Kopje>
        {magIk(rechten, 'recepten') && (
          <Link
            to="/werkkaarten/beheer"
            data-touch
            className="inline-flex items-center rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            Beheren
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categorieen.map((c) => {
          const aantal = (kaarten ?? []).filter((k) => k.categorie_id === c.id).length
          return (
            <Link
              key={c.id}
              to={`/werkkaarten/${c.id}`}
              data-touch
              className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 hover:bg-surface-2"
            >
              <UtensilsCrossed className="size-6 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg">{c.naam}</span>
                <span className="block text-sm text-muted">
                  {aantal} {aantal === 1 ? 'gerecht' : 'gerechten'}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          )
        })}
      </div>

      <Kaart className="p-4">
        <p className="text-sm text-muted">
          Staat er een tijd bij een stap — "pistolet 7 min in de oven" — dan kun je
          hem aantikken. De timer loopt bovenin door terwijl je verder bladert, en
          piept als het klaar is.
        </p>
      </Kaart>
    </div>
  )
}
