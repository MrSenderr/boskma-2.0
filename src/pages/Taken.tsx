import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Plus, Search, Trash2 } from 'lucide-react'
import { Kaart, Knop, Laden, Leeg, Mislukt, Pil, Veld } from '../components/ui'
import {
  LIJSTEN,
  RITMES,
  hoekLabel,
  hoekenVan,
  useTaakBewaren,
  useTaakVerplaatsen,
  useTaakVerwijderen,
  useTaken,
  type Lijst,
  type Ritme,
  type Taak,
} from '../lib/taken'

/* 126 taken. De hele kunst is dat je er nooit meer dan een handvol tegelijk
   ziet: eerst een lijst kiezen, dan een hoek openklappen. Zoeken kijkt door
   alles heen. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

type Concept = {
  id?: number
  naam: string
  lijst: Lijst
  hoek: string
  toelichting: string
  ritme: Ritme
}

function Formulier({
  concept,
  hoeken,
  onWijzig,
  onBewaar,
  onAnnuleer,
  bezig,
}: {
  concept: Concept
  hoeken: string[]
  onWijzig: (c: Concept) => void
  onBewaar: () => void
  onAnnuleer: () => void
  bezig: boolean
}) {
  return (
    <Kaart className="flex flex-col gap-4 border-accent p-4">
      <Veld
        label="Taak"
        placeholder="Bijvoorbeeld: Bakplaten aanzetten"
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-muted" htmlFor="t-lijst">
            Lijst
          </label>
          <select
            id="t-lijst"
            className={invoer}
            value={concept.lijst}
            onChange={(e) => onWijzig({ ...concept, lijst: e.target.value as Lijst })}
          >
            {LIJSTEN.map((l) => (
              <option key={l.waarde} value={l.waarde}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-muted" htmlFor="t-hoek">
            Hoek
          </label>
          <input
            id="t-hoek"
            list="hoeken"
            className={invoer}
            placeholder="bijv. keuken"
            value={concept.hoek}
            onChange={(e) => onWijzig({ ...concept, hoek: e.target.value })}
          />
          <datalist id="hoeken">
            {hoeken.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-muted" htmlFor="t-ritme">
            Hoe vaak
          </label>
          <select
            id="t-ritme"
            className={invoer}
            value={concept.ritme}
            onChange={(e) => onWijzig({ ...concept, ritme: e.target.value as Ritme })}
          >
            {RITMES.map((r) => (
              <option key={r.waarde} value={r.waarde}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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

function TaakRegel({
  taak,
  eerste,
  laatste,
  onWijzig,
  onVerplaats,
  onAanUit,
  onVerwijder,
}: {
  taak: Taak
  eerste: boolean
  laatste: boolean
  onWijzig: () => void
  onVerplaats: (richting: -1 | 1) => void
  onAanUit: () => void
  onVerwijder: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={taak.actief ? '' : 'text-muted line-through'}>{taak.naam}</span>
          {taak.ritme === 'wekelijks' && <Pil soort="letop">Wekelijks</Pil>}
          {!taak.actief && <Pil soort="neutraal">Uit</Pil>}
        </p>
        {taak.toelichting && <p className="text-sm text-muted">{taak.toelichting}</p>}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`${taak.naam} omhoog`}
          disabled={eerste}
          onClick={() => onVerplaats(-1)}
          className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`${taak.naam} omlaag`}
          disabled={laatste}
          onClick={() => onVerplaats(1)}
          className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
        <Knop soort="rustig" onClick={onWijzig}>
          Wijzigen
        </Knop>
        <Knop soort="rustig" onClick={onAanUit}>
          {taak.actief ? 'Uit' : 'Aan'}
        </Knop>
        <button
          type="button"
          aria-label={`${taak.naam} verwijderen`}
          onClick={onVerwijder}
          className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function Taken() {
  const { data, isPending, error, refetch } = useTaken()
  const bewaar = useTaakBewaren()
  const verplaats = useTaakVerplaatsen()
  const verwijder = useTaakVerwijderen()
  const [lijst, setLijst] = useState<Lijst>('openen')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [zoek, setZoek] = useState('')
  const [concept, setConcept] = useState<Concept | null>(null)

  const alleHoeken = useMemo(() => (data ? hoekenVan(data) : []), [data])

  if (isPending) return <Laden tekst="Taken laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const zoekterm = zoek.trim().toLowerCase()
  const zoekend = zoekterm.length > 1

  const gevonden = zoekend
    ? data.filter(
        (t) =>
          t.naam.toLowerCase().includes(zoekterm) ||
          (t.toelichting ?? '').toLowerCase().includes(zoekterm),
      )
    : []

  const vanLijst = data.filter((t) => t.lijst === lijst)
  const hoeken = hoekenVan(vanLijst)

  function bewaren() {
    if (!concept) return
    bewaar.mutate(
      {
        id: concept.id,
        naam: concept.naam.trim(),
        lijst: concept.lijst,
        hoek: concept.hoek.trim().toLowerCase() || null,
        toelichting: concept.toelichting.trim() || null,
        ritme: concept.ritme,
      },
      { onSuccess: () => setConcept(null) },
    )
  }

  function verplaatsen(inHoek: Taak[], index: number, richting: -1 | 1) {
    const doel = index + richting
    if (doel < 0 || doel >= inHoek.length) return
    const nieuw = [...inHoek]
    ;[nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]]
    // Alleen binnen de hoek herschikken; de bestaande nummers blijven het bereik.
    const nummers = inHoek.map((t) => t.volgorde ?? 0).sort((a, b) => a - b)
    verplaats.mutate(nieuw.map((t, i) => ({ id: t.id, volgorde: nummers[i] })))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* -------------------------------------------------------- kiezen --- */}
      <div className="flex flex-wrap items-center gap-2">
        {LIJSTEN.map((l) => {
          const aantal = data.filter((t) => t.lijst === l.waarde).length
          return (
            <button
              key={l.waarde}
              type="button"
              onClick={() => {
                setLijst(l.waarde)
                setOpen(new Set())
              }}
              className={`min-h-11 rounded-[4px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                lijst === l.waarde && !zoekend
                  ? 'bg-brand text-on-brand'
                  : 'border border-line-strong hover:bg-surface-2'
              }`}
            >
              {l.label} <span className="tabular-nums opacity-70">{aantal}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Zoek een taak"
            placeholder="Zoek in alle 126 taken…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            className={`${invoer} pl-9`}
          />
        </div>
        {!concept && (
          <Knop
            soort="primair"
            onClick={() =>
              setConcept({ naam: '', lijst, hoek: hoeken[0] ?? '', toelichting: '', ritme: 'dagelijks' })
            }
          >
            <Plus className="size-4" aria-hidden />
            Taak toevoegen
          </Knop>
        )}
      </div>

      {concept && (
        <Formulier
          concept={concept}
          hoeken={alleHoeken}
          onWijzig={setConcept}
          onBewaar={bewaren}
          onAnnuleer={() => setConcept(null)}
          bezig={bewaar.isPending}
        />
      )}

      {/* -------------------------------------------------------- zoeken --- */}
      {zoekend ? (
        gevonden.length === 0 ? (
          <Leeg titel="Niets gevonden" uitleg={`Geen taak met "${zoek}" erin.`} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {gevonden.length} {gevonden.length === 1 ? 'taak' : 'taken'} gevonden
            </p>
            <Kaart>
              {gevonden.map((t) => (
                <div key={t.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <p className="flex flex-wrap items-center gap-2">
                    {t.naam}
                    <span className="text-sm text-muted">
                      {LIJSTEN.find((l) => l.waarde === t.lijst)?.label} · {hoekLabel(t.hoek ?? 'overig')}
                    </span>
                  </p>
                  {t.toelichting && <p className="text-sm text-muted">{t.toelichting}</p>}
                  <div className="mt-1">
                    <Knop
                      soort="rustig"
                      onClick={() =>
                        setConcept({
                          id: t.id,
                          naam: t.naam,
                          lijst: (t.lijst ?? 'openen') as Lijst,
                          hoek: t.hoek ?? '',
                          toelichting: t.toelichting ?? '',
                          ritme: t.ritme,
                        })
                      }
                    >
                      Wijzigen
                    </Knop>
                  </div>
                </div>
              ))}
            </Kaart>
          </div>
        )
      ) : (
        /* -------------------------------------------------------- hoeken --- */
        <div className="flex flex-col gap-2">
          {hoeken.map((hoek) => {
            const inHoek = vanLijst.filter((t) => (t.hoek ?? 'Overig') === hoek)
            const uitgeklapt = open.has(hoek)
            return (
              <Kaart key={hoek}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((s) => {
                      const n = new Set(s)
                      if (n.has(hoek)) n.delete(hoek)
                      else n.add(hoek)
                      return n
                    })
                  }
                  aria-expanded={uitgeklapt}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  {uitgeklapt ? (
                    <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="flex-1 font-display text-base">{hoekLabel(hoek)}</span>
                  <span className="text-sm tabular-nums text-muted">
                    {inHoek.length} {inHoek.length === 1 ? 'taak' : 'taken'}
                  </span>
                </button>

                {uitgeklapt && (
                  <div className="border-t border-line">
                    {inHoek.map((t, i) => (
                      <TaakRegel
                        key={t.id}
                        taak={t}
                        eerste={i === 0}
                        laatste={i === inHoek.length - 1}
                        onWijzig={() =>
                          setConcept({
                            id: t.id,
                            naam: t.naam,
                            lijst: (t.lijst ?? lijst) as Lijst,
                            hoek: t.hoek ?? '',
                            toelichting: t.toelichting ?? '',
                            ritme: t.ritme,
                          })
                        }
                        onVerplaats={(r) => verplaatsen(inHoek, i, r)}
                        onAanUit={() => bewaar.mutate({ id: t.id, naam: t.naam, actief: !t.actief })}
                        onVerwijder={() => verwijder.mutate(t.id)}
                      />
                    ))}
                  </div>
                )}
              </Kaart>
            )
          })}
        </div>
      )}

      <p className="max-w-prose text-sm text-muted">
        De volgorde binnen een hoek is de volgorde waarin je mensen hem aftikken. Een
        taak die je even niet wilt zet je uit in plaats van weg te gooien — dan blijft
        hij in oude logboeken staan.
      </p>
    </div>
  )
}
