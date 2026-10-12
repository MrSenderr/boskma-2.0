import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, RotateCcw, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { dagnaam, datumKort, maandagVan, verschuif } from '../lib/rooster'
import { usePersonen } from '../lib/personeel'
import {
  NIVEAU,
  SPITS,
  isSpitsdag,
  maakIndeling,
  niveauVan,
  spitsVolk,
  stoelenVan,
  stoelnaam,
  useEerdereIndelingen,
  useIndeling,
  useIndelingVastleggen,
  useNiveaus,
  useSpitsShifts,
  useWerkplekken,
  volgendeSpitsdag,
  type Persoon,
  type Stoel,
} from '../lib/spits'

/* De indeling van de avondspits.
 *
 * De app rekent een voorstel uit de planning en de werkplekken; jij gooit om
 * wat je wil en legt het vast. Dat vastleggen is het punt: zonder dat is het
 * een rekenmachine die niemand gelooft, en heeft de app ook geen geheugen om
 * de volgende keer mee af te wisselen.
 *
 * Alleen wie er van 17 tot 20 is wordt ingedeeld. Wie om 19 uur weg moet staat
 * eronder, en die kun je er met de hand bij zetten. */

function schuif(datum: string, richting: 1 | -1): string {
  let d = verschuif(datum, richting)
  for (let i = 0; i < 7; i++) {
    if (isSpitsdag(d)) return d
    d = verschuif(d, richting)
  }
  return datum
}

function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE')
}

function Plek({
  stoel,
  gekozen,
  mogelijk,
  herhalingen,
  onKies,
}: {
  stoel: Stoel
  gekozen: Persoon | null
  /** Wie hier mag staan, met hoe goed het gaat. Wie op nooit staat zit er niet
   *  tussen — dat is een harde grens, ook met de hand. */
  mogelijk: { persoon: Persoon; niveau: ReturnType<typeof niveauVan> }[]
  herhalingen: number
  onKies: (medewerkerId: string | null) => void
}) {
  const niveau = gekozen ? mogelijk.find((m) => m.persoon.id === gekozen.id)?.niveau : null

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid sm:grid-cols-[9rem_1fr_11rem] sm:items-center sm:gap-4">
      <span className="font-semibold">{stoelnaam(stoel)}</span>

      <select
        aria-label={`Wie staat op ${stoelnaam(stoel)}`}
        value={gekozen?.id ?? ''}
        onChange={(e) => onKies(e.target.value || null)}
        className={`w-full rounded-[4px] border-[1.5px] bg-bg px-3 py-2 text-base outline-none focus:border-accent ${gekozen ? 'border-line-strong' : 'border-warn text-warn'}`}
      >
        <option value="">— onbezet —</option>
        {mogelijk.map((m) => (
          <option key={m.persoon.id} value={m.persoon.id}>
            {m.persoon.naam} ({NIVEAU[m.niveau].label.toLowerCase()})
          </option>
        ))}
      </select>

      <span className="flex flex-wrap items-center gap-2">
        {/* Op een telefoon staat het niveau al in de keuzelijst zelf. */}
        {niveau && (
          <span className="hidden sm:inline-block">
            <Pil soort={NIVEAU[niveau].soort}>{NIVEAU[niveau].label}</Pil>
          </span>
        )}
        {herhalingen >= 2 && (
          <span className="text-sm text-muted">{herhalingen + 1}e keer op deze plek</span>
        )}
      </span>
    </div>
  )
}

