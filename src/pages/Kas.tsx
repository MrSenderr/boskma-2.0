import { useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Kaart, Knop, Kopje } from '../components/ui'
import {
  COUPURES,
  LEEG,
  aantal,
  bedrag,
  coupureNaam,
  ergensTeveel,
  euro,
  inLade,
  teveelNaarKluis,
  totalen,
  vandaagInWoorden,
  type Aantallen,
  type Soort,
} from '../lib/kas'

/* Kas tellen: je telt, je geeft aan wat er naar de kluis gaat, en je neemt de
   bedragen over in de kassa. Er wordt niets bewaard.

   Enter en Tab springen naar de volgende coupure in dezelfde kolom, niet naar
   het veld ernaast: je telt eerst alle biljetten, daarna pas wat eruit gaat. */

const INVOER =
  'w-full rounded-[4px] border-[1.5px] bg-bg px-2 py-3 text-center text-lg tabular-nums outline-none focus:border-accent'

/* Twee kolommen zijn op een telefoon niet onmisbaar, dus die vallen weg; de
   twee invoervelden en wat er in de lade blijft houd je altijd. */
const RIJ = 'grid grid-cols-[3.25rem_1fr_1fr_5rem] md:grid-cols-[4.5rem_1fr_6.5rem_1fr_6.5rem_6.5rem] items-center gap-2'

function Kop() {
  return (
    <div className={`${RIJ} border-b border-line px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted`}>
      <span>Coupure</span>
      <span className="text-center">Geteld</span>
      <span className="hidden text-right md:block">Bedrag</span>
      <span className="text-center">Naar kluis</span>
      <span className="hidden text-right md:block">Kluis bedrag</span>
      <span className="text-right">In lade</span>
    </div>
  )
}

function Subtotaal({ label, geteld, kluis }: { label: string; geteld: Aantallen; kluis: Aantallen }) {
  const t = totalen(geteld, kluis, label === 'Biljetten' ? 'biljet' : 'munt')
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-y border-line bg-surface-2 px-3 py-2 text-sm">
      <span className="font-semibold">Subtotaal {label.toLowerCase()}</span>
      <span className="tabular-nums text-muted">
        geteld <span className="font-semibold text-text">{euro(t.geteld)}</span> · kluis{' '}
        <span className="font-semibold text-text">{euro(t.kluis)}</span> · lade{' '}
        <span className="font-semibold text-text">{euro(t.lade)}</span>
      </span>
    </div>
  )
}

