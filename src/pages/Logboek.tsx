import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Thermometer } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { supabase } from '../lib/supabase'

/* Terugkijken wat er geregistreerd is. Zie docs/modules/haccp/haccpmodule.md.
   Alleen lezen: een logboek waar dingen uit kunnen verdwijnen is geen logboek. */

type Regel = {
  id: number
  apparaat_naam: string
  temperatuur: number
  afwijking: boolean
  datum: string
  tijd: string
  door_naam: string | null
  employee_naam: string | null
  actie: string | null
  opmerking: string | null
}

const PERIODES = [
  { waarde: 7, label: '7 dagen' },
  { waarde: 30, label: '30 dagen' },
  { waarde: 90, label: '3 maanden' },
  { waarde: 365, label: 'Een jaar' },
]

function vanafDatum(dagen: number) {
  const d = new Date()
  d.setDate(d.getDate() - dagen + 1)
  return d.toLocaleDateString('sv-SE')
}

function dagLabel(datum: string) {
  const d = new Date(datum + 'T12:00:00')
  const vandaag = new Date().toLocaleDateString('sv-SE')
  const gisteren = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
  if (datum === vandaag) return 'Vandaag'
  if (datum === gisteren) return 'Gisteren'
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function useLogboek(dagen: number) {
  return useQuery({
    queryKey: ['logboek', dagen],
    queryFn: async (): Promise<Regel[]> => {
      const { data, error } = await supabase
        .from('haccp_temps')
        .select('id,apparaat_naam,temperatuur,afwijking,datum,tijd,door_naam,employee_naam,actie,opmerking')
        .gte('datum', vanafDatum(dagen))
        .order('datum', { ascending: false })
        .order('tijd', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Regel[]
    },
  })
}

export function Logboek() {
  const [dagen, setDagen] = useState(30)
  const [alleenAfwijkingen, setAlleenAfwijkingen] = useState(false)
  const { data, isPending, error, refetch } = useLogboek(dagen)

  if (isPending) return <Laden tekst="Logboek laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const zichtbaar = alleenAfwijkingen ? data.filter((r) => r.afwijking) : data
  const afwijkingen = data.filter((r) => r.afwijking).length

  const perDag = new Map<string, Regel[]>()
  zichtbaar.forEach((r) => {
    const lijst = perDag.get(r.datum) ?? []
    lijst.push(r)
    perDag.set(r.datum, lijst)
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <button
            key={p.waarde}
            type="button"
            onClick={() => setDagen(p.waarde)}
            className={`min-h-11 rounded-[4px] px-4 py-2.5 text-sm font-semibold transition-colors ${
              dagen === p.waarde ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Kaart className="flex-1 px-4 py-3">
          <p className="text-sm text-muted">Metingen</p>
          <p className="font-display text-2xl tabular-nums">{data.length}</p>
        </Kaart>
        <Kaart className={`flex-1 px-4 py-3 ${afwijkingen > 0 ? 'border-bad' : ''}`}>
          <p className="text-sm text-muted">Afwijkingen</p>
          <p className={`font-display text-2xl tabular-nums ${afwijkingen > 0 ? 'text-bad' : ''}`}>
            {afwijkingen}
          </p>
        </Kaart>
      </div>

      {afwijkingen > 0 && (
        <button
          type="button"
          onClick={() => setAlleenAfwijkingen((v) => !v)}
          className={`flex min-h-11 w-fit items-center gap-2 rounded-[4px] px-4 py-2.5 text-sm font-semibold ${
            alleenAfwijkingen ? 'bg-bad text-white' : 'border border-line-strong hover:bg-surface-2'
          }`}
        >
          <AlertTriangle className="size-4" aria-hidden />
          {alleenAfwijkingen ? 'Toon alles' : 'Alleen afwijkingen'}
        </button>
      )}

      {zichtbaar.length === 0 ? (
        <Leeg
          titel="Nog niets vastgelegd"
          uitleg="Zodra er een temperatuurronde is gedaan, staat hij hier — met wie hem deed en hoe laat."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {[...perDag.entries()].map(([datum, regels]) => (
            <section key={datum} className="flex flex-col gap-2">
              <Kopje>{dagLabel(datum)}</Kopje>
              <Kaart className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Apparaat</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Temp.</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Tijd</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Door</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regels.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b border-line last:border-b-0 ${r.afwijking ? 'bg-bad-soft' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-medium">
                          <span className="flex flex-wrap items-center gap-2">
                            <Thermometer className="size-4 shrink-0 text-muted" aria-hidden />
                            {r.apparaat_naam}
                            {r.afwijking && <Pil soort="fout">Afwijking</Pil>}
                          </span>
                          {(r.actie || r.opmerking) && (
                            <span className="mt-0.5 block text-sm text-muted">
                              {[r.actie, r.opmerking].filter(Boolean).join(' — ')}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${r.afwijking ? 'text-bad' : ''}`}>
                          {r.temperatuur} °C
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted">{(r.tijd ?? '').slice(0, 5)}</td>
                        <td className="px-4 py-2.5 text-muted">
                          {r.door_naam ?? r.employee_naam ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Kaart>
            </section>
          ))}
        </div>
      )}

      <p className="max-w-prose text-sm text-muted">
        Hier staat alles wat er geregistreerd is, ook de metingen uit de oude
        tabletapp. Er kan niets uit verdwijnen — een fout wordt gecorrigeerd met de
        correctie erbij, niet weggehaald.
      </p>
    </div>
  )
}
