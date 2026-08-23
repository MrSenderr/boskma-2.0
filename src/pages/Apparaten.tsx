import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Thermometer, Trash2 } from 'lucide-react'
import { Kaart, Knop, Laden, Leeg, Mislukt, Pil, Veld } from '../components/ui'
import {
  MEETMOMENTEN,
  SOORTEN,
  grenzenTekst,
  soortVan,
  useApparaatBewaren,
  useApparaatVerplaatsen,
  useApparaatVerwijderen,
  useApparaten,
  type Apparaat,
  type Meetmoment,
} from '../lib/apparaten'

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

type Concept = {
  id?: number
  naam: string
  type: string
  min_temp: string
  max_temp: string
  meetmoment: Meetmoment
  opmerking: string
  actief: boolean
}

function leegConcept(): Concept {
  return { naam: '', type: 'koeling', min_temp: '0', max_temp: '7', meetmoment: 'opening', opmerking: '', actief: true }
}

function naarConcept(a: Apparaat): Concept {
  return {
    id: a.id,
    naam: a.naam,
    type: a.type,
    min_temp: a.min_temp === null ? '' : String(a.min_temp),
    max_temp: a.max_temp === null ? '' : String(a.max_temp),
    meetmoment: a.meetmoment,
    opmerking: a.opmerking ?? '',
    actief: a.actief,
  }
}

