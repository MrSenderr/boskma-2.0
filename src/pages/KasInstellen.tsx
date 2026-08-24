import { useState } from 'react'
import { Kaart, Kopje, Laden, Mislukt } from '../components/ui'
import { coupureNaam, euro, kasbedrag, useCoupureZetten, useCoupures } from '../lib/kas'

/* Wat er in de lade hoort te blijven, per coupure. Het kasbedrag is de optelsom
   daarvan en wordt dus niet apart ingesteld — zo kan het nooit uit elkaar lopen
   met het wisselgeld dat je werkelijk wilt hebben. Zie docs/Modules/kas.md. */

const invoer =
  'w-24 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-right text-lg font-bold tabular-nums outline-none focus:border-accent'

export function KasInstellen() {
  const { data, isPending, error, refetch } = useCoupures()
  const zetten = useCoupureZetten()
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted">
        Hoeveel je van elke munt en elk biljet wilt overhouden in de lade. Heb je er
        meer, dan gaat het verschil naar de kluis. Heb je er minder, dan zegt de app
        dat je wisselgeld tekort komt.
      </p>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <Kaart>
        {data.map((c) => (
          <div
            key={c.waarde_cent}
            className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <span className="w-20 shrink-0 font-display text-lg">{coupureNaam(c.waarde_cent)}</span>
            <input
              type="text"
              inputMode="numeric"
              className={invoer}
              aria-label={`Gewenst aantal ${coupureNaam(c.waarde_cent)}`}
              defaultValue={c.gewenst}
              onBlur={(e) => {
                const n = Number(e.target.value.replace(/\D/g, '') || 0)
                if (n !== c.gewenst) {
                  zetten.mutate(
                    { waarde_cent: c.waarde_cent, gewenst: n },
                    { onError: (x) => setFout(x.message) },
                  )
                }
              }}
            />
            <span className="min-w-0 flex-1 text-right tabular-nums text-muted">
              {euro(c.gewenst * c.waarde_cent)}
            </span>
          </div>
        ))}
      </Kaart>

      <Kaart className="flex flex-wrap items-center justify-between gap-3 border-line-strong p-4">
        <span>
          <span className="block text-sm text-muted">Hoort er in de lade te blijven</span>
          <span className="font-display text-3xl tabular-nums">{euro(kasbedrag(data))}</span>
        </span>
      </Kaart>

      <p className="max-w-prose text-sm text-muted">
        Dit zijn startwaarden die ik heb ingevuld; loop ze na en zet ze op wat jij
        echt aan wisselgeld wilt hebben. Wijzigingen gelden vanaf je volgende
        telling — oude tellingen blijven staan zoals ze waren.
      </p>
      <Kopje>Bewaren hoeft niet, het gaat vanzelf</Kopje>
    </div>
  )
}
