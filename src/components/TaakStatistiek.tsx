import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { Kaart, Kopje, Laden } from './ui'
import { supabase } from '../lib/supabase'
import { toonNaam } from '../lib/personeel'

/* Wie tikt er hoeveel taken af. Zie docs/Modules/haccp/haccpmodule.md.

   Het hoofdgetal is het gemiddelde per dag dat iemand werkte, niet het totaal.
   De sluitlijst heeft 82 taken en de openlijst 21, dus wie 's avonds werkt zou
   anders altijd bovenaan staan — en wie meer diensten draait ook. Dan meet je
   het rooster in plaats van het werk.

   Alleen in het beheer. Een zichtbaar scorebord verandert gedrag: dan wordt
   aftikken het doel in plaats van het werk. */

type Regel = { naam: string; taken: number; dagen: number; per_dag: number }

function vanafDatum(dagen: number) {
  const d = new Date()
  d.setDate(d.getDate() - dagen + 1)
  return d.toLocaleDateString('sv-SE')
}

function useStatistiek(dagen: number) {
  return useQuery({
    queryKey: ['taak-statistiek', dagen],
    queryFn: async (): Promise<Regel[]> => {
      const { data, error } = await supabase.rpc('taak_statistiek', {
        vanaf: vanafDatum(dagen),
        tot: new Date().toLocaleDateString('sv-SE'),
      })
      if (error) throw new Error(error.message)
      return (data ?? []) as Regel[]
    },
  })
}

export function TaakStatistiek({ dagen }: { dagen: number }) {
  const { data, isPending, error } = useStatistiek(dagen)

  if (isPending) return <Laden />
  if (error) {
    return (
      <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
        De cijfers konden niet geladen worden: {error.message}
      </p>
    )
  }
  if (data.length === 0) return null

  const hoogste = Math.max(...data.map((r) => r.per_dag))

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Wie tikt er af</Kopje>

      <Kaart className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-line-strong text-left">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Wie</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                Per werkdag
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Dagen</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.naam} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 font-medium">
                  <span className="flex flex-wrap items-center gap-2">
                    {i === 0 && data.length > 1 && (
                      <Trophy className="size-4 shrink-0 text-accent" aria-hidden />
                    )}
                    {toonNaam(r.naam)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="flex items-center justify-end gap-2">
                    <span
                      className="hidden h-2 rounded-full bg-brand sm:block"
                      style={{ width: `${Math.max(4, (r.per_dag / hoogste) * 56)}px` }}
                      aria-hidden
                    />
                    <span className="font-bold tabular-nums">{r.per_dag}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.dagen}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.taken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>

      <p className="max-w-prose text-sm text-muted">
        Het gemiddelde per dag dat iemand werkte, niet het totaal — anders staat
        wie de meeste diensten draait vanzelf bovenaan. "Dagen" is het aantal
        dagen waarop diegene iets aftikte; een rooster staat niet in de app.
      </p>
      <p className="max-w-prose text-sm text-muted">
        Lees het met een korrel zout: de sluitlijst heeft 82 taken en de openlijst
        21, dus wie vaker sluit komt hoger uit. Het zegt iets over wie er werk
        verzet, niet over wie de beste is.
      </p>
    </section>
  )
}
