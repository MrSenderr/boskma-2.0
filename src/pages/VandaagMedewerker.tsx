import { Link } from 'react-router-dom'
import { ChevronRight, Thermometer } from 'lucide-react'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useApparaten } from '../lib/apparaten'
import { useMetingenVandaag } from '../lib/metingen'
import { useWieBenIk } from '../lib/wie'

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

      <p className="max-w-prose text-sm text-muted">
        Hier komen straks ook je takenlijsten te staan — openen, voorbereiden en
        sluiten — zodat je op één scherm ziet wat er van je wordt verwacht.
      </p>
    </div>
  )
}
