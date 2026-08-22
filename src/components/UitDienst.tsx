import { useState } from 'react'
import { Archive, Undo2 } from 'lucide-react'
import { Kaart, Knop, Kopje } from './ui'
import { korteDatum, usePersoonWijzigen, type Persoon } from '../lib/personeel'

function vandaag() {
  return new Date().toISOString().slice(0, 10)
}

export function UitDienst({ persoon: p }: { persoon: Persoon }) {
  const wijzig = usePersoonWijzigen(p.id)
  const [bevestigen, setBevestigen] = useState(false)
  const [datum, setDatum] = useState(vandaag)

  if (p.uit_dienst_op) {
    return (
      <section className="flex flex-col gap-3">
        <Kopje>Uit dienst</Kopje>
        <Kaart className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Archive className="size-4 shrink-0 text-muted" aria-hidden />
            <span>
              Uit dienst sinds {korteDatum(p.uit_dienst_op)}. Staat in het archief; alle
              gegevens blijven zichtbaar.
            </span>
          </div>
          <Knop soort="rustig" onClick={() => wijzig.mutate({ uit_dienst_op: null })}>
            <Undo2 className="size-4" aria-hidden />
            Toch weer in dienst
          </Knop>
        </Kaart>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Uit dienst</Kopje>
      <Kaart className="flex flex-col gap-3 p-4">
        {bevestigen ? (
          <>
            <p className="text-sm">
              Vanaf welke datum is deze medewerker uit dienst? Hij verdwijnt dan uit de
              lijst naar het archief — er wordt niets gewist en je kunt alles blijven
              inzien.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="uitdienst-datum" className="text-sm font-semibold text-muted">
                  Laatste dag
                </label>
                <input
                  id="uitdienst-datum"
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
                />
              </div>
              <Knop
                soort="gevaar"
                bezig={wijzig.isPending}
                onClick={() => {
                  wijzig.mutate({ uit_dienst_op: new Date(datum).toISOString() })
                  setBevestigen(false)
                }}
              >
                Naar het archief
              </Knop>
              <Knop soort="rustig" onClick={() => setBevestigen(false)}>
                Toch niet
              </Knop>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Werkt deze medewerker niet meer bij je? Dan gaat hij naar het archief.
            </p>
            <Knop soort="rustig" onClick={() => setBevestigen(true)}>
              <Archive className="size-4" aria-hidden />
              Uit dienst melden
            </Knop>
          </div>
        )}
      </Kaart>
    </section>
  )
}
