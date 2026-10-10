import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt } from '../components/ui'
import {
  dagEnDatum,
  euro,
  getal,
  klopt,
  useInkoopFacturen,
  type Factuuroverzicht,
} from '../lib/inkoop'

/* Alle inkoopfacturen op een rij.

   De belangrijkste kolom is "verschil": de som van de regels plus de btw hoort
   precies het te betalen bedrag te zijn. Staat daar iets anders dan nul, dan
   is de factuur verkeerd uitgelezen en telt hij nergens in mee. Die wil je dus
   meteen zien, niet wegstoppen achter een vinkje. */

const RIJ =
  'grid grid-cols-[1fr_auto] md:grid-cols-[7rem_7rem_1fr_4rem_7rem_7rem] items-baseline gap-x-3 gap-y-1'

function Kop() {
  return (
    <div
      className={`${RIJ} hidden border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid`}
    >
      <span>Factuur</span>
      <span>Datum</span>
      <span>Referentie</span>
      <span className="text-right">Regels</span>
      <span className="text-right">Btw</span>
      <span className="text-right">Te betalen</span>
    </div>
  )
}

function Rij({ f }: { f: Factuuroverzicht }) {
  const goed = klopt(f)
  return (
    <Link
      to={`/inkoop/documenten/${f.leverancier_id}/${encodeURIComponent(f.nummer)}`}
      className={`${RIJ} border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2`}
    >
      <span className="font-semibold">{f.nummer}</span>
      <span className="text-right tabular-nums md:order-last">{euro(f.totaal_incl)}</span>

      <span className="text-sm text-muted md:text-base md:text-text">{dagEnDatum(f.datum)}</span>
      <span className="hidden text-muted md:block">{f.referentie ?? '—'}</span>
      <span className="hidden text-right tabular-nums text-muted md:block">{f.regels}</span>
      <span className="hidden text-right tabular-nums text-muted md:block">{euro(f.btw)}</span>

      {!goed && (
        <span className="col-span-full flex items-center gap-1.5 text-sm font-semibold text-bad">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {f.status !== 'verwerkt'
            ? `Staat op ${f.status}${f.melding ? ` — ${f.melding}` : ''}`
            : `Telt niet mee: ${euro(f.verschil)} verschil tussen de regels en het te betalen bedrag`}
        </span>
      )}
    </Link>
  )
}

export function InkoopDocumenten() {
  const { data: facturen, isPending, error, refetch } = useInkoopFacturen()

  if (isPending) return <Laden tekst="Facturen ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const totaal = facturen.reduce((s, f) => s + getal(f.totaal_incl), 0)
  const nakijken = facturen.filter((f) => !klopt(f))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Kopje>Inkoopfacturen</Kopje>
        <p className="mt-1 text-sm text-muted">
          {facturen.length} facturen, samen {euro(totaal)} inclusief btw
        </p>
        {nakijken.length > 0 && (
          <p className="mt-2 text-sm text-bad">
            {nakijken.length === 1 ? 'Eén factuur telt' : `${nakijken.length} facturen tellen`} niet
            mee in de berekeningen. Ze staan hieronder met een rood regeltje.
          </p>
        )}
      </div>

      {facturen.length === 0 ? (
        <Leeg titel="Nog geen facturen" uitleg="Zodra er een factuur is uitgelezen staat hij hier." />
      ) : (
        <Kaart className="flex flex-col py-2">
          <Kop />
          {facturen.map((f) => (
            <Rij key={f.id} f={f} />
          ))}
        </Kaart>
      )}
    </div>
  )
}
