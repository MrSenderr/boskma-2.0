import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, Plus, Search } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt } from '../components/ui'
import { magIk, useMijnRechten } from '../lib/rechten'
import { useRecepten } from '../lib/recepten'

/* Het receptenboek. Zie docs/Modules/recepten.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 pl-10 text-base outline-none focus:border-accent'

export function Recepten() {
  const { data, isPending, error, refetch } = useRecepten()
  const { data: rechten } = useMijnRechten()
  const [zoek, setZoek] = useState('')

  if (isPending) return <Laden tekst="Recepten laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const mag = magIk(rechten, 'recepten')
  const term = zoek.trim().toLowerCase()
  const gevonden = term
    ? data.filter((r) =>
        [r.naam, r.omschrijving, r.ingredienten, r.bereiding]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
    : data

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Kopje>Recepten</Kopje>
        {mag && (
          <Link
            to="/recepten/nieuw"
            data-touch
            className="inline-flex items-center gap-2 rounded-[4px] bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Recept schrijven
          </Link>
        )}
      </div>

      {data.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className={invoer}
            placeholder="Zoeken in naam, ingrediënten of bereiding"
            aria-label="Recepten zoeken"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
      )}

      {data.length === 0 ? (
        <Leeg
          titel="Nog geen recepten"
          uitleg={
            mag
              ? 'Schrijf het eerste recept. Je kunt er daarna een MEP-taak aan koppelen, zodat het bij "Pindasaus maken" met één tik openstaat.'
              : 'Er staan nog geen recepten in. Sander vult ze aan.'
          }
          actie={
            mag ? (
              <Link
                to="/recepten/nieuw"
                className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand"
              >
                <Plus className="size-4" aria-hidden />
                Recept schrijven
              </Link>
            ) : undefined
          }
        />
      ) : gevonden.length === 0 ? (
        <Leeg titel="Niets gevonden" uitleg={`Geen recept met "${zoek}" erin.`} />
      ) : (
        <Kaart>
          {gevonden.map((r) => (
            <Link
              key={r.id}
              to={`/recepten/${r.id}`}
              data-touch
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <BookOpen className="size-5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${r.actief ? '' : 'text-muted line-through'}`}>
                  {r.naam}
                </span>
                {r.omschrijving && (
                  <span className="block truncate text-sm text-muted">{r.omschrijving}</span>
                )}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </Kaart>
      )}

      {!mag && data.length > 0 && (
        <p className="max-w-prose text-sm text-muted">
          Lezen mag iedereen. Schrijven en aanpassen doet Sander, of iemand die hij
          daarvoor heeft aangewezen.
        </p>
      )}
      {mag && <Knop soort="rustig" className="w-fit" onClick={() => refetch()}>Lijst verversen</Knop>}
    </div>
  )
}
