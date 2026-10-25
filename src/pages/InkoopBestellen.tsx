import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Plus } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { euro } from '../lib/inkoop'
import { Breed } from '../lib/breedte'
import {
  DAGNAAM,
  alsTekst,
  leverdagenVan,
  regelbedrag,
  useBestelpatroon,
  voorgesteldAantal,
  voorstelVoor,
  volgendeDatum,
  type Bestelregel,
} from '../lib/bestellen'

/* Wat moet er deze dinsdag besteld worden?
 *
 * De inkoopmodule liet vooral zien wat er ooit is binnengekomen. Dit is de
 * eerste pagina die een vraag beantwoordt die je werkelijk hebt.
 *
 * Hij stelt voor, hij bestelt niet. Wat er nog in de vriezer ligt weet de app
 * niet, dus het voorgestelde aantal is een beginpunt dat je bijstelt — geen
 * uitkomst. Onderaan komt er een lijst uit die je kopieert en doorgeeft langs
 * de weg die je al gebruikt.
 *
 * Twee lijsten en niet één. Wat je bijna elke keer bestelt staat aangevinkt
 * klaar; wat je soms bestelt staat eronder, uit, als geheugensteun. Alles in
 * één lijst zetten zou betekenen dat je honderdzeventig regels moet nalopen om
 * er twintig over te houden.
 */

const getal = (w: number | string | null | undefined): number =>
  w === null || w === undefined || w === '' ? 0 : Number(w) || 0

type Keuzes = Record<string, { aan: boolean; aantal: number }>

const sleutelVan = (r: Bestelregel) => `${r.leverancier_id}-${r.artikelnr}`

