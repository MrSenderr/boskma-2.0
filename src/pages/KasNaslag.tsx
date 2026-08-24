import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt } from '../components/ui'
import { korteDatum, toonNaam } from '../lib/personeel'
import { coupureNaam, euro, useTellingRegels, useTellingen } from '../lib/kas'

/* Terugkijken. Per dag alles, ook de coupures — zie je volgende week een
   verschil van vijftig, dan kun je nagaan of er die dag een briefje van vijftig
   in zat. Zie docs/Modules/kas.md. */

function Regels({ tellingId }: { tellingId: number }) {
  const { data, isPending } = useTellingRegels(tellingId)
  if (isPending) return <Laden />
  const rijen = (data ?? []).filter((r) => r.geteld > 0 || r.blijft > 0 || r.eruit > 0)
  if (rijen.length === 0) return <p className="px-4 pb-3 text-sm text-muted">Geen regels.</p>

  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <colgroup>
          <col />
          <col className="w-20" />
          <col className="w-20" />
          <col className="w-20" />
        </colgroup>
        <thead>
          <tr className="text-left">
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Coupure</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">Geteld</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">Blijft</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">Eruit</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.waarde_cent} className="border-t border-line">
              <td className="px-4 py-2 font-medium">{coupureNaam(r.waarde_cent)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.geteld}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted">{r.blijft}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted">{r.eruit || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function KasNaslag() {
  const { data, isPending, error, refetch } = useTellingen()
  const [open, setOpen] = useState<number | null>(null)

  if (isPending) return <Laden tekst="Tellingen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (data.length === 0) {
    return (
      <Leeg
        titel="Nog geen tellingen"
        uitleg="Zodra je een kastelling vastlegt, staat hij hier — met de coupures erbij."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Kopje>{data.length} {data.length === 1 ? 'telling' : 'tellingen'}</Kopje>

      {data.map((t) => {
        const uit = open === t.id
        return (
          <Kaart key={t.id}>
            <button
              type="button"
              onClick={() => setOpen(uit ? null : t.id)}
              aria-expanded={uit}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              {uit ? (
                <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{korteDatum(t.datum)}</span>
                <span className="block text-sm text-muted">
                  {toonNaam(t.door_naam)}
                  {t.opmerking ? ` · ${t.opmerking}` : ''}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-lg tabular-nums">{euro(t.geteld_cent)}</span>
                <span className="block text-sm text-muted">
                  {euro(t.eruit_biljet_cent)} briefgeld eruit
                </span>
              </span>
            </button>

            {uit && (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-sm">
                  <span>
                    <span className="block text-muted">Blijft in de lade</span>
                    <span className="font-semibold tabular-nums">{euro(t.blijft_cent)}</span>
                  </span>
                  <span>
                    <span className="block text-muted">Munten naar de kluis</span>
                    <span className="font-semibold tabular-nums">{euro(t.eruit_munt_cent)}</span>
                  </span>
                  <span>
                    <span className="block text-muted">Briefgeld naar de kluis</span>
                    <span className="font-semibold tabular-nums">{euro(t.eruit_biljet_cent)}</span>
                  </span>
                </div>
                <Regels tellingId={t.id} />
              </>
            )}
          </Kaart>
        )
      })}
    </div>
  )
}