export function Kas() {
  const [geteld, setGeteld] = useState<Aantallen>(LEEG)
  const [kluis, setKluis] = useState<Aantallen>(LEEG)
  const [wissenBevestigen, setWissenBevestigen] = useState(false)

  const geteldVelden = useRef<(HTMLInputElement | null)[]>([])
  const kluisVelden = useRef<(HTMLInputElement | null)[]>([])

  const t = totalen(geteld, kluis)
  const fout = ergensTeveel(geteld, kluis)

  function zet(welke: 'geteld' | 'kluis', centen: number, waarde: string) {
    // Alleen hele getallen vanaf nul; een lege invoer is gewoon nul.
    const n = waarde === '' ? 0 : Math.max(0, Math.floor(Number(waarde)))
    const bijwerken = (a: Aantallen) => ({ ...a, [centen]: Number.isFinite(n) ? n : 0 })
    if (welke === 'geteld') setGeteld(bijwerken)
    else setKluis(bijwerken)
  }

  /** Enter en Tab gaan naar de volgende coupure in dezelfde kolom. */
  function naarVolgende(
    e: React.KeyboardEvent<HTMLInputElement>,
    velden: React.RefObject<(HTMLInputElement | null)[]>,
    i: number,
  ) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    const doel = velden.current[i + (e.shiftKey ? -1 : 1)]
    // Voorbij het laatste veld laten we Tab gewoon zijn werk doen.
    if (!doel) return
    e.preventDefault()
    doel.focus()
    doel.select()
  }

  function wis() {
    setGeteld(LEEG)
    setKluis(LEEG)
    setWissenBevestigen(false)
    geteldVelden.current[0]?.focus()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Kopje>Kas tellen</Kopje>
        <p className="mt-1 text-sm text-muted">{vandaagInWoorden()}</p>
      </div>

      <Kaart className="flex flex-col py-2">
        <Kop />

        {COUPURES.map((c, i) => {
          const soort: Soort = c.soort
          const vorige = COUPURES[i - 1]
          const grens = vorige && vorige.soort !== soort
          const teveel = teveelNaarKluis(geteld, kluis, c.centen)

          return (
            <div key={c.centen}>
              {grens && <Subtotaal label="Biljetten" geteld={geteld} kluis={kluis} />}

              <div className={`${RIJ} px-3 py-1.5`}>
                <span className="font-semibold tabular-nums">{coupureNaam(c.centen)}</span>

                <input
                  ref={(el) => {
                    geteldVelden.current[i] = el
                  }}
                  aria-label={`Aantal geteld van ${coupureNaam(c.centen)}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`${INVOER} border-line-strong`}
                  value={aantal(geteld, c.centen) || ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => zet('geteld', c.centen, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => naarVolgende(e, geteldVelden, i)}
                />

                <span className="hidden text-right tabular-nums text-muted md:block">
                  {euro(bedrag(geteld, c.centen))}
                </span>

                <input
                  ref={(el) => {
                    kluisVelden.current[i] = el
                  }}
                  aria-label={`Naar kluis van ${coupureNaam(c.centen)}`}
                  aria-invalid={teveel || undefined}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`${INVOER} ${teveel ? 'border-bad bg-bad-soft text-bad' : 'border-line-strong'}`}
                  value={aantal(kluis, c.centen) || ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => zet('kluis', c.centen, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => naarVolgende(e, kluisVelden, i)}
                />

                <span className="hidden text-right tabular-nums text-muted md:block">
                  {euro(bedrag(kluis, c.centen))}
                </span>

                <span
                  className={`text-right tabular-nums ${teveel ? 'text-bad' : 'font-medium'}`}
                >
                  {euro(inLade(geteld, kluis, c.centen))}
                </span>
              </div>

              {teveel && (
                <p className="px-3 pb-1 text-sm text-bad">
                  Je kunt niet {aantal(kluis, c.centen)} × {coupureNaam(c.centen)} naar de kluis
                  doen; je hebt er {aantal(geteld, c.centen)} geteld.
                </p>
              )}
            </div>
          )
        })}

        <Subtotaal label="Munten" geteld={geteld} kluis={kluis} />
      </Kaart>

      {/* --------------------------------------------------------- totalen --- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Totaal geteld', waarde: t.geteld, nadruk: false },
          { label: 'Naar kluis', waarde: t.kluis, nadruk: false },
          { label: 'Blijft in lade', waarde: t.lade, nadruk: true },
        ].map(({ label, waarde, nadruk }) => (
          <Kaart key={label} className={`p-4 ${nadruk ? 'border-accent' : ''}`}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{euro(waarde)}</p>
          </Kaart>
        ))}
      </div>

      {fout && (
        <p className="text-sm text-bad">
          Er gaat ergens meer naar de kluis dan je geteld hebt. De totalen kloppen pas als dat
          is opgelost.
        </p>
      )}

      {/* ---------------------------------------------------------- wissen --- */}
      <div className="flex flex-wrap items-center gap-2">
        {wissenBevestigen ? (
          <>
            <span className="text-sm">Alles terug op nul?</span>
            <Knop soort="gevaar" onClick={wis}>
              Ja, wissen
            </Knop>
            <Knop soort="rustig" onClick={() => setWissenBevestigen(false)}>
              Nee, laat staan
            </Knop>
          </>
        ) : (
          <Knop soort="rustig" onClick={() => setWissenBevestigen(true)}>
            <Eraser className="size-4" aria-hidden />
            Wissen
          </Knop>
        )}
      </div>
    </div>
  )
}
