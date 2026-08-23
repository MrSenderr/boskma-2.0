import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { LIJSTEN, type Lijst } from '../lib/taken'
import { perHoek, useTaakZetten, useWerklijst } from '../lib/werklijst'

/* Aftikken doe je per hoek. Zo zie je nooit 82 taken tegelijk, maar de tien of
   twaalf van jouw hoek. Zie docs/modules/haccp/haccpmodule.md. */

export function Werklijst() {
  const { lijst } = useParams<{ lijst: string }>()
  const geldig = LIJSTEN.find((l) => l.waarde === lijst)
  const { data, isPending, error, refetch } = useWerklijst((geldig?.waarde ?? 'openen') as Lijst)
  const zetten = useTaakZetten()
  const [open, setOpen] = useState<string | null>(null)

  if (!geldig) return <Mislukt tekst="Die lijst bestaat niet." />
  if (isPending) return <Laden tekst="Lijst laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const hoeken = perHoek(data.taken, data.vandaag)
  const totaal = data.taken.length
  const klaar = data.vandaag.filter((g) => data.taken.some((t) => t.id === g.taak_id)).length

  if (totaal === 0) {
    return (
      <Leeg
        titel="Geen taken in deze lijst"
        uitleg="Zet ze klaar onder HACCP, tabblad Taken."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Kopje>{geldig.label}</Kopje>
            <p className="mt-1 font-display text-2xl">
              {klaar} van {totaal} gedaan
            </p>
          </div>
          {klaar === totaal && <Pil soort="goed">Lijst compleet</Pil>}
        </div>
        <p className="text-sm text-muted">
          Kies je hoek. Je hoeft alleen af te tikken wat jij doet — een ander pakt
          een andere hoek.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {hoeken.map((h) => {
          const uit = open === h.hoek
          const af = h.gedaan === h.taken.length
          return (
            <Kaart key={h.hoek} className={af ? 'border-good' : ''}>
              <button
                type="button"
                onClick={() => setOpen(uit ? null : h.hoek)}
                aria-expanded={uit}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                {uit ? (
                  <ChevronDown className="size-5 shrink-0 text-muted" aria-hidden />
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                )}
                <span className="flex-1 font-display text-lg">{h.label}</span>
                {af ? (
                  <Pil soort="goed">Klaar</Pil>
                ) : (
                  <span className="text-sm tabular-nums text-muted">
                    {h.gedaan} / {h.taken.length}
                  </span>
                )}
              </button>

              {uit && (
                <div className="border-t border-line">
                  {h.taken.map((t) => {
                    const vinkje = data.vandaag.find((g) => g.taak_id === t.id)
                    const gedaan = Boolean(vinkje)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => zetten.mutate({ taakId: t.id, gedaan: !gedaan })}
                        className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2"
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[4px] border-2 ${
                            gedaan ? 'border-good bg-good text-white' : 'border-line-strong'
                          }`}
                          aria-hidden
                        >
                          {gedaan && <Check className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={gedaan ? 'text-muted line-through' : ''}>{t.naam}</span>
                            {t.ritme === 'wekelijks' && <Pil soort="letop">Deze week</Pil>}
                          </span>
                          {t.toelichting && (
                            <span className="mt-0.5 block text-sm text-muted">{t.toelichting}</span>
                          )}
                          {gedaan && vinkje?.door_naam && (
                            <span className="mt-0.5 block text-sm text-muted">
                              door {vinkje.door_naam}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Kaart>
          )
        })}
      </div>

      <p className="max-w-prose text-sm text-muted">
        Wat je vandaag aftikt kun je vandaag ook weer uitvinken als je je vergist.
        Wat er gisteren is afgetekend blijft staan — dat is het hele punt van een
        logboek.
      </p>
    </div>
  )
}