function Regel({
  r,
  keuze,
  onZet,
}: {
  r: Bestelregel
  keuze: { aan: boolean; aantal: number }
  onZet: (k: { aan: boolean; aantal: number }) => void
}) {
  const gemiddeld = getal(r.gemiddeld)
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-0 ${
        keuze.aan ? '' : 'opacity-60'
      }`}
    >
      <input
        type="checkbox"
        checked={keuze.aan}
        onChange={(e) => onZet({ ...keuze, aan: e.target.checked })}
        aria-label={`${r.naam ?? r.artikelnr} meenemen`}
        className="size-5 shrink-0 accent-accent"
      />

      <span className="min-w-[11rem] flex-1">
        <span className="block truncate font-medium">{r.naam ?? r.artikelnr}</span>
        <span className="block text-sm text-muted">
          {r.keer} van de {r.leverdagen} keer · gemiddeld{' '}
          {String(gemiddeld).replace('.', ',')}
          {r.eenheid ? ` ${r.eenheid}` : ''}
        </span>
      </span>

      <label className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-muted">aantal</span>
        <input
          type="number"
          min="0"
          step="0.5"
          value={String(keuze.aantal)}
          onChange={(e) =>
            onZet({ aan: true, aantal: e.target.value === '' ? 0 : Number(e.target.value) })
          }
          className="w-20 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 py-1.5 text-right text-base tabular-nums outline-none focus:border-accent"
        />
      </label>

      <span className="hidden w-20 shrink-0 text-right tabular-nums text-muted sm:block">
        {r.laatste_prijs === null ? '—' : euro(regelbedrag(r, keuze.aantal))}
      </span>
    </div>
  )
}

function PerLeverancier({
  regels,
  keuzes,
  onZet,
}: {
  regels: Bestelregel[]
  keuzes: Keuzes
  onZet: (sleutel: string, k: { aan: boolean; aantal: number }) => void
}) {
  /* Gegroepeerd per leverancier: je bestelt bij Veldboer en bij Het Grootslag
     apart, dus loop je ze ook apart na. */
  const groepen = new Map<string, Bestelregel[]>()
  for (const r of regels) {
    const naam = r.leveranciernaam ?? 'Onbekende leverancier'
    groepen.set(naam, [...(groepen.get(naam) ?? []), r])
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groepen.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([naam, lijst]) => (
          <section key={naam} className="flex flex-col gap-2">
            <h3 className="font-display text-lg">{naam}</h3>
            <Kaart className="flex flex-col py-1">
              {lijst.map((r) => {
                const s = sleutelVan(r)
                return (
                  <Regel
                    key={s}
                    r={r}
                    keuze={keuzes[s] ?? { aan: false, aantal: voorgesteldAantal(r.gemiddeld) }}
                    onZet={(k) => onZet(s, k)}
                  />
                )
              })}
            </Kaart>
          </section>
        ))}
    </div>
  )
}

export function InkoopBestellen() {
  const { data, isPending, error, refetch } = useBestelpatroon()
  const [dag, setDag] = useState<number | null>(null)
  const [keuzes, setKeuzes] = useState<Keuzes>({})
  const [toonSoms, setToonSoms] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)

  const dagen = useMemo(() => leverdagenVan(data ?? []), [data])
  const gekozen = dag ?? dagen[0]?.dagnr ?? null
  const voorstel = useMemo(
    () => (gekozen === null ? { vast: [], soms: [] } : voorstelVoor(data ?? [], gekozen)),
    [data, gekozen],
  )

  /* De beginstand: wat je bijna altijd bestelt staat aan, met het voorgestelde
     aantal. Pas als je iets aanraakt gaat het in `keuzes` staan. */
  function keuzeVan(r: Bestelregel, standaardAan: boolean) {
    return keuzes[sleutelVan(r)] ?? { aan: standaardAan, aantal: voorgesteldAantal(r.gemiddeld) }
  }

  function zet(sleutel: string, k: { aan: boolean; aantal: number }) {
    setKeuzes((o) => ({ ...o, [sleutel]: k }))
    setGekopieerd(false)
  }

  if (isPending) return <Laden tekst="Bestelpatroon uitrekenen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (dagen.length === 0) {
    return (
      <Leeg
        titel="Nog geen patroon te zien"
        uitleg="Zodra er een paar weken facturen met afleverdatum binnen zijn, kan de app laten zien wat je op welke dag bestelt."
      />
    )
  }

  const meegenomen = [...voorstel.vast, ...voorstel.soms]
    .map((r) => ({ regel: r, keuze: keuzeVan(r, voorstel.vast.includes(r)) }))
    .filter((x) => x.keuze.aan && x.keuze.aantal > 0)
  const bedrag = meegenomen.reduce((s, x) => s + regelbedrag(x.regel, x.keuze.aantal), 0)
  const dagnaam = DAGNAAM[gekozen ?? 0] ?? ''
  const datum =
    gekozen === null
      ? undefined
      : new Date(`${volgendeDatum(gekozen)}T12:00:00`).toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'long',
        })

  async function kopieer() {
    const tekst = alsTekst(
      meegenomen.map((x) => ({ regel: x.regel, aantal: x.keuze.aantal })),
      dagnaam,
      datum,
    )
    try {
      await navigator.clipboard.writeText(tekst)
      setGekopieerd(true)
    } catch {
      // Lukt het kopiëren niet, dan moet de tekst alsnog te pakken zijn.
      window.prompt('Kopieer de lijst:', tekst)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breed />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Wat je de afgelopen twaalf weken op deze dag bestelde. De app stelt voor; wat er nog ligt
          weet hij niet, dus de aantallen zijn een beginpunt.
        </p>
        <div className="flex flex-wrap gap-2">
          {dagen.map((d) => (
            <button
              key={d.dagnr}
              type="button"
              onClick={() => {
                setDag(d.dagnr)
                setKeuzes({})
                setGekopieerd(false)
              }}
              className={`rounded-card border-[1.5px] px-4 py-2 text-left transition-colors ${
                d.dagnr === gekozen
                  ? 'border-accent bg-surface-2'
                  : 'border-line-strong hover:border-accent hover:bg-surface-2'
              }`}
            >
              <span className="block font-semibold capitalize">{d.naam}</span>
              <span className="block text-sm text-muted">{d.leverdagen} keer geleverd</span>
            </button>
          ))}
        </div>
      </div>

      {voorstel.vast.length === 0 ? (
        <Kaart className="p-5">
          <p className="text-sm text-muted">
            Op {dagnaam} is er niets dat je meestal bestelt. Kijk bij “soms besteld” hieronder.
          </p>
        </Kaart>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <Kopje>Meestal besteld</Kopje>
            <span className="text-sm text-muted">{voorstel.vast.length} artikelen</span>
          </div>
          <PerLeverancier
            regels={voorstel.vast}
            keuzes={Object.fromEntries(
              voorstel.vast.map((r) => [sleutelVan(r), keuzeVan(r, true)]),
            )}
            onZet={zet}
          />
        </section>
      )}

      {voorstel.soms.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setToonSoms((v) => !v)}
            className="flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-text"
          >
            <Plus className="size-4" aria-hidden />
            Soms besteld ({voorstel.soms.length})
            <span aria-hidden>{toonSoms ? '▾' : '▸'}</span>
          </button>
          {toonSoms && (
            <PerLeverancier
              regels={voorstel.soms}
              keuzes={Object.fromEntries(
                voorstel.soms.map((r) => [sleutelVan(r), keuzeVan(r, false)]),
              )}
              onZet={zet}
            />
          )}
        </section>
      )}

      {/* De uitkomst: een lijst om door te geven. */}
      <Kaart className="flex flex-col gap-3 p-4">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-2xl tabular-nums">{meegenomen.length}</span>
          <span className="text-muted">
            {meegenomen.length === 1 ? 'artikel' : 'artikelen'} voor {dagnaam}
            {datum ? ` ${datum}` : ''}
          </span>
          {bedrag > 0 && (
            <span className="text-muted">
              · ongeveer <span className="tabular-nums">{euro(bedrag)}</span>
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Knop onClick={kopieer} disabled={meegenomen.length === 0}>
            <ClipboardCopy className="size-4" aria-hidden />
            Kopieer de lijst
          </Knop>
          {gekopieerd && (
            <Pil soort="goed">
              <Check className="size-3.5" aria-hidden /> gekopieerd
            </Pil>
          )}
        </div>

        <p className="text-sm text-muted">
          Het bedrag is een schatting op de laatst bekende prijs — acties en prijsstijgingen zitten
          er niet in. De app bestelt niets; je plakt de lijst in je eigen bestelling.
        </p>
      </Kaart>
    </div>
  )
}
