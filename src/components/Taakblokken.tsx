import { Link } from 'react-router-dom'
import { Check, ChefHat, ChevronRight, ListChecks } from 'lucide-react'
import { Kaart, Kopje, Pil } from './ui'
import { korteDatum } from '../lib/personeel'
import { LIJSTEN } from '../lib/taken'
import { useLijstStanden } from '../lib/werklijst'
import { urgentie, useMijnTaken, useTaakAfvinken, type PersoonlijkeTaak } from '../lib/vandaag'
import { isBlijvenLiggen, useMepVandaag } from '../lib/mep'

/* De twee takenblokken van een medewerker. Ze staan zowel op Vandaag als op het
   tabblad Taken, dus wonen ze hier — anders lopen de twee schermen vanzelf uit
   elkaar. Zie docs/modules/haccp/haccpmodule.md. */

export function Werklijsten({ kopje = 'Werklijsten' }: { kopje?: string }) {
  const { data: standen } = useLijstStanden()
  if (!standen || !LIJSTEN.some((l) => standen[l.waarde])) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>{kopje}</Kopje>
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
  )
}

function Regel({ taak }: { taak: PersoonlijkeTaak }) {
  const afvinken = useTaakAfvinken()
  const gedaan = Boolean(taak.gedaan_op)
  const staat = urgentie(taak)

  return (
    <button
      type="button"
      onClick={() => afvinken.mutate({ id: taak.id, gedaan: !gedaan })}
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
        <span className={`block ${gedaan ? 'text-muted line-through' : ''}`}>{taak.tekst}</span>
        {taak.toelichting && <span className="block text-sm text-muted">{taak.toelichting}</span>}
      </span>
      {staat === 'telaat' && <Pil soort="fout">Was voor {korteDatum(taak.datum)}</Pil>}
      {staat === 'vandaag' && <Pil soort="letop">Vandaag</Pil>}
      {staat === 'later' && <Pil soort="neutraal">Voor {korteDatum(taak.datum)}</Pil>}
    </button>
  )
}

export function PersoonlijkeTaken({
  medewerkerId,
  kopje = 'Voor jou',
  toonLeeg = false,
}: {
  medewerkerId: string | null | undefined
  kopje?: string
  toonLeeg?: boolean
}) {
  const { data } = useMijnTaken(medewerkerId)
  const taken = data ?? []

  if (taken.length === 0 && !toonLeeg) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>{kopje}</Kopje>
      {taken.length === 0 ? (
        <Kaart className="p-5">
          <p className="text-sm text-muted">
            Er staat op dit moment niets persoonlijks voor je klaar.
          </p>
        </Kaart>
      ) : (
        <Kaart>
          {taken.map((t) => (
            <Regel key={t.id} taak={t} />
          ))}
        </Kaart>
      )}
    </section>
  )
}

/** De voorbereiding van vandaag, als één regel op het startscherm. */
export function MepBlok() {
  const { data } = useMepVandaag()
  const taken = data ?? []
  if (taken.length === 0) return null

  const gedaan = taken.filter((t) => t.gedaan).length
  const af = gedaan === taken.length
  const liggen = taken.filter(isBlijvenLiggen).length

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Voorbereiding</Kopje>
      <Link
        to="/mep/vandaag"
        data-touch
        className={`flex items-center gap-4 rounded-card border bg-surface p-4 hover:bg-surface-2 ${
          af ? 'border-good' : liggen > 0 ? 'border-warn' : 'border-line'
        }`}
      >
        <ChefHat className="size-6 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-display text-lg">
            Mise en place
            {af && <Pil soort="goed">Klaar</Pil>}
            {liggen > 0 && <Pil soort="letop">{liggen} van eerder</Pil>}
          </span>
          <span className="block text-sm text-muted">
            {gedaan} van {taken.length} gedaan
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </section>
  )
}
