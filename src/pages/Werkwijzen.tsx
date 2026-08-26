import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ListOrdered, Plus, Search } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt } from '../components/ui'
import { magIk, useMijnRechten } from '../lib/rechten'
import { useWerkwijzen } from '../lib/werkwijzen'

/* Uitleg bij het werk. Zie docs/Modules/werkwijzen.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 pl-10 text-base outline-none focus:border-accent'

export function Werkwijzen() {
  const { data, isPending, error, refetch } = useWerkwijzen()
  const { data: rechten } = useMijnRechten()
  const [zoek, setZoek] = useState('')

  if (isPending) return <Laden tekst="Werkwijzen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const mag = magIk(rechten, 'recepten')
  const term = zoek.trim().toLowerCase()
  const gevonden = term
    ? data.filter((w) => [w.naam, w.omschrijving].filter(Boolean).join(' ').toLowerCase().includes(term))
    : data

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Kopje>Werkwijzen</Kopje>
        {mag && (
          <Link
            to="/werkwijzen/nieuw"
            data-touch
            className="inline-flex items-center gap-2 rounded-[4px] bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Werkwijze schrijven
          </Link>
        )}
      </div>

      {data.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className={invoer}
            placeholder="Zoeken"
            aria-label="Werkwijzen zoeken"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
      )}

      {data.length === 0 ? (
        <Leeg
          titel="Nog geen werkwijzen"
          uitleg={
            mag
              ? 'Schrijf uitleg met stappen en foto’s, en koppel die aan een MEP-taak of een taak op een werklijst. Dan staat het klaar op het moment dat iemand denkt: hoe ging dat ook alweer?'
              : 'Er staat hier nog niets in.'
          }
        />
      ) : gevonden.length === 0 ? (
        <Leeg titel="Niets gevonden" uitleg={`Geen werkwijze met "${zoek}" erin.`} />
      ) : (
        <Kaart>
          {gevonden.map((w) => (
            <Link
              key={w.id}
              to={`/werkwijzen/${w.id}`}
              data-touch
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <ListOrdered className="size-5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${w.actief ? '' : 'text-muted line-through'}`}>
                  {w.naam}
                </span>
                {w.omschrijving && (
                  <span className="block truncate text-sm text-muted">{w.omschrijving}</span>
                )}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </Kaart>
      )}

      {!mag && data.length > 0 && (
        <p className="max-w-prose text-sm text-muted">
          Lezen mag iedereen. Schrijven doet Sander, of iemand die hij daarvoor
          heeft aangewezen.
        </p>
      )}
      {mag && (
        <Knop soort="rustig" className="w-fit" onClick={() => refetch()}>
          Lijst verversen
        </Knop>
      )}
    </div>
  )
}
