import { useState } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden } from './ui'
import { korteDatum } from '../lib/personeel'
import {
  DAGNAMEN,
  useAfwijkendeDagWeg,
  useAfwijkendeDagZetten,
  useOpeningsdagZetten,
  useRooster,
  vandaagStr,
} from '../lib/openingstijden'

/* Wanneer de zaak open is. Zie docs/Modules/openingstijden.md. */

const tijdveld =
  'rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 py-2 text-base tabular-nums outline-none focus:border-accent'
const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function korteTijd(t: string | null) {
  return (t ?? '').slice(0, 5)
}

export function Openingstijden() {
  const { data: rooster, isPending } = useRooster()
  const zetDag = useOpeningsdagZetten()
  const zetAfwijking = useAfwijkendeDagZetten()
  const weg = useAfwijkendeDagWeg()
  const [nieuw, setNieuw] = useState(false)
  const [datum, setDatum] = useState(vandaagStr())
  const [open, setOpen] = useState(false)
  const [reden, setReden] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden />

  const komende = (rooster?.afwijkingen ?? []).filter((a) => a.datum >= vandaagStr())

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Kopje>Gewone week</Kopje>

        {fout && (
          <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
        )}

        <Kaart>
          {DAGNAMEN.map(({ dag, naam }) => {
            const d = rooster?.week.find((w) => w.dag === dag)
            if (!d) return null
            return (
              <div
                key={dag}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="w-24 shrink-0 font-medium">{naam}</span>

                <button
                  type="button"
                  onClick={() =>
                    zetDag.mutate(
                      { ...d, open: !d.open, van: d.van ?? '12:00', tot: d.tot ?? '20:00' },
                      { onError: (e) => setFout(e.message) },
                    )
                  }
                  aria-pressed={d.open}
                  className={`min-h-11 rounded-[4px] px-3 py-2 text-sm font-semibold ${
                    d.open ? 'bg-good text-white' : 'border border-line-strong text-muted'
                  }`}
                >
                  {d.open ? 'Open' : 'Dicht'}
                </button>

                {d.open && (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${naam} open vanaf`}
                      className={tijdveld}
                      defaultValue={korteTijd(d.van)}
                      onBlur={(e) =>
                        e.target.value !== korteTijd(d.van) &&
                        zetDag.mutate({ ...d, van: e.target.value }, { onError: (x) => setFout(x.message) })
                      }
                    />
                    <span className="text-muted">tot</span>
                    <input
                      type="time"
                      aria-label={`${naam} dicht om`}
                      className={tijdveld}
                      defaultValue={korteTijd(d.tot)}
                      onBlur={(e) =>
                        e.target.value !== korteTijd(d.tot) &&
                        zetDag.mutate({ ...d, tot: e.target.value }, { onError: (x) => setFout(x.message) })
                      }
                    />
                  </span>
                )}
              </div>
            )
          })}
        </Kaart>

        <p className="max-w-prose text-sm text-muted">
          Hier hangt meer aan dan je zou denken. Op een gesloten dag verwacht de app
          geen temperatuurronde en geen werklijsten, en telt die dag niet mee in de
          weekafsluiting of de uitdraai voor een controle — een dichte deur is geen
          verzuim. De sluitingsronde komt een uur voor sluitingstijd aan de beurt,
          dus die schuift mee als je je tijden verandert.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Kopje>Dagen die afwijken</Kopje>

        {komende.length === 0 && !nieuw && (
          <Kaart className="p-4">
            <p className="text-sm text-muted">
              Niets bijzonders gepland. Denk aan tweede kerstdag, of een dag eerder
              open met de kermis.
            </p>
          </Kaart>
        )}

        {komende.length > 0 && (
          <Kaart>
            {komende.map((a) => (
              <div
                key={a.datum}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <CalendarOff className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="font-medium">{korteDatum(a.datum)}</span>
                <span className={a.open ? 'text-good' : 'text-bad'}>
                  {a.open ? `open ${korteTijd(a.van)}–${korteTijd(a.tot)}` : 'dicht'}
                </span>
                {a.reden && <span className="text-sm text-muted">{a.reden}</span>}
                <button
                  type="button"
                  onClick={() => weg.mutate(a.datum, { onError: (e) => setFout(e.message) })}
                  aria-label={`${korteDatum(a.datum)} weghalen`}
                  className="ml-auto flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </Kaart>
        )}

        {nieuw ? (
          <Kaart className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
                <label htmlFor="afw-datum" className="text-sm font-semibold text-muted">
                  Welke dag
                </label>
                <input
                  id="afw-datum"
                  type="date"
                  className={invoer}
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                />
              </div>
              <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
                <label htmlFor="afw-reden" className="text-sm font-semibold text-muted">
                  Waarom (mag leeg)
                </label>
                <input
                  id="afw-reden"
                  className={invoer}
                  value={reden}
                  onChange={(e) => setReden(e.target.value)}
                  placeholder="Tweede kerstdag"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-pressed={!open}
                className={`min-h-11 flex-1 rounded-[4px] px-3 font-semibold ${
                  !open ? 'bg-bad text-white' : 'border border-line-strong'
                }`}
              >
                Dicht
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-pressed={open}
                className={`min-h-11 flex-1 rounded-[4px] px-3 font-semibold ${
                  open ? 'bg-good text-white' : 'border border-line-strong'
                }`}
              >
                Open, andere tijden
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Knop
                soort="primair"
                bezig={zetAfwijking.isPending}
                onClick={() =>
                  zetAfwijking.mutate(
                    { datum, open, van: open ? '12:00' : null, tot: open ? '20:00' : null, reden },
                    {
                      onSuccess: () => {
                        setNieuw(false)
                        setReden('')
                      },
                      onError: (e) => setFout(e.message),
                    },
                  )
                }
              >
                Vastleggen
              </Knop>
              <Knop soort="rustig" onClick={() => setNieuw(false)}>
                Annuleren
              </Knop>
            </div>
            {open && (
              <p className="text-sm text-muted">
                De tijden zet je daarna in de lijst hierboven, of je laat ze op 12
                tot 20 staan.
              </p>
            )}
          </Kaart>
        ) : (
          <Knop soort="rustig" className="w-fit" onClick={() => setNieuw(true)}>
            <Plus className="size-4" aria-hidden />
            Dag toevoegen
          </Knop>
        )}
      </section>
    </div>
  )
}