function Formulier({
  concept,
  onWijzig,
  onBewaar,
  onAnnuleer,
  bezig,
}: {
  concept: Concept
  onWijzig: (c: Concept) => void
  onBewaar: () => void
  onAnnuleer: () => void
  bezig: boolean
}) {
  return (
    <Kaart className="flex flex-col gap-4 border-accent p-4">
      <Veld
        label="Naam"
        placeholder="Bijvoorbeeld: Koelcel"
        value={concept.naam}
        autoFocus
        onChange={(e) => onWijzig({ ...concept, naam: e.target.value })}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-muted" htmlFor="soort">
          Soort
        </label>
        <select
          id="soort"
          className={invoer}
          value={concept.type}
          onChange={(e) => {
            // Bij een nieuw soort vullen we gangbare grenzen alvast in. Wie al
            // eigen waarden had ingevuld, raakt die niet kwijt bij het bewaren
            // van een bestaand apparaat.
            const s = soortVan(e.target.value)
            onWijzig({
              ...concept,
              type: e.target.value,
              min_temp: s.min === null ? '' : String(s.min),
              max_temp: s.max === null ? '' : String(s.max),
            })
          }}
        >
          {SOORTEN.map((s) => (
            <option key={s.waarde} value={s.waarde}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">
          Vult gangbare grenzen alvast in. Overschrijven mag — controleer ze aan je
          eigen hygiënecode.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Veld
          label="Ondergrens °C"
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="leeg = geen"
          value={concept.min_temp}
          onChange={(e) => onWijzig({ ...concept, min_temp: e.target.value })}
        />
        <Veld
          label="Bovengrens °C"
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="leeg = geen"
          value={concept.max_temp}
          onChange={(e) => onWijzig({ ...concept, max_temp: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-muted" htmlFor="meetmoment">
          Wanneer meten
        </label>
        <select
          id="meetmoment"
          className={invoer}
          value={concept.meetmoment}
          onChange={(e) => onWijzig({ ...concept, meetmoment: e.target.value as Meetmoment })}
        >
          {MEETMOMENTEN.map((m) => (
            <option key={m.waarde} value={m.waarde}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <Veld
        label="Toelichting"
        placeholder="Optioneel — bijvoorbeeld waar hij staat"
        value={concept.opmerking}
        onChange={(e) => onWijzig({ ...concept, opmerking: e.target.value })}
      />

      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" bezig={bezig} onClick={onBewaar} disabled={!concept.naam.trim()}>
          Bewaren
        </Knop>
        <Knop soort="rustig" onClick={onAnnuleer}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}

export function Apparaten() {
  const { data, isPending, error, refetch } = useApparaten()
  const bewaar = useApparaatBewaren()
  const verplaats = useApparaatVerplaatsen()
  const verwijder = useApparaatVerwijderen()
  const [concept, setConcept] = useState<Concept | null>(null)
  const [melding, setMelding] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Apparaten laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  function bewaren() {
    if (!concept) return
    setMelding(null)
    bewaar.mutate(
      {
        id: concept.id,
        naam: concept.naam.trim(),
        type: concept.type,
        min_temp: concept.min_temp === '' ? null : Number(concept.min_temp),
        max_temp: concept.max_temp === '' ? null : Number(concept.max_temp),
        meetmoment: concept.meetmoment,
        opmerking: concept.opmerking.trim() || null,
        actief: concept.actief,
      },
      { onSuccess: () => setConcept(null), onError: (e) => setMelding(e.message) },
    )
  }

  function verplaatsen(index: number, richting: -1 | 1) {
    if (!data) return
    const doel = index + richting
    if (doel < 0 || doel >= data.length) return
    const nieuw = [...data]
    ;[nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]]
    verplaats.mutate(nieuw.map((a, i) => ({ id: a.id, volgorde: i })))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          Jouw koelingen, vriezers en warmhoudunits. De volgorde hier is de volgorde
          waarin je mensen ze straks aftikken — zet ze in je looproute.
        </p>
        {!concept && (
          <Knop soort="primair" onClick={() => setConcept(leegConcept())}>
            <Plus className="size-4" aria-hidden />
            Apparaat toevoegen
          </Knop>
        )}
      </div>

      {melding && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
          {melding}
        </p>
      )}

      {concept && (
        <Formulier
          concept={concept}
          onWijzig={setConcept}
          onBewaar={bewaren}
          onAnnuleer={() => setConcept(null)}
          bezig={bewaar.isPending}
        />
      )}

      {data.length === 0 && !concept ? (
        <Leeg
          titel="Nog geen apparaten"
          uitleg="Voeg je koelingen en vriezers toe. Daarna verschijnen ze vanzelf in de temperatuurronde."
          actie={
            <Knop soort="primair" onClick={() => setConcept(leegConcept())}>
              <Plus className="size-4" aria-hidden />
              Eerste apparaat toevoegen
            </Knop>
          }
        />
      ) : (
        <Kaart>
          {data.map((a, i) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <Thermometer className="size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.naam}
                  {!a.actief && <Pil soort="neutraal">Niet actief</Pil>}
                </p>
                <p className="text-sm text-muted">
                  {soortVan(a.type).label} · {grenzenTekst(a)} ·{' '}
                  {MEETMOMENTEN.find((m) => m.waarde === a.meetmoment)?.label.toLowerCase()}
                  {a.opmerking ? ` · ${a.opmerking}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`${a.naam} omhoog`}
                  disabled={i === 0}
                  onClick={() => verplaatsen(i, -1)}
                  className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 disabled:opacity-30"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`${a.naam} omlaag`}
                  disabled={i === data.length - 1}
                  onClick={() => verplaatsen(i, 1)}
                  className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 disabled:opacity-30"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Knop soort="rustig" onClick={() => setConcept(naarConcept(a))}>
                  Wijzigen
                </Knop>
                <Knop
                  soort="rustig"
                  onClick={() => bewaar.mutate({ id: a.id, naam: a.naam, actief: !a.actief })}
                >
                  {a.actief ? 'Op non-actief' : 'Weer actief'}
                </Knop>
                <button
                  type="button"
                  aria-label={`${a.naam} verwijderen`}
                  onClick={() => {
                    setMelding(null)
                    verwijder.mutate(a.id, { onError: (e) => setMelding(e.message) })
                  }}
                  className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </Kaart>
      )}

      <p className="max-w-prose text-sm text-muted">
        Een apparaat dat weggaat zet je op non-actief. Verwijderen kan alleen zolang
        er nog nooit mee gemeten is — anders zouden de metingen van vorig jaar uit je
        logboek verdwijnen, en dat is precies wat je bij een controle wél wilt kunnen
        laten zien.
      </p>
    </div>
  )
}
