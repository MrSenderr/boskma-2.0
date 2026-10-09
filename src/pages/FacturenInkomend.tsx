import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Kaart, Knop, Laden, Mislukt } from '../components/ui'
import { useToast } from '../components/Toast'
import {
  deelIn,
  euro,
  gmailLink,
  kortDatum,
  telOp,
  uiterlijk,
  urgentie,
  nogInTeStellen,
  useBetaald,
  useBetaalwijze,
  useFacturen,
  useHeropenen,
  useLeveranciers,
  zonderBedrag,
  type Factuur,
} from '../lib/facturen'

/* Tabblad Inkomend: wat moet ik zelf overmaken, en wanneer uiterlijk.

   Incasso's staan ingeklapt: die hoeven niets van je. Wat jij moet doen staat
   bovenaan, op volgorde van uiterste datum. */

function Datum({ f }: { f: Factuur }) {
  const soort = urgentie(f)
  const datum = uiterlijk(f)

  if (soort === 'geen_datum') return <span className="text-muted">datum onbekend</span>
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted">{kortDatum(datum)}</span>
      {soort === 'te_laat' && <span className="font-semibold text-bad">te laat</span>}
      {soort === 'bijna' && <span className="font-semibold text-warn">binnen 3 dagen</span>}
    </span>
  )
}

function Kopieer({ tekst, wat }: { tekst: string; wat: string }) {
  const [gekopieerd, setGekopieerd] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(tekst)
          setGekopieerd(true)
          setTimeout(() => setGekopieerd(false), 2000)
        } catch {
          // Kopiëren mag de browser weigeren; dan selecteer je het zelf maar.
        }
      }}
      className="flex shrink-0 items-center gap-1 text-sm font-semibold text-muted hover:text-text"
      aria-label={`${wat} kopiëren`}
    >
      {gekopieerd ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {gekopieerd ? 'gekopieerd' : 'kopieer'}
    </button>
  )
}

function Regel({ label, waarde, wat }: { label: string; waarde: string | null; wat: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-sm text-muted">{label}</span>
      {waarde ? (
        <span className="flex items-center gap-3">
          <span className="break-all font-medium tabular-nums">{waarde}</span>
          <Kopieer tekst={waarde} wat={wat} />
        </span>
      ) : (
        <span className="text-sm text-muted">staat niet in de mail – zie factuur</span>
      )}
    </div>
  )
}

function ZelfBetalenKaart({ f, melden }: { f: Factuur; melden: (t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [netBetaald, setNetBetaald] = useState(false)
  const betaald = useBetaald()
  const heropenen = useHeropenen()
  const betaalwijze = useBetaalwijze()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function markeerBetaald() {
    setNetBetaald(true)
    timer.current = window.setTimeout(() => setNetBetaald(false), 5000)
    betaald.mutate(f.id, {
      onError: (e) => {
        setNetBetaald(false)
        melden(e instanceof Error ? e.message : 'Afvinken lukte niet.')
      },
    })
  }

  const mail = gmailLink(f.gmail_thread)

  if (netBetaald) {
    return (
      <Kaart className="flex flex-wrap items-center justify-between gap-2 p-4">
        <span className="text-sm text-good">
          <Check className="mr-1 inline size-4" aria-hidden />
          {f.leverancier} afgevinkt
        </span>
        <button
          type="button"
          className="text-sm font-semibold underline"
          onClick={() => {
            window.clearTimeout(timer.current)
            setNetBetaald(false)
            heropenen.mutate(f.id, {
              onError: (e) => melden(e instanceof Error ? e.message : 'Terugdraaien lukte niet.'),
            })
          }}
        >
          Ongedaan maken
        </button>
      </Kaart>
    )
  }

  return (
    <Kaart className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{f.leverancier}</span>
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="tabular-nums">{euro(f.bedrag_incl)}</span>
            <Datum f={f} />
          </span>
          {f.factuurnummer && (
            <span className="mt-0.5 block text-xs text-muted">{f.factuurnummer}</span>
          )}
        </span>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <Regel label="IBAN" waarde={f.iban} wat="IBAN" />
          <Regel label="Kenmerk" waarde={f.betalingskenmerk} wat="Kenmerk" />

          {f.opmerking && <p className="text-sm text-muted">{f.opmerking}</p>}

          {mail && (
            <a
              href={mail}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1.5 text-sm font-semibold underline"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open mail
            </a>
          )}

          <Knop soort="primair" breed bezig={betaald.isPending} onClick={markeerBetaald}>
            <Check className="size-4" aria-hidden />
            Betaald
          </Knop>

          <button
            type="button"
            className="w-fit text-sm text-muted underline"
            onClick={() =>
              betaalwijze.mutate(
                { id: f.id, betaalwijze: 'incasso' },
                {
                  onError: (e) =>
                    melden(e instanceof Error ? e.message : 'Wijzigen lukte niet.'),
                },
              )
            }
          >
            Gaat per incasso
          </button>
        </div>
      )}
    </Kaart>
  )
}

