import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import {
  aantalTekst,
  dagEnDatum,
  euro,
  inBlokken,
  klopt,
  volledigeDatum,
  useInkoopFactuur,
  usePdfLink,
  type Blok,
  type Documentregel,
  type Factuuroverzicht,
} from '../lib/inkoop'

/* Eén inkoopfactuur, regel voor regel zoals hij gedrukt staat.

   De regels zijn gegroepeerd in leveringsblokken: per afleverdatum een blok.
   Eén factuur kan leveringen van weken eerder bevatten, dus die blokken zeggen
   iets — ze vertellen wanneer je wat gekregen hebt. */

const REGEL = 'grid grid-cols-[1fr_auto] md:grid-cols-[5rem_1fr_5rem_6rem_6rem] items-baseline gap-x-3 gap-y-0.5'

function Regel({ r }: { r: Documentregel }) {
  const bijzonder = r.soort !== 'Levering'
  return (
    <div className="border-b border-line px-4 py-2 last:border-0">
      <div className={REGEL}>
        <span className="hidden tabular-nums text-muted md:block">{r.artikelnr}</span>

        <span className={bijzonder ? 'text-muted' : ''}>
          {r.artikelnaam ?? r.omschrijving}
          {r.inhoud && <span className="text-muted"> · {r.inhoud}</span>}
        </span>

        <span className="text-right tabular-nums md:order-last">{euro(r.bedrag)}</span>

        <span className="hidden text-right tabular-nums text-muted md:block">
          {aantalTekst(r.aantal)}
          {r.eenheid ? ` ${r.eenheid.toLowerCase()}` : ''}
        </span>
        <span className="hidden text-right tabular-nums text-muted md:block">
          {r.prijs === null ? 'gratis' : euro(r.prijs)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-muted md:hidden">
        <span className="tabular-nums">
          {aantalTekst(r.aantal)}
          {r.eenheid ? ` ${r.eenheid.toLowerCase()}` : ''} × {r.prijs === null ? 'gratis' : euro(r.prijs)}
        </span>
        <span className="tabular-nums">{r.artikelnr}</span>
      </div>

      {/* Emballage staat nooit op de bestellijst — statiegeld bestel je niet.
          Dat label hoort daar dus niet; het zou lijken alsof je buiten je
          eigen assortiment hebt ingekocht. */}
      {(bijzonder || !r.op_bestellijst) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {bijzonder && <Pil soort="neutraal">{r.soort}</Pil>}
          {!r.op_bestellijst && !bijzonder && <Pil soort="letop">buiten de bestellijst</Pil>}
        </div>
      )}
    </div>
  )
}

function Levering({ blok }: { blok: Blok }) {
  return (
    <Kaart className="flex flex-col py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line px-4 pb-2">
        <p className="font-semibold">
          {blok.afleverdatum ? `Geleverd ${dagEnDatum(blok.afleverdatum)}` : 'Emballage'}
          {blok.leveringsnr && <span className="font-normal text-muted"> · {blok.leveringsnr}</span>}
          {blok.referentie && <span className="font-normal text-muted"> · ref {blok.referentie}</span>}
        </p>
        <p className="tabular-nums text-muted">
          {blok.regels.length} regels · <span className="font-semibold text-text">{euro(blok.bedrag)}</span>
        </p>
      </div>
      {blok.regels.map((r) => (
        <Regel key={r.id} r={r} />
      ))}
    </Kaart>
  )
}

/* De pdf zelf. Is hij er niet, dan staat hier niets: de tien oudste facturen
   kwamen uit een inlezing zonder bestand, en een dode knop is erger dan geen
   knop. */
function PdfKnop({ opslagpad }: { opslagpad: string | null }) {
  const { data: link } = usePdfLink(opslagpad)
  if (!opslagpad || !link) return null
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline"
    >
      <FileText className="size-4" aria-hidden />
      De factuur zelf bekijken
    </a>
  )
}

function Totalen({ kop }: { kop: Factuuroverzicht }) {
  const goed = klopt(kop)
  return (
    <Kaart className={`p-4 ${goed ? '' : 'border-bad'}`}>
      <div className="flex flex-col gap-1 tabular-nums">
        <p className="flex justify-between">
          <span className="text-muted">Som van de regels</span>
          <span>{euro(kop.som_regels)}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-muted">Btw</span>
          <span>{euro(kop.btw)}</span>
        </p>
        <p className="flex justify-between border-t border-line pt-1 font-semibold">
          <span>Te betalen</span>
          <span>{euro(kop.totaal_incl)}</span>
        </p>
      </div>

      {goed ? (
        <p className="mt-3 text-sm text-muted">
          De regels plus de btw komen precies uit op het te betalen bedrag.
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {kop.status !== 'verwerkt'
              ? `Deze factuur staat op ${kop.status}${kop.melding ? `: ${kop.melding}` : ''}.`
              : `Er zit ${euro(kop.verschil)} verschil tussen de regels en het te betalen bedrag.`}{' '}
            Zolang dat zo is telt hij nergens in mee.
          </span>
        </p>
      )}
    </Kaart>
  )
}

export function InkoopFactuur() {
  const { levId, nummer } = useParams()
  const { data, isPending, error, refetch } = useInkoopFactuur(Number(levId), nummer ?? '')

  if (isPending) return <Laden tekst="Factuur ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />
  if (!data)
    return (
      <Leeg
        titel="Deze factuur bestaat niet"
        uitleg="Misschien is hij verwijderd, of klopt het nummer in de link niet."
        actie={
          <Link to="/inkoop/documenten" className="text-sm font-semibold underline">
            Terug naar alle facturen
          </Link>
        }
      />
    )

  const { kop, regels } = data
  const blokken = inBlokken(regels)
  const emballage = regels.filter((r) => r.soort === 'Emballage').length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/inkoop/documenten"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Alle facturen
        </Link>

        <div className="mt-2">
          <Kopje>Factuur {kop.nummer}</Kopje>
          <p className="mt-1 text-sm text-muted">
            {kop.leveranciernaam} · {volledigeDatum(kop.datum)}
            {kop.referentie && ` · referentie ${kop.referentie}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {regels.length} regels in {blokken.length}{' '}
            {blokken.length === 1 ? 'levering' : 'leveringen'}
            {emballage > 0 && `, waarvan ${emballage} emballage`}
          </p>
          <PdfKnop opslagpad={kop.opslagpad} />
        </div>
      </div>

      <Totalen kop={kop} />

      {blokken.map((b) => (
        <Levering key={b.sleutel} blok={b} />
      ))}
    </div>
  )
}
