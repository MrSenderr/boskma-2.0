import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Kaart, Kopje } from './ui'
import { RECHTEN, useRechtZetten, useRechtenVan } from '../lib/rechten'
import type { Persoon } from '../lib/personeel'

/* Wat een medewerker extra mag. Zie docs/Modules/rechten.md. */

export function Rechten({ persoon }: { persoon: Persoon }) {
  const { data: rechten, isPending } = useRechtenVan(persoon.id)
  const zetten = useRechtZetten(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return null

  const voornaam = persoon.voornaam ?? 'deze medewerker'

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Wat {voornaam} extra mag</Kopje>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <Kaart>
        {RECHTEN.map(({ waarde, label, uitleg }) => {
          const aan = (rechten ?? []).includes(waarde)
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
                    { recht: waarde, aan: e.target.checked },
                    { onError: (x) => setFout(x.message) },
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted">{uitleg}</span>
              </span>
            </label>
          )
        })}
      </Kaart>

      <p className="flex items-start gap-2 text-sm text-muted">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        Dit gaat alleen over beheren. Bij het personeel, de instellingen en de
        schermen kan niemand behalve jij, en dat blijft zo.
      </p>
    </section>
  )
}
