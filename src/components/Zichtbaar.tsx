import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Kaart, Kopje } from './ui'
import { ONDERDELEN, useVerborgenVan, useZichtbaarZetten } from '../lib/zichtbaar'
import type { Persoon } from '../lib/personeel'

/* Wat een medewerker in zijn menu ziet. Zie docs/Modules/rechten.md.

   Dit ruimt een menu op, het sluit niets af: een uitgezet onderdeel is nog
   steeds bereikbaar via een knop bij een taak, en dat is met opzet. */

export function Zichtbaar({ persoon }: { persoon: Persoon }) {
  const { data: verborgen, isPending } = useVerborgenVan(persoon.id)
  const zetten = useZichtbaarZetten(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return null

  const voornaam = persoon.voornaam ?? 'deze medewerker'
  const uit = verborgen ?? []

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Wat {voornaam} in zijn menu ziet</Kopje>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <Kaart>
        {ONDERDELEN.map(({ waarde, label, uitleg }) => {
          const aan = !uit.includes(waarde)
          return (
            <label
              key={waarde}
              className="flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[#003A41]"
                checked={aan}
                onChange={(e) =>
                  zetten.mutate(
                    { onderdeel: waarde, zichtbaar: e.target.checked },
                    { onError: (x) => setFout(x.message) },
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${aan ? '' : 'text-muted'}`}>{label}</span>
                <span className="block text-sm text-muted">{uitleg}</span>
              </span>
            </label>
          )
        })}
      </Kaart>

      <p className="flex items-start gap-2 text-sm text-muted">
        <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
        Dit ruimt zijn menu op, het sluit niets af. Zet je Recepten uit, dan is het
        menu-item weg — maar de knop <span className="font-semibold">Recept</span> bij
        een MEP-taak werkt gewoon. Zo houdt hij een kort menu zonder dat hij iets
        mist wat hij tijdens het werk nodig heeft.
      </p>
      <p className="text-sm text-muted">
        Vandaag, Mijn gegevens en Mijn dossier staan er altijd. Die zijn van hem.
      </p>
    </section>
  )
}
