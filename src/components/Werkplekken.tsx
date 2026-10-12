import { Kaart, Kopje } from './ui'
import { NiveauKeuze } from './NiveauKeuze'
import type { Persoon } from '../lib/personeel'
import { niveauVan, useNiveaus, useWerkplekken } from '../lib/spits'

/* Waar deze medewerker in de avondspits kan staan.
 *
 * Hetzelfde als op het scherm Rooster → Werkplekken, maar dan voor één
 * persoon. Dat scherm is om in één keer iedereen langs te gaan; dit is waar je
 * het aanpast als je het over iemand hebt. */

export function Werkplekken({ persoon }: { persoon: Persoon }) {
  const plekken = useWerkplekken()
  const niveaus = useNiveaus()

  if (!plekken.data || !niveaus.data) return null
  const actief = plekken.data.filter((w) => w.actief)
  if (actief.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Werkplekken in de spits</Kopje>
      <Kaart className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {actief.map((w) => (
          <div key={w.id} className="flex flex-col gap-1">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
              {w.naam}
            </span>
            <NiveauKeuze
              medewerkerId={persoon.id}
              werkplekId={w.id}
              waarde={niveauVan(niveaus.data, persoon.id, w.id)}
              naam={`${persoon.voornaam ?? 'Deze medewerker'} op ${w.naam}`}
            />
          </div>
        ))}
      </Kaart>
      <p className="text-sm text-muted">
        "Nooit" is een harde grens: daar wordt hij niet ingedeeld, ook niet als het die avond beter
        uitkwam. "Onbekend" betekent nog niet beoordeeld.
      </p>
    </section>
  )
}
