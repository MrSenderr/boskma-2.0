import { Link } from 'react-router-dom'
import { Cake, ChevronRight, MessageSquare, Thermometer } from 'lucide-react'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useApparaten } from '../lib/apparaten'
import { useMetingenVandaag } from '../lib/metingen'
import { useWieBenIk } from '../lib/wie'
import { jarigen, useVerjaardagen } from '../lib/vandaag'
import { PersoonlijkeTaken, Werklijsten } from '../components/Taakblokken'
import { useVerslagen } from '../lib/dossier'

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
  const { data: verslagen } = useVerslagen(wie?.medewerker_id)

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

      {(() => {
        // Alleen gedeelde verslagen komen hier binnen; de database laat de rest
        // niet los. Zonder reactie wacht het nog op hem.
        const wacht = (verslagen ?? []).filter((v) => !v.reactie)
        if (wacht.length === 0) return null
        return (
          <section className="flex flex-col gap-3">
            <Kopje>Er wacht iets op je</Kopje>
            <Link
              to="/mijn-dossier"
              data-touch
              className="flex items-center gap-4 rounded-card border border-warn bg-surface p-5 hover:bg-surface-2"
            >
              <MessageSquare className="size-6 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-display text-lg">
                  {wacht.length === 1 ? 'Een gespreksverslag' : `${wacht.length} gespreksverslagen`}
                  <Pil soort="letop">Nog reageren</Pil>
                </span>
                <span className="block text-sm text-muted">
                  {wacht.length === 1
                    ? `"${wacht[0].titel}" — lees het en geef aan of het klopt.`
                    : 'Lees ze en geef aan of ze kloppen.'}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </section>
        )
      })()}

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
            to="/temperaturen"
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

      <Werklijsten />

      <PersoonlijkeTaken medewerkerId={wie?.medewerker_id} />

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
