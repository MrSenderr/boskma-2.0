import { useState } from 'react'
import { Search } from 'lucide-react'
import { Kaart, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { dagEnDatum, euro } from '../lib/inkoop'
import {
  STANDAARD,
  doelVan,
  metKostprijzen,
  useDoelen,
  useLaatstePrijzen,
  zoek,
  type Artikel,
  type Doelen,
} from '../lib/stuksprijzen'
import { adviesprijs } from '../lib/verpakking'

/* Wat kost één stuk, één kilo, één liter — op de laatst betaalde prijs.

   Bij bulk (een emmer of zak van een kilo of meer) is de prijs per stuk de
   prijs van de hele verpakking. Daar staat geen advies bij, want de prijs van
   een emmer zegt niets over wat je voor een portie moet vragen. */

/** Kleine bedragen in drie cijfers: het verschil tussen 21 en 21,3 cent per
 *  stuk is bij duizend stuks een tientje. */
function cent(n: number | null): string {
  if (n === null) return '—'
  return n < 1
    ? `€ ${n.toLocaleString('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
    : euro(n)
}

const RIJ = 'grid grid-cols-[1fr_auto] md:grid-cols-[1fr_6rem_6rem_6rem_6rem] items-baseline gap-x-3 gap-y-1'

function Kop() {
  return (
    <div
      className={`${RIJ} hidden border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid`}
    >
      <span>Artikel</span>
      <span className="text-right">Per stuk</span>
      <span className="text-right">Per kilo</span>
      <span className="text-right">Per liter</span>
      <span className="text-right">Advies</span>
    </div>
  )
}

function Rij({ a, doelen }: { a: Artikel; doelen: Doelen }) {
  const bulk = a.verpakking?.bulk ?? false
  const doel = doelVan(a.groep, doelen)
  const advies = bulk ? null : adviesprijs(a.perStuk, doel, doelen.btw)

  return (
    <div className={`${RIJ} border-b border-line px-4 py-3 last:border-0`}>
      <span>
        {a.naam}
        <span className="block text-xs text-muted">
          {[a.merk, a.inhoud, a.artikelnr].filter(Boolean).join(' · ')}
        </span>
      </span>

      <span className="text-right tabular-nums md:hidden">{euro(a.prijs)}</span>

      <span className="hidden text-right tabular-nums md:block">
        {cent(a.perStuk)}
        {bulk && <span className="block text-xs text-muted">per verpakking</span>}
      </span>
      <span className="hidden text-right tabular-nums md:block">{cent(a.perKilo)}</span>
      <span className="hidden text-right tabular-nums md:block">{cent(a.perLiter)}</span>
      <span className="hidden text-right tabular-nums md:block">
        {advies === null ? (
          <span className="text-muted">—</span>
        ) : (
          <>
            <span className="font-semibold">{euro(advies)}</span>
            <span className="block text-xs text-muted">bij {(doel * 100).toFixed(0)}%</span>
          </>
        )}
      </span>

      <span className="col-span-full text-sm text-muted md:hidden">
        {[
          a.perStuk !== null && `${cent(a.perStuk)} per ${bulk ? 'verpakking' : 'stuk'}`,
          a.perKilo !== null && `${cent(a.perKilo)} per kilo`,
          a.perLiter !== null && `${cent(a.perLiter)} per liter`,
          advies !== null && `advies ${euro(advies)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  )
}

function Cijfer({ waarde, bij, kleur }: { waarde: string; bij: string; kleur?: string }) {
  return (
    <Kaart className="p-4">
      <p className={`font-display text-2xl tabular-nums ${kleur ?? ''}`}>{waarde}</p>
      <p className="mt-1 text-sm text-muted">{bij}</p>
    </Kaart>
  )
}

export function InkoopStuksprijzen() {
  const [term, setTerm] = useState('')
  const prijzen = useLaatstePrijzen()
  const doelenVraag = useDoelen()

  if (prijzen.isPending || doelenVraag.isPending) return <Laden tekst="Prijzen omrekenen…" />
  if (prijzen.error)
    return <Mislukt tekst={prijzen.error.message} opnieuw={() => prijzen.refetch()} />
  if (doelenVraag.error)
    return <Mislukt tekst={doelenVraag.error.message} opnieuw={() => doelenVraag.refetch()} />

  const doelen = doelenVraag.data ?? STANDAARD
  const { bekend, onbekend } = metKostprijzen(prijzen.data)
  const gevonden = zoek(bekend, term)

  if (bekend.length === 0 && onbekend.length === 0) {
    return <Leeg titel="Nog geen prijzen" uitleg="Zodra er een factuur is uitgelezen staat hier wat een stuk kost." />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cijfer waarde={String(bekend.length)} bij="artikelen omgerekend" />
        <Cijfer waarde={String(bekend.filter((a) => a.perKilo).length)} bij="met een kiloprijs" />
        <Cijfer
          waarde={String(onbekend.length)}
          bij="verpakking onbekend"
          kleur={onbekend.length ? 'text-warn' : undefined}
        />
      </div>

      <p className="text-sm text-muted">
        Op de laatst betaalde prijs. Bij bulk — een emmer of zak van een kilo of meer — is de prijs
        per stuk de prijs per <strong className="font-semibold text-text">verpakking</strong>, niet
        per portie; kijk daar naar de kilo- of literprijs. <strong className="font-semibold text-text">Advies</strong>{' '}
        is wat je voor een stuk zou moeten vragen om je doel te halen, inclusief{' '}
        {(doelen.btw * 100).toFixed(0)}% btw en naar boven afgerond op vijf cent.
      </p>

      <label className="flex items-center gap-2 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Zoek op naam, merk of artikelnummer"
          aria-label="Zoek een artikel"
          className="w-full bg-transparent outline-none"
        />
      </label>

      {gevonden.length === 0 ? (
        <Leeg titel="Niets gevonden" uitleg={`Geen artikel met "${term}" erin.`} />
      ) : (
        <Kaart className="flex flex-col py-2">
          <Kop />
          {gevonden.map((a) => (
            <Rij key={`${a.leverancier_id}-${a.artikelnr}`} a={a} doelen={doelen} />
          ))}
        </Kaart>
      )}

      {onbekend.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Verpakking onbekend</h2>
          <p className="text-sm text-muted">
            Hiervan staat de inhoud zo op de factuur dat er niets uit te rekenen valt. Ze staan hier
            zodat je ze ziet — weglaten zou de lijst compleet laten lijken terwijl hij dat niet is.
          </p>
          <Kaart className="flex flex-col py-2">
            {onbekend.map((a) => (
              <div
                key={`${a.leverancier_id}-${a.artikelnr}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line px-4 py-2 last:border-0"
              >
                <span>
                  {a.naam}
                  <span className="block text-xs text-muted">
                    {[a.merk, a.artikelnr].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  {a.inhoud ? <Pil soort="letop">{a.inhoud}</Pil> : <Pil soort="letop">geen inhoud</Pil>}
                  <span className="tabular-nums">{euro(a.prijs)}</span>
                </span>
              </div>
            ))}
          </Kaart>
        </section>
      )}

      <p className="text-sm text-muted">
        Prijzen van de laatste factuur waarop het artikel stond — de nieuwste is van{' '}
        {dagEnDatum(
          [...prijzen.data].sort((a, b) => b.factuurdatum.localeCompare(a.factuurdatum))[0]
            ?.factuurdatum,
        )}
        .
      </p>
    </div>
  )
}
