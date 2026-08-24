import { useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Droplet, Truck } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { korteDatum } from '../lib/personeel'
import {
  isoWeekVan,
  useWeekAftikken,
  useWeekakkoord,
  useWeekoverzicht,
  vorigeWeek,
  volgendeWeek,
  weekGrenzen,
  type WeekNummer,
} from '../lib/week'

/* De weekafsluiting. Zie docs/Modules/haccp/haccpmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function dagNaam(datum: string) {
  return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function Week() {
  // Standaard de week die net voorbij is: die tik je af, niet de lopende.
  const [week, setWeek] = useState<WeekNummer>(() => vorigeWeek(isoWeekVan(new Date())))
  const { data, isPending, error, refetch } = useWeekoverzicht(week)
  const { data: akkoord } = useWeekakkoord(week)
  const aftikken = useWeekAftikken()
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  const nu = isoWeekVan(new Date())
  const isToekomst = week.jaar > nu.jaar || (week.jaar === nu.jaar && week.week >= nu.week)
  const grenzen = weekGrenzen(week)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kopje>Week {week.week} — {week.jaar}</Kopje>
          <p className="mt-1 font-display text-xl">
            {korteDatum(grenzen.van)} t/m {korteDatum(grenzen.tot)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWeek(vorigeWeek(week))}
            aria-label="Week terug"
            className="flex size-11 items-center justify-center rounded-[4px] border border-line-strong hover:bg-surface-2"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setWeek(volgendeWeek(week))}
            disabled={isToekomst}
            aria-label="Week vooruit"
            className="flex size-11 items-center justify-center rounded-[4px] border border-line-strong hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {akkoord && (
        <p className="flex flex-wrap items-center gap-2 rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
          <Check className="size-4 shrink-0" aria-hidden />
          Nagekeken op {korteDatum(akkoord.akkoord_op)}
          {akkoord.door ? ` door ${akkoord.door}` : ''}.
          {akkoord.opmerking ? ` ${akkoord.opmerking}` : ''}
        </p>
      )}

      {isPending ? (
        <Laden tekst="Week laden…" />
      ) : error ? (
        <Mislukt tekst={error.message} opnieuw={() => refetch()} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <Kopje>Temperaturen</Kopje>
            <Kaart className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Dag</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Opening</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Sluiting</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dagen.map((d) => (
                    <tr key={d.datum} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">{dagNaam(d.datum)}</td>
                      {d.rondes.map((r) => {
                        const compleet = r.totaal > 0 && r.gedaan === r.totaal
                        const niets = r.gedaan === 0
                        return (
                          <td key={r.moment} className="px-4 py-2.5 tabular-nums">
                            {r.totaal === 0 ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <span className={compleet ? 'text-good' : niets ? 'text-bad' : 'text-warn'}>
                                {r.gedaan} van {r.totaal}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kaart>
            <p className="text-sm text-muted">
              Hoeveel er gemeten had moeten worden, wordt afgeleid uit de apparaten
              zoals ze nu staan. Is er later een koeling bijgekomen, dan lijkt het
              alsof die er toen ook al stond.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <Kopje>Afwijkingen</Kopje>
            {data.afwijkingen.length === 0 ? (
              <Kaart className="p-4">
                <p className="text-sm text-muted">Geen afwijkingen deze week.</p>
              </Kaart>
            ) : (
              <Kaart>
                {data.afwijkingen.map((m) => (
                  <div key={m.id} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-bad" aria-hidden />
                      <span className="font-medium">{m.apparaat_naam}</span>
                      <span className="font-bold tabular-nums text-bad">{m.temperatuur} °C</span>
                      <span className="text-sm text-muted">
                        {dagNaam(m.datum)} {(m.tijd ?? '').slice(0, 5)}
                      </span>
                    </span>
                    <span className="text-sm">
                      {m.actie ? (
                        <>Actie: {[m.actie, m.opmerking].filter(Boolean).join(' — ')}</>
                      ) : (
                        <span className="text-bad">Geen actie vastgelegd.</span>
                      )}
                    </span>
                  </div>
                ))}
              </Kaart>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <Kaart className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="text-sm text-muted">Taken afgevinkt</p>
              <p className="font-display text-2xl tabular-nums">{data.takenGedaan}</p>
            </Kaart>
            <Kaart className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Truck className="size-4" aria-hidden />
                Leveringen
              </p>
              <p className="font-display text-2xl tabular-nums">{data.leveringen.length}</p>
            </Kaart>
            <Kaart className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Droplet className="size-4" aria-hidden />
                Vet doorgeschoven
              </p>
              <p className="font-display text-2xl tabular-nums">{data.doorschuiven.length}</p>
            </Kaart>
          </div>

          {data.leveringen.length > 0 && (
            <section className="flex flex-col gap-3">
              <Kopje>Leveringen</Kopje>
              <Kaart>
                {data.leveringen.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted">{dagNaam(l.datum)}</span>
                    <span className="min-w-0 flex-1 font-medium">{l.leverancier}</span>
                    <span className="font-bold tabular-nums">{l.temperatuur} °C</span>
                    {l.ok ? <Pil soort="goed">Aangenomen</Pil> : <Pil soort="fout">Geweigerd</Pil>}
                    {l.opmerking && <span className="w-full text-muted">{l.opmerking}</span>}
                  </div>
                ))}
              </Kaart>
            </section>
          )}

          {fout && (
            <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
          )}

          {!akkoord && !isToekomst && (
            <section className="flex flex-col gap-3">
              <Kopje>Afsluiten</Kopje>
              <Kaart className="flex flex-col gap-3 p-4">
                <input
                  className={invoer}
                  value={opmerking}
                  onChange={(e) => setOpmerking(e.target.value)}
                  placeholder="Opmerking bij deze week (mag leeg)"
                  aria-label="Opmerking bij deze week"
                />
                <Knop
                  soort="primair"
                  bezig={aftikken.isPending}
                  onClick={() =>
                    aftikken.mutate(
                      { week, opmerking: opmerking.trim() || null },
                      { onError: (e) => setFout(e.message) },
                    )
                  }
                >
                  <Check className="size-4" aria-hidden />
                  Ik heb deze week nagekeken
                </Knop>
                <p className="text-sm text-muted">
                  Hiermee zet je je akkoord onder deze week, met datum. Dat is de
                  handtekening die bij een controle gevraagd wordt. Terugdraaien
                  kan niet.
                </p>
              </Kaart>
            </section>
          )}
        </>
      )}
    </div>
  )
}
