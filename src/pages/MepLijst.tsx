import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import {
  ZONDER_GROEP,
  groepenVan,
  useMepTaakAanUit,
  useMepTaakBewaren,
  useMepTaken,
  type MepTaak,
} from '../lib/mep'

/* De vaste voorbereidingslijst. Zie docs/Modules/mep.md. Alleen te zien voor wie
   het recht 'mep' heeft; de database bewaakt dat, dit scherm verbergt alleen. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const NIEUWE_GROEP = '__nieuw__'

type Concept = { id?: number; naam: string; groep: string; toelichting: string; volgorde: number }

function Formulier({
  concept,
  groepen,
  onWijzig,
  onBewaar,
  onAnnuleer,
  bezig,
}: {
  concept: Concept
  groepen: string[]
  onWijzig: (c: Concept) => void
  onBewaar: () => void
  onAnnuleer: () => void
  bezig: boolean
}) {
  const [nieuweGroep, setNieuweGroep] = useState(
    concept.groep !== '' && !groepen.includes(concept.groep),
  )

  return (
    <Kaart className="flex flex-col gap-4 border-accent p-4">
      <Veld
        label="Taak"
        placeholder="Bijvoorbeeld: Pindasaus maken"
        value={concept.naam}
        autoFocus
        onChange={(e) => onWijzig({ ...concept, naam: e.target.value })}
      />
      <Veld
        label="Toelichting"
        placeholder="Optioneel — het kleine regeltje eronder"
        value={concept.toelichting}
        onChange={(e) => onWijzig({ ...concept, toelichting: e.target.value })}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-muted" htmlFor="m-groep">
          Groep
        </label>
        {nieuweGroep ? (
          <>
            <input
              id="m-groep"
              className={invoer}
              placeholder="bijv. sauzen"
              autoFocus
              value={concept.groep}
              onChange={(e) => onWijzig({ ...concept, groep: e.target.value })}
            />
            <button
              type="button"
              className="w-fit text-sm font-semibold text-muted underline hover:text-text"
              onClick={() => {
                setNieuweGroep(false)
                onWijzig({ ...concept, groep: groepen[0] ?? '' })
              }}
            >
              Toch een bestaande groep kiezen
            </button>
          </>
        ) : (
          <select
            id="m-groep"
            className={invoer}
            value={groepen.includes(concept.groep) ? concept.groep : ''}
            onChange={(e) => {
              if (e.target.value === NIEUWE_GROEP) {
                setNieuweGroep(true)
                onWijzig({ ...concept, groep: '' })
              } else {
                onWijzig({ ...concept, groep: e.target.value })
              }
            }}
          >
            <option value="">Kies een groep…</option>
            {groepen.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value={NIEUWE_GROEP}>Nieuwe groep…</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" bezig={bezig} disabled={!concept.naam.trim()} onClick={onBewaar}>
          Bewaren
        </Knop>
        <Knop soort="rustig" onClick={onAnnuleer}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}

export function MepLijst() {
  const { data, isPending, error, refetch } = useMepTaken(true)
  const bewaren = useMepTaakBewaren()
  const aanUit = useMepTaakAanUit()
  const [concept, setConcept] = useState<Concept | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Lijst laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const groepen = groepenVan(data)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {data.filter((t) => t.actief).length} actief van {data.length}
        </p>
        {!concept && (
          <Knop
            soort="rustig"
            onClick={() =>
              setConcept({ naam: '', groep: groepen[0] ?? '', toelichting: '', volgorde: 999 })
            }
          >
            <Plus className="size-4" aria-hidden />
            Taak toevoegen
          </Knop>
        )}
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {concept && (
        <Formulier
          key={concept.id ?? 'nieuw'}
          concept={concept}
          groepen={groepen.filter((g) => g !== ZONDER_GROEP)}
          onWijzig={setConcept}
          onBewaar={() =>
            bewaren.mutate(
              { ...concept, actief: true },
              { onSuccess: () => setConcept(null), onError: (e) => setFout(e.message) },
            )
          }
          onAnnuleer={() => setConcept(null)}
          bezig={bewaren.isPending}
        />
      )}

      {groepen.map((groep) => {
        const inGroep = data.filter((t) => (t.groep?.trim() || ZONDER_GROEP) === groep)
        if (inGroep.length === 0) return null
        return (
          <section key={groep} className="flex flex-col gap-2">
            <Kopje>{groep}</Kopje>
            <Kaart>
              {inGroep.map((t: MepTaak) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <span className={`min-w-0 flex-1 ${t.actief ? '' : 'text-muted line-through'}`}>
                    <span className="block font-medium">{t.naam}</span>
                    {t.toelichting && (
                      <span className="block text-sm text-muted">{t.toelichting}</span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setConcept({
                        id: t.id,
                        naam: t.naam,
                        groep: t.groep ?? '',
                        toelichting: t.toelichting ?? '',
                        volgorde: t.volgorde,
                      })
                    }
                    className="min-h-11 rounded-[4px] px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text"
                  >
                    Wijzigen
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      aanUit.mutate(
                        { id: t.id, actief: !t.actief },
                        { onError: (e) => setFout(e.message) },
                      )
                    }
                    aria-pressed={t.actief}
                    className={`min-h-11 rounded-[4px] px-3 text-sm font-semibold ${
                      t.actief ? 'border border-line-strong hover:bg-surface-2' : 'bg-brand text-on-brand'
                    }`}
                  >
                    {t.actief ? 'Uitzetten' : 'Aanzetten'}
                  </button>
                </div>
              ))}
            </Kaart>
          </section>
        )
      })}

      <p className="max-w-prose text-sm text-muted">
        Uitzetten haalt een taak van de avondlijst zonder hem weg te gooien — ijs in
        de winter uit, in de zomer weer aan. Wat er in oude lijsten staat blijft
        gewoon staan.
      </p>
    </div>
  )
}
