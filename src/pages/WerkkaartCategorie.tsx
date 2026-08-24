import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Kaart, Laden, Leeg, Mislukt } from '../components/ui'
import { magIk, useMijnRechten } from '../lib/rechten'
import { useCategorieen, useWerkkaarten } from '../lib/werkkaarten'

/* De gerechten binnen één categorie. Zie docs/Modules/werkkaarten.md. */

export function WerkkaartCategorie() {
  const { categorie } = useParams()
  const id = Number(categorie)
  const { data: categorieen, isPending, error, refetch } = useCategorieen()
  const { data: kaarten } = useWerkkaarten()
  const { data: rechten } = useMijnRechten()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const cat = categorieen.find((c) => c.id === id)
  const inCat = (kaarten ?? []).filter((k) => k.categorie_id === id)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/werkkaarten"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle categorieën
      </Link>

      <h2 className="font-display text-2xl">{cat?.naam ?? 'Werkkaarten'}</h2>

      {inCat.length === 0 ? (
        <Leeg
          titel="Nog geen gerechten"
          uitleg={
            magIk(rechten, 'recepten')
              ? 'Voeg het eerste gerecht toe onder Beheer.'
              : 'Er staat hier nog niets in.'
          }
        />
      ) : (
        <Kaart>
          {inCat.map((k) => (
            <Link
              key={k.id}
              to={`/werkkaarten/kaart/${k.id}`}
              data-touch
              className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 font-display text-lg">{k.naam}</span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </Kaart>
      )}
    </div>
  )
}
