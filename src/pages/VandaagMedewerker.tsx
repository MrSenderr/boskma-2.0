import { Link } from 'react-router-dom'
import { Cake, ChevronRight, Droplet, MessageSquare, Thermometer, Truck } from 'lucide-react'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useApparaten } from '../lib/apparaten'
import { useMetingenVandaag } from '../lib/metingen'
import { RONDES, apparatenVoor, rondeVanNu, standVan } from '../lib/rondes'
import { isOpen, sluitingsrondeVanaf, standVanDeDag, useRooster, vandaagStr } from '../lib/openingstijden'
import { useWieBenIk } from '../lib/wie'
import { jarigen, useVerjaardagen } from '../lib/vandaag'
import { MepBlok, PersoonlijkeTaken, Werklijsten } from '../components/Taakblokken'
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
  const { data: opening } = useMetingenVandaag('opening')
  const { data: sluiting } = useMetingenVandaag('sluiting')
  const { data: verjaardagen } = useVerjaardagen()
  const { data: verslagen } = useVerslagen(wie?.medewerker_id)
  const { data: rooster } = useRooster()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const voornaam = (wie?.naam ?? '').split(' ')[0]

  // De sluitingsronde is pas aan de beurt als de zaak bijna dicht is; daarvoor
  // heeft hij geen zin. Wat af is verdwijnt.
  const vandaag = vandaagStr()
  const open = isOpen(rooster, vandaag)
  const nu = rondeVanNu(sluitingsrondeVanaf(rooster, vandaag))
  const teDoen = RONDES.filter((r) => r.moment === 'opening' || nu === 'sluiting')
    .map((r) => ({
      ...r,
      ...standVan(apparatenVoor(apparaten, r.moment), r.moment === 'opening' ? opening : sluiting),
    }))
    .filter((r) => r.totaal > 0 && !r.klaar)
  const teDoenVandaag = open ? teDoen : []

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

      {teDoenVandaag.length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Wat er vandaag moet</Kopje>
          {teDoenVandaag.map((r) => (
            <Link
              key={r.moment}
              to="/temperaturen"
              data-touch
              className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 hover:bg-surface-2"
            >
              <Thermometer className="size-6 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg">
                  {r.label}
                  <Pil soort="fout">Nog doen</Pil>
                </p>
                <p className="text-sm text-muted">
                  {r.gedaan} van {r.totaal} gemeten
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </section>
      )}

      {open ? (
        <>
          <MepBlok />

          <Werklijsten />

          <PersoonlijkeTaken medewerkerId={wie?.medewerker_id} />
        </>
      ) : (
        <Kaart className="p-5">
          <p className="font-display text-lg">Vandaag is de zaak dicht.</p>
          <p className="mt-1 text-sm text-muted">
            {standVanDeDag(rooster, vandaag).reden ??
              'Er staan vandaag geen rondes of werklijsten klaar.'}
          </p>
        </Kaart>
      )}

      {/* Een levering komt op een willekeurig moment binnen en het vet schuift
          door wanneer het nodig is. Geen van beide is een taak die af moet, dus
          staan ze hier als knop en niet in een lijstje. */}
      <section className="flex flex-col gap-3">
        <Kopje>Tussendoor</Kopje>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/levering"
            data-touch
            className="flex flex-1 items-center gap-3 rounded-card border border-line bg-surface p-4 hover:bg-surface-2"
          >
            <Truck className="size-5 shrink-0 text-muted" aria-hidden />
            <span className="flex-1 font-semibold">Levering aantekenen</span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
          <Link
            to="/frituurvet"
            data-touch
            className="flex flex-1 items-center gap-3 rounded-card border border-line bg-surface p-4 hover:bg-surface-2"
          >
            <Droplet className="size-5 shrink-0 text-muted" aria-hidden />
            <span className="flex-1 font-semibold">Frituurvet</span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        </div>
      </section>

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