export function RoosterSpits() {
  const [datum, setDatum] = useState(() => volgendeSpitsdag(vandaagStr()))

  const personen = usePersonen()
  const plekken = useWerkplekken()
  const niveaus = useNiveaus()
  const shifts = useSpitsShifts(datum)
  const vastgelegd = useIndeling(datum)
  const eerder = useEerdereIndelingen(datum)
  const vastleggen = useIndelingVastleggen()

  /* Wat er nú op het scherm staat. Zolang dit null is volgt het scherm de
     vastgelegde indeling, of anders het voorstel. Zodra je iets omgooit houdt
     dit het vast — en springt het niet terug zodra er een vraag opnieuw
     binnenkomt. */
  const [eigen, setEigen] = useState<Map<string, string | null> | null>(null)
  useEffect(() => setEigen(null), [datum])

  const klaar =
    personen.data && plekken.data && niveaus.data && shifts.data && vastgelegd.data && eerder.data

  const fout =
    personen.error ?? plekken.error ?? niveaus.error ?? shifts.error ?? vastgelegd.error ?? eerder.error

  const namen = useMemo(
    () =>
      new Map(
        (personen.data ?? []).map((p) => [
          p.id,
          [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Naamloos',
        ]),
      ),
    [personen.data],
  )

  const stoelen = useMemo(() => stoelenVan(plekken.data ?? []), [plekken.data])
  const volk = useMemo(() => spitsVolk(shifts.data ?? [], namen), [shifts.data, namen])

  const voorstel = useMemo(
    () =>
      maakIndeling({
        stoelen,
        mensen: volk.heel.map((r) => r.persoon),
        niveaus: niveaus.data ?? new Map(),
        eerder: eerder.data ?? [],
      }),
    [stoelen, volk, niveaus.data, eerder.data],
  )

  /* De vastgelegde indeling gaat voor op het voorstel: wat jij hebt besloten
     hoort niet elke keer dat je het scherm opent te worden overschreven. */
  const basis = useMemo(() => {
    const uit = new Map<string, string | null>()
    const rijen = vastgelegd.data ?? []
    if (rijen.length > 0) {
      for (const s of stoelen) {
        const r = rijen.find((x) => x.werkplek_id === s.werkplek.id && x.plek === s.plek)
        uit.set(s.sleutel, r?.medewerker_id ?? null)
      }
      return uit
    }
    for (const p of voorstel.plekken) uit.set(p.stoel.sleutel, p.persoon?.id ?? null)
    return uit
  }, [vastgelegd.data, stoelen, voorstel])

  const huidig = eigen ?? basis

  if (fout)
    return (
      <Mislukt
        tekst={fout.message}
        opnieuw={() => {
          shifts.refetch()
          vastgelegd.refetch()
        }}
      />
    )
  if (!klaar) return <Laden tekst="Spits ophalen…" />

  // Wie je die avond kunt inzetten: de hele spits plus wie er deels is. Die
  // laatste doet de app niet vanzelf, met de hand mag het wel.
  const inzetbaar = [...volk.heel, ...volk.deels].map((r) => r.persoon)
  const perPlek = (stoel: Stoel) =>
    inzetbaar
      .map((persoon) => ({ persoon, niveau: niveauVan(niveaus.data, persoon.id, stoel.werkplek.id) }))
      .filter((m) => m.niveau !== 'nooit')
      .sort(
        (a, b) =>
          ['liefst', 'kan', 'onbekend', 'nood'].indexOf(a.niveau) -
            ['liefst', 'kan', 'onbekend', 'nood'].indexOf(b.niveau) ||
          a.persoon.naam.localeCompare(b.persoon.naam),
      )

  /** De lege plekken waar deze persoon wél mag staan. */
  const vrijVoor = (id: string) =>
    stoelen.filter(
      (s) => !huidig.get(s.sleutel) && niveauVan(niveaus.data, id, s.werkplek.id) !== 'nooit',
    )

  function kies(sleutel: string, medewerkerId: string | null) {
    const nieuw = new Map(huidig)
    // Iemand staat niet op twee plekken tegelijk: pak je hem hier, dan laat
    // hij de andere plek los.
    if (medewerkerId) for (const [s, id] of nieuw) if (id === medewerkerId) nieuw.set(s, null)
    nieuw.set(sleutel, medewerkerId)
    setEigen(nieuw)
  }

  const bezet = [...huidig.values()].filter(Boolean).length
  const ingedeeld = new Set([...huidig.values()].filter(Boolean) as string[])
  const over = inzetbaar.filter((p) => !ingedeeld.has(p.id))
  const leeg = stoelen.filter((s) => !huidig.get(s.sleutel))
  const isVastgelegd = (vastgelegd.data ?? []).length > 0
  const gewijzigd = eigen !== null
  const weekMaandag = maandagVan(datum)
  const vastOp = vastgelegd.data?.[0]?.vastgezet_op

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        De spits van {SPITS.van} tot {SPITS.tot}. De app verdeelt wie er die avond is over de
        werkplekken: de belangrijkste plek eerst, en daar de beste die er staat. Wat je hier omgooit
        blijft staan zodra je het vastlegt — en daarmee weet de app volgende keer ook wie er al vaak
        op dezelfde plek stond.
      </p>

      {/* ------------------------------------------------------- de avond --- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Knop
          soort="rustig"
          className="shrink-0"
          onClick={() => setDatum(schuif(datum, -1))}
          aria-label="Vorige avond"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Knop>
        {[4, 5, 6].map((i) => {
          const d = verschuif(weekMaandag, i)
          const aan = d === datum
          return (
            <button
              key={d}
              onClick={() => setDatum(d)}
              className={`shrink-0 whitespace-nowrap rounded-[4px] border px-3 py-2 text-sm font-semibold ${aan ? 'border-brand bg-brand text-on-brand' : 'border-line-strong hover:bg-surface-2'}`}
            >
              {dagnaam(d)} {datumKort(d)}
            </button>
          )
        })}
        <Knop
          soort="rustig"
          className="shrink-0"
          onClick={() => setDatum(schuif(datum, 1))}
          aria-label="Volgende avond"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Knop>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-xl">
          {dagnaam(datum, true)} {datumKort(datum)}
        </h2>
        {isVastgelegd ? (
          <Pil soort="goed">Vastgelegd</Pil>
        ) : (
          <Pil soort="neutraal">Voorstel</Pil>
        )}
        <span className="text-sm text-muted">
          {bezet} van de {stoelen.length} plekken bezet
        </span>
      </div>

      {volk.heel.length === 0 && volk.deels.length === 0 && (
        <Kaart className="border-warn p-4">
          <p className="font-semibold">Voor deze avond staat er nog niemand in de planning.</p>
          <p className="mt-1 text-sm text-muted">
            De planning komt uit eitje. Zodra die export binnen is staat het hier.
          </p>
        </Kaart>
      )}

      {/* ----------------------------------------------------- de indeling --- */}
      {stoelen.length > 0 && (
        <Kaart className="flex flex-col py-1">
          {stoelen.map((s) => {
            const id = huidig.get(s.sleutel) ?? null
            const persoon = id ? (inzetbaar.find((p) => p.id === id) ?? null) : null
            const uitVoorstel = voorstel.plekken.find((p) => p.stoel.sleutel === s.sleutel)
            return (
              <Plek
                key={s.sleutel}
                stoel={s}
                gekozen={persoon}
                mogelijk={perPlek(s)}
                herhalingen={
                  persoon && uitVoorstel?.persoon?.id === persoon.id ? uitVoorstel.herhalingen : 0
                }
                onKies={(wie) => kies(s.sleutel, wie)}
              />
            )
          })}
        </Kaart>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Knop
          bezig={vastleggen.isPending}
          onClick={() =>
            vastleggen.mutate(
              {
                datum,
                plekken: stoelen
                  .map((s) => ({ s, id: huidig.get(s.sleutel) }))
                  .filter((r): r is { s: Stoel; id: string } => Boolean(r.id))
                  .map(({ s, id }) => ({
                    werkplek_id: s.werkplek.id,
                    plek: s.plek,
                    medewerker_id: id,
                  })),
              },
              { onSuccess: () => setEigen(null) },
            )
          }
        >
          <Lock className="size-4" aria-hidden />
          {isVastgelegd ? 'Indeling bijwerken' : 'Indeling vastleggen'}
        </Knop>

        {gewijzigd && (
          <Knop soort="rustig" onClick={() => setEigen(null)}>
            <RotateCcw className="size-4" aria-hidden />
            Terug naar het voorstel
          </Knop>
        )}

        {isVastgelegd && !gewijzigd && (
          <Knop
            soort="gevaar"
            bezig={vastleggen.isPending}
            onClick={() => vastleggen.mutate({ datum, plekken: [] })}
          >
            <Trash2 className="size-4" aria-hidden />
            Weghalen
          </Knop>
        )}

        {vastleggen.error && <span className="text-sm text-bad">{vastleggen.error.message}</span>}
      </div>

      {isVastgelegd && vastOp && !gewijzigd && (
        <p className="text-sm text-muted">
          Vastgelegd op{' '}
          {new Date(vastOp).toLocaleString('nl-NL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
          . De medewerkers zien hun eigen plek in hun app.
        </p>
      )}

      {/* ------------------------------------------------------ de randen --- */}
      {leeg.length > 0 && (
        <Kaart className="border-warn p-4">
          <p className="font-semibold">
            {leeg.length === 1 ? 'Eén plek blijft onbezet' : `${leeg.length} plekken blijven onbezet`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {leeg.map(stoelnaam).join(', ')}.{' '}
            {!gewijzigd &&
              `Er zijn ${volk.heel.length} mensen voor ${stoelen.length} plekken — dit zijn de plekken met het laagste belang.`}
          </p>
        </Kaart>
      )}

      {volk.open > 0 && (
        <Kaart className="p-4">
          <p className="font-semibold">
            {volk.open === 1 ? 'Eén open dienst' : `${volk.open} open diensten`} in de planning
          </p>
          <p className="mt-1 text-sm text-muted">
            Er staat een dienst zonder naam. Zet in eitje iemand erop, dan rekent de app hem mee.
          </p>
        </Kaart>
      )}

      {over.length > 0 && (
        <section className="flex flex-col gap-2">
          <Kopje>Niet ingedeeld</Kopje>
          <Kaart className="flex flex-col py-2">
            {over.map((p) => {
              const kanNiks = stoelen.every(
                (s) => niveauVan(niveaus.data, p.id, s.werkplek.id) === 'nooit',
              )
              const deels = volk.deels.find((r) => r.persoon.id === p.id)
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-0"
                >
                  <span className="font-semibold">{p.naam}</span>
                  <span className="text-sm text-muted">
                    {kanNiks
                      ? 'Staat op elke plek op nooit'
                      : deels
                        ? `Alleen ${deels.tijd} — niet de hele spits`
                        : vrijVoor(p.id).length > 0
                          ? `Kan nog op ${vrijVoor(p.id).map(stoelnaam).join(', ')}`
                          : 'Alle plekken zijn bezet'}
                  </span>
                </div>
              )
            })}
          </Kaart>
        </section>
      )}

      {voorstel.plekken.some((p) => p.niveau === 'onbekend') && (
        <p className="text-sm text-muted">
          Op een paar plekken staat "onbekend": daar is nog niet ingevuld hoe goed het gaat. Dat vul
          je in bij Werkplekken, en dan wordt dit voorstel scherper.
        </p>
      )}
    </div>
  )
}
