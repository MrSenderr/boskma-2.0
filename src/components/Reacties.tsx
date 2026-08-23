import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquare } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import { korteDatum } from '../lib/personeel'
import { useNieuweReacties, useReactieAftikken } from '../lib/dossier'

/* Wat een medewerker van een gespreksverslag vond. Staat op Vandaag, want een
   "niet akkoord" hoort niet te wachten tot je toevallig het dossier openslaat.
   Zie docs/modules/personeel/personeelsmodule.md. */

export function Reacties() {
  const { data, isPending } = useNieuweReacties()
  const aftikken = useReactieAftikken()
  const [fout, setFout] = useState<string | null>(null)

  if (isPending || !data || data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Kopje>Reacties op verslagen</Kopje>
        <span className="text-sm text-muted">{data.length}</span>
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {data.map((r) => {
        const naam = [r.sollicitaties?.voornaam, r.sollicitaties?.achternaam]
          .filter(Boolean)
          .join(' ')
        const oneens = r.reactie === 'niet_akkoord'
        return (
          <Kaart key={r.id} className={`flex flex-col gap-3 p-4 ${oneens ? 'border-bad' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <MessageSquare className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="font-semibold">{naam || 'Onbekend'}</span>
              {oneens ? (
                <Pil soort="fout">Niet akkoord</Pil>
              ) : (
                <Pil soort="goed">Akkoord</Pil>
              )}
              <span className="text-sm text-muted">op {korteDatum(r.reactie_op)}</span>
            </div>

            <p className="text-sm text-muted">
              Verslag: <span className="font-medium text-text">{r.titel}</span> —{' '}
              gesprek op {korteDatum(r.gesprek_op)}
            </p>

            {r.opmerking && (
              <p className="whitespace-pre-wrap rounded-[4px] bg-surface-2 p-3 text-sm">
                {r.opmerking}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Knop
                soort="primair"
                bezig={aftikken.isPending}
                onClick={() => aftikken.mutate(r.id, { onError: (e) => setFout(e.message) })}
              >
                <Check className="size-4" aria-hidden />
                Gezien
              </Knop>
              <Link
                to={`/personeel/${r.medewerker_id}`}
                className="inline-flex min-h-11 items-center rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                Naar het dossier
              </Link>
            </div>
          </Kaart>
        )
      })}
    </section>
  )
}
