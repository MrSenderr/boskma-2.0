import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt } from '../components/ui'
import { GetalVeld } from '../components/GetalVeld'
import { supabase } from '../lib/supabase'
import { useDoelen } from '../lib/stuksprijzen'
import { useSamenstellingen } from '../lib/samenstellingen'

/* Waar de adviesprijzen op rusten.

   Eén doel voor alles deugt niet: een frikandel van 45 cent haalt met gemak
   19%, maar een Magnum van € 1,91 kun je nooit voor € 6,80 verkopen — daar is
   60% gewoon goed en verdien je een euro per stuk. Vandaar een doel per groep,
   met het algemene doel als terugval. */

const inkoop = supabase.schema('inkoop')

function useInstelling() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ sleutel, waarde }: { sleutel: string; waarde: number }) => {
      const { error } = await inkoop
        .from('instellingen')
        .upsert({ sleutel, waarde: String(waarde) }, { onConflict: 'sleutel' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['inkoop', 'doelen'] }),
  })
}

function useGroepsdoel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ groep, doel }: { groep: string; doel: number | null }) => {
      // Geen doel is geen rij: dan geldt het algemene doel weer.
      const { error } =
        doel === null || doel <= 0 || doel > 1
          ? await inkoop.from('foodcost_doelen').delete().eq('groep', groep)
          : await inkoop
              .from('foodcost_doelen')
              .upsert({ groep, doel: String(doel) }, { onConflict: 'groep' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['inkoop', 'doelen'] }),
  })
}

function Percentage({
  label,
  waarde,
  uitleg,
  onWijzig,
}: {
  label: string
  waarde: number
  uitleg: string
  onWijzig: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <GetalVeld
        label={label}
        waarde={Math.round(waarde * 1000) / 10}
        onWijzig={(n) => n !== null && n > 0 && onWijzig(n / 100)}
        placeholder="28"
      />
      <span className="text-sm text-muted">{uitleg}</span>
    </div>
  )
}

export function InkoopInstellingen() {
  const doelen = useDoelen()
  const producten = useSamenstellingen()
  const instelling = useInstelling()
  const groepsdoel = useGroepsdoel()
  const [nieuweGroep, setNieuweGroep] = useState('')
  const [nieuwDoel, setNieuwDoel] = useState<number | null>(null)

  if (doelen.isPending) return <Laden tekst="Instellingen ophalen…" />
  if (doelen.error) return <Mislukt tekst={doelen.error.message} opnieuw={() => doelen.refetch()} />

  const d = doelen.data
  const groepen = [...new Set(producten.alles.map((s) => s.groep).filter(Boolean))] as string[]
  const metEigenDoel = Object.keys(d.perGroep)
  const zonderDoel = groepen.filter((g) => !metEigenDoel.includes(g))

  return (
    <div className="flex flex-col gap-5">
      <Kaart className="flex flex-col gap-4 p-4">
        <p className="font-display text-lg">Algemeen</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Percentage
            label="Foodcost-doel"
            waarde={d.algemeen}
            uitleg="Welk deel van je verkoopprijs de inkoop mag kosten."
            onWijzig={(n) => instelling.mutate({ sleutel: 'foodcost', waarde: n })}
          />
          <Percentage
            label="Btw"
            waarde={d.btw}
            uitleg="Waarmee de adviesprijzen worden verhoogd."
            onWijzig={(n) => instelling.mutate({ sleutel: 'btw_tarief', waarde: n })}
          />
          <Percentage
            label="Opslag frituurvet"
            waarde={d.vetOpslag}
            uitleg="Telt mee bij producten waarbij je aangeeft dat ze gefrituurd worden."
            onWijzig={(n) => instelling.mutate({ sleutel: 'vet_opslag', waarde: n })}
          />
        </div>

        {instelling.error && <p className="text-sm text-bad">{instelling.error.message}</p>}
      </Kaart>

      <Kaart className="flex flex-col gap-4 p-4">
        <div>
          <p className="font-display text-lg">Doel per groep</p>
          <p className="mt-1 text-sm text-muted">
            Een frikandel van 45 cent haalt met gemak 19%, maar een Magnum van € 1,91 kun je nooit
            voor € 6,80 verkopen — daar is 60% gewoon goed en verdien je een euro per stuk. Een
            groep zonder eigen doel volgt de {(d.algemeen * 100).toFixed(0)}% hierboven.
          </p>
        </div>

        {metEigenDoel.length > 0 && (
          <div className="flex flex-col">
            {metEigenDoel.map((groep) => (
              <div
                key={groep}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
              >
                <span>{groep}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{(d.perGroep[groep] * 100).toFixed(0)}%</span>
                  <button
                    type="button"
                    onClick={() => groepsdoel.mutate({ groep, doel: null })}
                    aria-label={`Eigen doel voor ${groep} weghalen`}
                    className="text-muted hover:text-bad"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-muted">Groep</span>
            <select
              value={nieuweGroep}
              onChange={(e) => setNieuweGroep(e.target.value)}
              className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 outline-none focus:border-accent"
            >
              <option value="">Kies een groep</option>
              {zonderDoel.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <div className="w-28">
            <GetalVeld label="Doel in %" waarde={nieuwDoel} onWijzig={setNieuwDoel} placeholder="60" />
          </div>
          <Knop
            disabled={!nieuweGroep || !nieuwDoel}
            bezig={groepsdoel.isPending}
            onClick={async () => {
              if (!nieuweGroep || !nieuwDoel) return
              await groepsdoel.mutateAsync({ groep: nieuweGroep, doel: nieuwDoel / 100 })
              setNieuweGroep('')
              setNieuwDoel(null)
            }}
          >
            Instellen
          </Knop>
        </div>

        {zonderDoel.length === 0 && metEigenDoel.length === 0 && (
          <p className="text-sm text-muted">
            Zodra je producten in groepen zet, kun je hier per groep een eigen doel geven.
          </p>
        )}

        {groepsdoel.error && <p className="text-sm text-bad">{groepsdoel.error.message}</p>}
      </Kaart>
    </div>
  )
}
