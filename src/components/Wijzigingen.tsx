import { useState } from 'react'
import { ArrowRight, Building2, Check, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import {
  NAAR_LOONBUREAU,
  VELDNAMEN,
  useOpenWijzigingen,
  useWijzigingAfhandelen,
} from '../lib/mijngegevens'

/* Elke wijziging die een medewerker aan zichzelf doet komt hier langs — ook een
   adreswijziging, want die moet naar het loonbureau. Zie
   docs/modules/personeel/personeelsmodule.md. */

export function Wijzigingen() {
  const { data, isPending } = useOpenWijzigingen()
  const afhandelen = useWijzigingAfhandelen()
  const [fout, setFout] = useState<string | null>(null)

  if (isPending || !data || data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Kopje>Gewijzigde gegevens</Kopje>
        <span className="text-sm text-muted">{data.length}</span>
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <div className="flex flex-col gap-2">
        {data.map((w) => {
          const naam = [w.sollicitaties?.voornaam, w.sollicitaties?.achternaam]
            .filter(Boolean)
            .join(' ')
          const loonbureau = NAAR_LOONBUREAU.includes(w.veld)
          return (
            <Kaart
              key={w.id}
              className={`flex flex-col gap-3 p-4 ${w.goedkeuring_nodig ? 'border-warn' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{naam || 'Onbekend'}</span>
                <span className="text-muted">wijzigde</span>
                <span className="font-semibold">{VELDNAMEN[w.veld] ?? w.veld}</span>
                {w.goedkeuring_nodig ? (
                  <Pil soort="letop">Wacht op jou</Pil>
                ) : (
                  <Pil soort="neutraal">Al doorgevoerd</Pil>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-[4px] bg-surface-2 px-2 py-1 text-muted line-through">
                  {w.oude_waarde || 'leeg'}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="rounded-[4px] bg-surface-2 px-2 py-1 font-semibold">
                  {w.nieuwe_waarde || 'leeg'}
                </span>
              </div>

              {loonbureau && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Building2 className="size-4 shrink-0" aria-hidden />
                  Dit moet het loonbureau weten.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Knop
                  soort="primair"
                  bezig={afhandelen.isPending}
                  onClick={() =>
                    afhandelen.mutate(
                      { id: w.id, akkoord: true },
                      { onError: (e) => setFout(e.message) },
                    )
                  }
                >
                  <Check className="size-4" aria-hidden />
                  {w.goedkeuring_nodig ? 'Goedkeuren' : 'Gezien'}
                </Knop>
                {w.goedkeuring_nodig && (
                  <Knop
                    soort="gevaar"
                    onClick={() =>
                      afhandelen.mutate(
                        { id: w.id, akkoord: false },
                        { onError: (e) => setFout(e.message) },
                      )
                    }
                  >
                    <X className="size-4" aria-hidden />
                    Afwijzen
                  </Knop>
                )}
              </div>
            </Kaart>
          )
        })}
      </div>
    </section>
  )
}
