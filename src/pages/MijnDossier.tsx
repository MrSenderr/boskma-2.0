import { useEffect, useRef, useState } from 'react'
import { Check, FileText, MessageSquare, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { useWieBenIk } from '../lib/wie'
import { DocumentLink } from '../components/DocumentLink'
import { korteDatum } from '../lib/personeel'
import {
  soortLabel,
  useDocumenten,
  useVerslagReageren,
  useVerslagen,
  verslagGelezen,
  type Verslag,
} from '../lib/dossier'

/* Wat een medewerker van zijn eigen dossier ziet: alleen de verslagen die met
   hem gedeeld zijn, en zijn documenten. Zie
   docs/modules/personeel/personeelsmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Reageren({ verslag }: { verslag: Verslag }) {
  const reageren = useVerslagReageren()
  const [oneens, setOneens] = useState(false)
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  if (verslag.reactie) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {verslag.reactie === 'akkoord' ? (
            <Pil soort="goed">Je bent akkoord</Pil>
          ) : (
            <Pil soort="fout">Je bent het er niet mee eens</Pil>
          )}
          <span className="text-muted">op {korteDatum(verslag.reactie_op)}</span>
        </p>
        {verslag.opmerking && (
          <p className="whitespace-pre-wrap rounded-[4px] bg-surface-2 p-3 text-sm">
            {verslag.opmerking}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}
      {oneens ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`opm-${verslag.id}`} className="text-sm font-semibold text-muted">
              Wat klopt er volgens jou niet?
            </label>
            <textarea
              id={`opm-${verslag.id}`}
              rows={4}
              className={invoer}
              value={opmerking}
              onChange={(e) => setOpmerking(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Knop
              soort="primair"
              bezig={reageren.isPending}
              disabled={opmerking.trim().length === 0}
              onClick={() =>
                reageren.mutate(
                  { verslag: verslag.id, reactie: 'niet_akkoord', opmerking },
                  { onError: (e) => setFout(e.message) },
                )
              }
            >
              Versturen
            </Knop>
            <Knop soort="rustig" onClick={() => setOneens(false)}>
              Toch niet
            </Knop>
          </div>
          <p className="text-sm text-muted">
            Je opmerking komt bij het verslag te staan. Het verslag zelf blijft
            zoals het is — jouw kant staat er dan naast.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Klopt dit verslag?</p>
          <div className="flex flex-wrap gap-2">
            <Knop
              soort="primair"
              bezig={reageren.isPending}
              onClick={() =>
                reageren.mutate(
                  { verslag: verslag.id, reactie: 'akkoord' },
                  { onError: (e) => setFout(e.message) },
                )
              }
            >
              <Check className="size-4" aria-hidden />
              Ja, akkoord
            </Knop>
            <Knop soort="gevaar" onClick={() => setOneens(true)}>
              <X className="size-4" aria-hidden />
              Niet akkoord
            </Knop>
          </div>
        </>
      )}
    </div>
  )
}

export function MijnDossier() {
  const { data: wie } = useWieBenIk()
  const { data: verslagen, isPending, error, refetch } = useVerslagen(wie?.medewerker_id)
  const { data: documenten } = useDocumenten(wie?.medewerker_id)
  const gemeld = useRef<Set<number>>(new Set())

  // Openen telt als gelezen; dan hoeft Sander niet te gissen of het is
  // aangekomen. Eén keer per verslag, niet bij elke verversing opnieuw.
  useEffect(() => {
    ;(verslagen ?? [])
      .filter((v) => !v.gelezen_op && !gemeld.current.has(v.id))
      .forEach((v) => {
        gemeld.current.add(v.id)
        void verslagGelezen(v.id)
      })
  }, [verslagen])

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const leeg = verslagen.length === 0 && (documenten ?? []).length === 0

  return (
    <div className="flex flex-col gap-6">
      <Kopje>Mijn dossier</Kopje>

      {leeg && (
        <Leeg
          titel="Nog niets in je dossier"
          uitleg="Hier komen gespreksverslagen en documenten te staan, zoals je contract."
        />
      )}

      {verslagen.length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Gespreksverslagen</Kopje>
          {verslagen.map((v) => (
            <Kaart key={v.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <MessageSquare className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="font-display text-lg">{v.titel}</span>
                {!v.reactie && <Pil soort="letop">Nieuw</Pil>}
              </div>
              <p className="text-sm text-muted">Gesprek op {korteDatum(v.gesprek_op)}</p>
              <p className="whitespace-pre-wrap">{v.tekst}</p>
              <Reageren verslag={v} />
            </Kaart>
          ))}
        </section>
      )}

      {(documenten ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Documenten</Kopje>
          <Kaart>
            {(documenten ?? []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
              >
                <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.naam}</span>
                  <span className="block text-sm text-muted">{soortLabel(d.soort)}</span>
                </span>
                <DocumentLink pad={d.pad}>Openen</DocumentLink>
              </div>
            ))}
          </Kaart>
        </section>
      )}
    </div>
  )
}
