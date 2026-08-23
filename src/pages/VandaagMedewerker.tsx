import { Link } from 'react-router-dom'
import { Cake, Check, ChevronRight, ListChecks, Thermometer } from 'lucide-react'
import { korteDatum } from '../lib/personeel'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useApparaten } from '../lib/apparaten'
import { useMetingenVandaag } from '../lib/metingen'
import { useWieBenIk } from '../lib/wie'
import { jarigen, urgentie, useMijnTaken, useTaakAfvinken, useVerjaardagen } from '../lib/vandaag'
import { useLijstStanden } from '../lib/werklijst'
import { LIJSTEN } from '../lib/taken'

/* Het startscherm van een medewerker: wat er vandaag van hem verwacht wordt.
   Zie docs/modules/haccp/haccpmodule.md — "Schermen op de telefoon". */

function groet() {
  const u = new Date().getHours()
  if (u < 6) return 'Goedenacht'
  if (u < 12) return 'Goedemorgen'
  if (u < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export function VandaagMedewerker() {
  const { data: wie } = useWieBenIk()
  const { data: apparaten, isPending, error, refetch } = useApparaten()
  const { data: metingen } = useMetingenVandaag('opening')
  const { data: verjaardagen } = useVerjaardagen()
  const { data: mijnTaken } = useMijnTaken(wie?.medewerker_id)
  const afvinken = useTaakAfvinken()
  const { data: standen } = useLijstStanden()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const teMeten = apparaten.filter(
    (a) => a.actief && (a.meetmoment === 'opening' || a.meetmoment === 'beide'),
  )
  const gedaan = teMeten.filter((a) => (metingen ?? []).some((m) => m.apparaat_id === a.id)).length
  const klaar = teMeten.length > 0 && gedaan === teMeten.length
  const voornaam = (wie?.naam ?? '').split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-display text-2xl">
          {groet()}
          {voornaam ? `, ${voornaam}` : ''}
        </p>
        <p className="mt-1 text-sm text-muted">
          {new Date().toLocaleDateString('nl-NL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <Kopje>Wat er vandaag moet</Kopje>

        {teMeten.length === 0 ? (
          <Kaart className="p-5">
            <p className="text-sm text-muted">
              Er staat vandaag niets voor je klaar.
            </p>
          </Kaart>
        ) : (
          <Link
            to="/ronde"
            data-touch
            className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 hover:bg-surface-2"
          >
            <Thermometer className="size-6 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-display text-lg">
                Temperaturen
                {klaar ? <Pil soort="goed">Klaar</Pil> : <Pil soort="fout">Nog doen</Pil>}
              </p>
              <p className="text-sm text-muted">
                {gedaan} van {teMeten.length} gemeten
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        )}
      </section>

      {standen && LIJSTEN.some((l) => standen[l.waarde]) && (
        <section className="flex flex-col gap-3">
          <Kopje>Werklijsten</Kopje>
          <div className="flex flex-col gap-2">
            {LIJSTEN.map((l) => {
              const s = standen[l.waarde]
              if (!s) return null
              const af = s.gedaan === s.totaal
              return (
                <Link
                  key={l.waarde}
                  to={`/lijst/${l.waarde}`}
                  data-touch
                  className={`flex items-center gap-4 rounded-card border bg-surface p-4 hover:bg-surface-2 ${
                    af ? 'border-good' : 'border-line'
                  }`}
                >
                  <ListChecks className="size-6 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-display text-lg">
                      {l.label}
                      {af && <Pil soort="goed">Klaar</Pil>}
                    </span>
                    <span className="block text-sm text-muted">
                      {s.gedaan} van {s.totaal} gedaan
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {(mijnTaken ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Voor jou</Kopje>
          <Kaart>
            {(mijnTaken ?? []).map((t) => {
              const gedaan = Boolean(t.gedaan_op)
              const staat = urgentie(t)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => afvinken.mutate({ id: t.id, gedaan: !gedaan })}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                      gedaan ? 'border-good bg-good text-white' : 'border-line-strong'
                    }`}
                    aria-hidden
                  >
                    {gedaan && <Check className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${gedaan ? 'text-muted line-through' : ''}`}>{t.tekst}</span>
                    {t.toelichting && <span className="block text-sm text-muted">{t.toelichting}</span>}
                  </span>
                  {staat === 'telaat' && <Pil soort="fout">Was voor {korteDatum(t.datum)}</Pil>}
                  {staat === 'vandaag' && <Pil soort="letop">Vandaag</Pil>}
                  {staat === 'later' && <Pil soort="neutraal">Voor {korteDatum(t.datum)}</Pil>}
                </button>
              )
            })}
          </Kaart>
        </section>
      )}

      {verjaardagen && (() => {
        const { vandaag, komend } = jarigen(verjaardagen)
        if (vandaag.length === 0 && komend.length === 0) return null
        return (
          <section className="flex flex-col gap-3">
            <Kopje>Verjaardagen</Kopje>
            <Kaart className="flex flex-col gap-2 p-4">
              {vandaag.map((v) => (
                <p key={v.naam} className="flex items-center gap-2 font-semibold">
                  <Cake className="size-4 shrink-0 text-accent" aria-hidden />
                  {v.naam} is vandaag jarig
                </p>
              ))}
              {komend.map((v) => (
                <p key={v.naam} className="flex items-center gap-2 text-sm text-muted">
                  <Cake className="size-4 shrink-0" aria-hidden />
                  {v.naam} over {v.dagen} {v.dagen === 1 ? 'dag' : 'dagen'}
                </p>
              ))}
            </Kaart>
          </section>
        )
      })()}


    </div>
  )
}
