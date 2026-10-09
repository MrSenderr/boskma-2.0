import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt, Pil } from '../components/ui'
import {
  dagenTeLaat,
  deelUitgaandIn,
  euro,
  kortDatum,
  nogTeOntvangen,
  useVerkoopfacturen,
  type Verkoopfactuur,
} from '../lib/verkoop'

/* Wat jij verstuurt. Bovenaan wat er nog binnen moet komen, want dat is de
   reden dat je hier kijkt. */

function Regel({ f }: { f: Verkoopfactuur }) {
  const telaat = dagenTeLaat(f)
  return (
    <Link
      to={`/facturen/uitgaand/${f.id}`}
      data-touch
      className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{f.klanten?.naam ?? 'Onbekende klant'}</span>
        <span className="mt-0.5 block text-sm text-muted">
          {f.nummer ? `Factuur ${f.nummer}` : 'Concept'}
          {f.onderwerp && ` · ${f.onderwerp}`}
          {f.vervaldatum && ` · vervalt ${kortDatum(f.vervaldatum)}`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block tabular-nums">{euro(Number(f.totaal_incl))}</span>
        {telaat > 0 && (
          <span className="mt-1 block">
            <Pil soort="fout">
              {telaat} {telaat === 1 ? 'dag' : 'dagen'} te laat
            </Pil>
          </span>
        )}
      </span>
    </Link>
  )
}

function Groep({ titel, lijst }: { titel: string; lijst: Verkoopfactuur[] }) {
  if (lijst.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted">
        {titel} ({lijst.length})
      </p>
      <Kaart>
        {lijst.map((f) => (
          <Regel key={f.id} f={f} />
        ))}
      </Kaart>
    </section>
  )
}

export function FacturenUitgaand() {
  const { data, isPending, error, refetch } = useVerkoopfacturen()

  if (isPending) return <Laden tekst="Facturen ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const d = deelUitgaandIn(data)
  const open = nogTeOntvangen(data)
  const telaat = d.verzonden.filter((f) => dagenTeLaat(f) > 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-display text-2xl tabular-nums">{euro(open)} nog te ontvangen</p>
        <p className="text-sm text-muted">
          {d.verzonden.length} {d.verzonden.length === 1 ? 'factuur' : 'facturen'} verstuurd en nog
          niet betaald
          {telaat.length > 0 && (
            <span className="text-bad">, waarvan {telaat.length} te laat</span>
          )}
          .
        </p>
      </div>

      <Link to="/facturen/uitgaand/nieuw" className="w-fit">
        <Knop soort="primair">
          <Plus className="size-4" aria-hidden />
          Nieuwe factuur
        </Knop>
      </Link>

      <Groep titel="Concepten" lijst={d.concepten} />
      <Groep titel="Verstuurd, nog niet betaald" lijst={d.verzonden} />
      <Groep titel="Betaald, laatste 60 dagen" lijst={d.betaald} />

      <div className="flex flex-col gap-2">
        {[
          { pad: '/facturen/klanten', label: 'Klanten' },
          { pad: '/facturen/prijslijst', label: 'Prijslijst' },
        ].map((l) => (
          <Link
            key={l.pad}
            to={l.pad}
            data-touch
            className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 hover:bg-surface-2"
          >
            <span className="flex-1 text-sm font-semibold">{l.label}</span>
            <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  )
}
