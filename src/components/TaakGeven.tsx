import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import { useTaakWeghalen, useTakenVan, useTaakGeven } from '../lib/vandaag'
import { useAuth } from '../lib/auth'

/* Een losse klus voor één persoon, met een datum. Verschijnt op zijn
   Vandaag-scherm tot hij hem afvinkt. Los van de vaste werklijsten. */

export function TaakGeven({ persoon }: { persoon: Persoon }) {
  const { data: taken } = useTakenVan(persoon.id)
  const geven = useTaakGeven()
  const weghalen = useTaakWeghalen()
  const { email } = useAuth()
  const [tekst, setTekst] = useState('')
  const [datum, setDatum] = useState(new Date().toLocaleDateString('sv-SE'))

  const open = (taken ?? []).filter((t) => !t.gedaan_op)
  const afgerond = (taken ?? []).filter((t) => t.gedaan_op).slice(0, 3)

  function geef() {
    if (!tekst.trim()) return
    geven.mutate(
      {
        medewerker_id: persoon.id,
        tekst: tekst.trim(),
        datum,
        aangemaakt_door: email ?? '',
      },
      { onSuccess: () => setTekst('') },
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Taken voor deze medewerker</Kopje>

      <Kaart className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Veld
              label="Wat moet er gebeuren"
              placeholder="Bijvoorbeeld: bestelling Veldboer nakijken"
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') geef()
              }}
            />
          </div>
          <div className="sm:w-44">
            <Veld
              label="Klaar op"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>
          <Knop soort="primair" bezig={geven.isPending} disabled={!tekst.trim()} onClick={geef}>
            <Plus className="size-4" aria-hidden />
            Geven
          </Knop>
        </div>
        <p className="text-sm text-muted">
          Staat meteen op zijn Vandaag-scherm, met die datum als deadline. Blijft
          staan tot hij hem afvinkt.
        </p>
      </Kaart>

      {(open.length > 0 || afgerond.length > 0) && (
        <Kaart>
          {open.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">{t.tekst}</span>
              <span className="text-sm tabular-nums text-muted">{korteDatum(t.datum)}</span>
              {t.datum < new Date().toLocaleDateString('sv-SE') && <Pil soort="fout">Over datum</Pil>}
              <button
                type="button"
                aria-label={`${t.tekst} weghalen`}
                onClick={() => weghalen.mutate(t.id)}
                className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          {afgerond.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 text-muted last:border-b-0"
            >
              <Check className="size-4 shrink-0 text-good" aria-hidden />
              <span className="min-w-0 flex-1 line-through">{t.tekst}</span>
              <span className="text-sm tabular-nums">afgevinkt {korteDatum(t.gedaan_op)}</span>
            </div>
          ))}
        </Kaart>
      )}
    </section>
  )
}
