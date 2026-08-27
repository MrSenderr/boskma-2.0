import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { supabase } from '../lib/supabase'
import { LIJSTEN, hoekLabel, type Lijst } from '../lib/taken'
import { toonNaam } from '../lib/personeel'
import { TaakStatistiek } from '../components/TaakStatistiek'

/* Wat er is afgetekend, en vooral: wat niet. Dat laatste is waar je als
   eigenaar naar kijkt. */

type Vinkje = {
  taak_id: number
  datum: string
  gedaan_op: string
  door_naam: string | null
}

type TaakInfo = {
  id: number
  naam: string
  lijst: Lijst | null
  hoek: string | null
  ritme: string
  volgorde: number | null
}

/** De hoeken die in deze lijst voorkomen, in de volgorde van de taken zelf.
 *  Een eigen versie omdat het logboek maar een paar velden per taak ophaalt. */
function hoekenHier(taken: TaakInfo[]) {
  const gezien: string[] = []
  taken
    .slice()
    .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
    .forEach((t) => {
      const h = t.hoek ?? 'overig'
      if (!gezien.includes(h)) gezien.push(h)
    })
  return gezien
}

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
          .select('id,naam,lijst,hoek,ritme,volgorde')
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
                          {/* Per hoek, zoals op de werklijst zelf. Twee platte
                              lijsten van tachtig taken zoek je met je ogen; per
                              hoek weet je meteen waar je moet kijken. */}
                          {hoekenHier(vanLijst).map((hoek) => {
                            const inHoek = vanLijst
                              .filter((t) => (t.hoek ?? 'overig') === hoek)
                              .filter((t) => t.ritme !== 'wekelijks' || gedaanIds.has(t.id))
                              .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
                            if (inHoek.length === 0) return null
                            const afHoek = inHoek.filter((t) => gedaanIds.has(t.id)).length

                            return (
                              <div key={hoek} className="border-b border-line last:border-b-0">
                                <p className="flex flex-wrap items-baseline justify-between gap-2 bg-surface-2 px-4 py-1.5">
                                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                                    {hoekLabel(hoek)}
                                  </span>
                                  <span
                                    className={`text-sm tabular-nums ${
                                      afHoek === inHoek.length ? 'text-good' : 'text-warn'
                                    }`}
                                  >
                                    {afHoek} van {inHoek.length}
                                  </span>
                                </p>

                                <ul className="flex flex-col">
                                  {inHoek.map((t) => {
                                    const v = vanDag.find((x) => x.taak_id === t.id)
                                    const af = Boolean(v)
                                    return (
                                      <li
                                        key={t.id}
                                        className="flex items-start gap-2 px-4 py-1.5 text-sm"
                                      >
                                        {af ? (
                                          <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                                        ) : (
                                          <span
                                            className="mt-1 size-3 shrink-0 rounded-full border-[1.5px] border-warn"
                                            aria-hidden
                                          />
                                        )}
                                        <span className={`min-w-0 flex-1 ${af ? '' : 'font-medium text-warn'}`}>
                                          {t.naam}
                                          {af && (v?.door_naam || v?.gedaan_op) && (
                                            <span className="text-muted">
                                              {' · '}
                                              {[
                                                v?.door_naam ? toonNaam(v.door_naam) : null,
                                                v?.gedaan_op
                                                  ? new Date(v.gedaan_op).toLocaleTimeString('nl-NL', {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                    })
                                                  : null,
                                              ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                            </span>
                                          )}
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )
                          })}
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