function OnbekendKaart({ f, melden }: { f: Factuur; melden: (t: string) => void }) {
  const betaalwijze = useBetaalwijze()
  const betaald = useBetaald()
  const fout = (e: unknown) => melden(e instanceof Error ? e.message : 'Dat lukte niet.')

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-semibold">{f.leverancier}</p>
        <p className="text-sm tabular-nums text-muted">
          {euro(f.bedrag_incl)}
          {f.factuurnummer && ` · ${f.factuurnummer}`}
        </p>
      </div>
      <p className="text-sm text-muted">Hoe wordt dit betaald?</p>
      <div className="flex flex-wrap gap-2">
        <Knop
          soort="rustig"
          onClick={() =>
            betaalwijze.mutate({ id: f.id, betaalwijze: 'incasso' }, { onError: fout })
          }
        >
          Incasso
        </Knop>
        <Knop
          soort="rustig"
          onClick={() =>
            betaalwijze.mutate({ id: f.id, betaalwijze: 'handmatig' }, { onError: fout })
          }
        >
          Zelf betalen
        </Knop>
        <Knop
          soort="rustig"
          onClick={() =>
            betaalwijze.mutate(
              { id: f.id, betaalwijze: 'vooraf_betaald' },
              {
                onError: fout,
                onSuccess: () => betaald.mutate(f.id, { onError: fout }),
              },
            )
          }
        >
          Al betaald
        </Knop>
      </div>
    </Kaart>
  )
}

function Inklapbaar({
  titel,
  extra,
  children,
}: {
  titel: string
  extra?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-muted hover:text-text"
        aria-expanded={open}
      >
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        {titel}
        {extra && <span className="font-normal tabular-nums">· {extra}</span>}
      </button>
      {open && children}
    </section>
  )
}

export function FacturenInkomend() {
  const { data, isPending, error, refetch } = useFacturen()
  const { data: leveranciers } = useLeveranciers()
  const heropenen = useHeropenen()
  const { toon, toast } = useToast()

  if (isPending) return <Laden tekst="Facturen ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const d = deelIn(data)
  const teBetalen = telOp(d.zelfBetalen)
  const onbekendeBedragen = zonderBedrag(d.zelfBetalen)

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------- zelf betalen --- */}
      <section className="flex flex-col gap-3">
        <div>
          <p className="font-display text-2xl tabular-nums">{euro(teBetalen)} te betalen</p>
          <p className="text-sm text-muted">
            {d.zelfBetalen.length} {d.zelfBetalen.length === 1 ? 'factuur' : 'facturen'} die je
            zelf moet overmaken
            {onbekendeBedragen > 0 &&
              `, waarvan ${onbekendeBedragen} zonder bedrag — die tellen hier niet mee`}
            .
          </p>
        </div>

        {d.zelfBetalen.length === 0 ? (
          <Kaart className="p-6 text-sm text-muted">Niets om zelf over te maken.</Kaart>
        ) : (
          d.zelfBetalen.map((f) => <ZelfBetalenKaart key={f.id} f={f} melden={toon} />)
        )}
      </section>

      {/* ----------------------------------------------------- onbekend --- */}
      {d.onbekend.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold">
            Nog uitzoeken ({d.onbekend.length})
          </p>
          {d.onbekend.map((f) => (
            <OnbekendKaart key={f.id} f={f} melden={toon} />
          ))}
        </section>
      )}

      {/* ------------------------------------------------------ incasso --- */}
      {d.incasso.length > 0 && (
        <Inklapbaar
          titel={`Gaat vanzelf (${d.incasso.length})`}
          extra={euro(telOp(d.incasso))}
        >
          <Kaart>
            <ul className="flex flex-col divide-y divide-line">
              {d.incasso.map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5">
                  <span className="font-medium">{f.leverancier}</span>
                  <span className="text-sm tabular-nums text-muted">
                    {euro(f.bedrag_incl)}
                    {uiterlijk(f) && ` · wordt rond ${kortDatum(uiterlijk(f))} afgeschreven`}
                  </span>
                </li>
              ))}
            </ul>
          </Kaart>
        </Inklapbaar>
      )}

      {/* ------------------------------------------------------ betaald --- */}
      {d.betaald.length > 0 && (
        <Inklapbaar titel={`Betaald, laatste 30 dagen (${d.betaald.length})`}>
          <Kaart>
            <ul className="flex flex-col divide-y divide-line">
              {d.betaald.map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{f.leverancier}</span>{' '}
                    <span className="text-sm tabular-nums text-muted">{euro(f.bedrag_incl)}</span>
                  </span>
                  <button
                    type="button"
                    className="text-sm text-muted underline"
                    onClick={() =>
                      heropenen.mutate(f.id, {
                        onError: (e) =>
                          toon(e instanceof Error ? e.message : 'Terugzetten lukte niet.'),
                      })
                    }
                  >
                    toch niet betaald
                  </button>
                </li>
              ))}
            </ul>
          </Kaart>
        </Inklapbaar>
      )}

      {/* --------------------------------------------------- creditnota --- */}
      {d.creditnotas.length > 0 && (
        <p className="text-sm text-muted">
          Te ontvangen:{' '}
          <span className="font-semibold tabular-nums text-text">{euro(telOp(d.creditnotas))}</span>{' '}
          aan creditnota&apos;s ({d.creditnotas.length}).
        </p>
      )}

      {/* Het schriftje: hoe elke leverancier betaalt. Hoe voller, hoe minder er
          bij Nog uitzoeken belandt. */}
      <Link
        to="/facturen/leveranciers"
        data-touch
        className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Leveranciers</span>
          {leveranciers && nogInTeStellen(leveranciers) > 0 && (
            <> — {nogInTeStellen(leveranciers)} nog in te stellen</>
          )}
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>

      {toast}
    </div>
  )
}
