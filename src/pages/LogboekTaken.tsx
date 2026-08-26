import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { supabase } from '../lib/supabase'
import { LIJSTEN, hoekLabel, type Lijst } from '../lib/taken'
import { TaakStatistiek } from '../components/TaakStatistiek'

/* Wat er is afgetekend, en vooral: wat niet. Dat laatste is waar je als
   eigenaar naar kijkt. */

type Vinkje = {
  taak_id: number
  datum: string
  gedaan_op: string
  door_naam: string | null
}

type TaakInfo = { id: number; naam: string; lijst: Lijst | null; hoek: string | null; ritme: string }

function vanafDatum(dagen: number) {
  const d = new Date()
  d.setDate(d.getDate() - dagen + 1)
  return d.toLocaleDateString('sv-SE')
}

function dagLabel(datum: string) {
  const vandaag = new Date().toLocaleDateString('sv-SE')
  const gisteren = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
  if (datum === vandaag) return 'Vandaag'
  if (datum === gisteren) return 'Gisteren'
  return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function useTakenLogboek(dagen: number) {
  return useQuery({
    queryKey: ['logboek-taken', dagen],
    queryFn: async () => {
      const [vinkjesRes, takenRes] = await Promise.all([
        supabase
          .from('haccp_taak_gedaan')
          .select('taak_id,datum,gedaan_op,door_naam')
          .gte('datum', vanafDatum(dagen))
          .order('datum', { ascending: false }),
        supabase
          .from('haccp_taken')
          .select('id,naam,lijst,hoek,ritme')
          .eq('actief', true)
          .not('lijst', 'is', null),
      ])
      if (vinkjesRes.error) throw new Error(vinkjesRes.error.message)
      if (takenRes.error) throw new Error(takenRes.error.message)
      return {
        vinkjes: (vinkjesRes.data ?? []) as unknown as Vinkje[],
        taken: (takenRes.data ?? []) as unknown as TaakInfo[],
      }
    },
  })
}

const PERIODES = [
  { waarde: 7, label: '7 dagen' },
  { waarde: 30, label: '30 dagen' },
  { waarde: 90, label: '3 maanden' },
]

export function LogboekTaken() {
  const [dagen, setDagen] = useState(7)
  const [open, setOpen] = useState<string | null>(null)
  const { data, isPending, error, refetch } = useTakenLogboek(dagen)

  if (isPending) return <Laden tekst="Taken laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const dagen_ = [...new Set(data.vinkjes.map((v) => v.datum))].sort().reverse()
  if (dagen_.length === 0) {
    return (
      <Leeg
        titel="Nog niets afgetekend"
        uitleg="Zodra iemand een werklijst aftikt, staat hier per dag wat er gedaan is en wat niet."
      />
    )
  }

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

      <TaakStatistiek dagen={dagen} />

      <div className="flex flex-col gap-4">
        {dagen_.map((datum) => {
          const vanDag = data.vinkjes.filter((v) => v.datum === datum)
          return (
            <section key={datum} className="flex flex-col gap-2">
              <Kopje>{dagLabel(datum)}</Kopje>
              <div className="flex flex-col gap-2">
                {LIJSTEN.map((l) => {
                  // Dagelijkse taken tellen altijd mee; een wekelijkse alleen als
                  // hij die dag ook echt is afgetekend, anders lijkt elke dag
                  // onvolledig.
                  const vanLijst = data.taken.filter((t) => t.lijst === l.waarde)
                  const dagelijks = vanLijst.filter((t) => t.ritme !== 'wekelijks')
                  const gedaanIds = new Set(vanDag.map((v) => v.taak_id))
                  const gedaan = vanLijst.filter((t) => gedaanIds.has(t.id))
                  const gemist = dagelijks.filter((t) => !gedaanIds.has(t.id))
                  if (gedaan.length === 0) return null

                  const sleutel = `${datum}-${l.waarde}`
                  const uit = open === sleutel
                  const compleet = gemist.length === 0
                  const namen = [...new Set(gedaan.map((t) => vanDag.find((v) => v.taak_id === t.id)?.door_naam).filter(Boolean))]

                  return (
                    <Kaart key={l.waarde} className={compleet ? 'border-good' : ''}>
                      <button
                        type="button"
                        onClick={() => setOpen(uit ? null : sleutel)}
                        aria-expanded={uit}
                        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                      >
                        {uit ? (
                          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{l.label}</span>
                          {namen.length > 0 && (
                            <span className="block text-sm text-muted">door {namen.join(', ')}</span>
                          )}
                        </span>
                        {compleet ? (
                          <Pil soort="goed">Compleet</Pil>
                        ) : (
                          <Pil soort="letop">{gemist.length} niet gedaan</Pil>
                        )}
                        <span className="text-sm tabular-nums text-muted">
                          {gedaan.length} / {dagelijks.length}
                        </span>
                      </button>

                      {uit && (
                        <div className="border-t border-line">
                          {gemist.length > 0 && (
                            <div className="px-4 py-3">
                              <p className="mb-1 text-sm font-semibold text-warn">Niet afgetekend</p>
                              <ul className="flex flex-col gap-0.5 text-sm text-muted">
                                {gemist.map((t) => (
                                  <li key={t.id}>
                                    {t.naam} <span className="opacity-60">· {hoekLabel(t.hoek ?? 'overig')}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="border-t border-line px-4 py-3">
                            <p className="mb-1 text-sm font-semibold">Wel afgetekend</p>
                            <ul className="flex flex-col gap-0.5 text-sm text-muted">
                              {gedaan.map((t) => {
                                const v = vanDag.find((x) => x.taak_id === t.id)
                                return (
                                  <li key={t.id}>
                                    {t.naam}
                                    <span className="opacity-60">
                                      {' · '}
                                      {hoekLabel(t.hoek ?? 'overig')}
                                      {v?.door_naam ? ` · ${v.door_naam}` : ''}
                                      {v?.gedaan_op
                                        ? ` · ${new Date(v.gedaan_op).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                                        : ''}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        </div>
                      )}
                    </Kaart>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <p className="max-w-prose text-sm text-muted">
        "Niet afgetekend" wordt geteld tegen de takenlijst zoals hij nu is. Heb je
        later taken toegevoegd of weggehaald, dan klopt dat aantal voor oude dagen
        niet helemaal — wat er wél is afgetekend klopt altijd.
      </p>
    </div>
  )
}
