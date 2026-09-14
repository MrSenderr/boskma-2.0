import { Link } from 'react-router-dom'
import { Cake, ChevronRight, MessageSquare } from 'lucide-react'
import { Kaart, Kopje, Pil } from '../components/ui'
import { isOpen, standVanDeDag, useRooster, vandaagStr } from '../lib/openingstijden'
import { useWieBenIk } from '../lib/wie'
import { jarigen, useVerjaardagen } from '../lib/verjaardagen'
import { useVerslagen } from '../lib/dossier'

/* Het startscherm van een medewerker.
 *
 * Hier stonden de temperatuurronde, de MEP-lijst, de werklijsten en de
 * persoonlijke taken. Die zijn in september 2026 allemaal vervallen: de app is
 * geen controlesysteem meer. Wat overblijft is inzien, niet afvinken.
 *
 * Dat is weinig, en dat hoort zo te voelen. Komt er later weer iets bij voor de
 * ploeg, dan is dit de plek. */

function groet() {
  const u = new Date().getHours()
  if (u < 6) return 'Goedenacht'
  if (u < 12) return 'Goedemorgen'
  if (u < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export function VandaagMedewerker() {
  const { data: wie } = useWieBenIk()
  const { data: verjaardagen } = useVerjaardagen()
  const { data: verslagen } = useVerslagen(wie?.medewerker_id)
  const { data: rooster } = useRooster()

  const voornaam = (wie?.naam ?? '').split(' ')[0]
  const vandaag = vandaagStr()
  const open = isOpen(rooster, vandaag)

  // Alleen gedeelde verslagen komen hier binnen; de database laat de rest niet
  // los. Zonder reactie wacht het nog op hem.
  const wacht = (verslagen ?? []).filter((v) => !v.reactie)

  const { vandaag: jarigVandaag, komend } = jarigen(verjaardagen ?? [])

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

      {wacht.length > 0 && (
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
      )}

      {!open && (
        <Kaart className="p-5">
          <p className="font-display text-lg">Vandaag is de zaak dicht.</p>
          {standVanDeDag(rooster, vandaag).reden && (
            <p className="mt-1 text-sm text-muted">{standVanDeDag(rooster, vandaag).reden}</p>
          )}
        </Kaart>
      )}

      {(jarigVandaag.length > 0 || komend.length > 0) && (
        <section className="flex flex-col gap-3">
          <Kopje>Verjaardagen</Kopje>
          <Kaart className="flex flex-col gap-2 p-4">
            {jarigVandaag.map((v) => (
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
      )}
    </div>
  )
}
