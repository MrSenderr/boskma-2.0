import { useState } from 'react'
import { Truck } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { useLeveringen } from '../lib/leveringen'
import { toonNaam } from '../lib/personeel'

/* Wat er binnenkwam, hoe koud, en of het is aangenomen. Alleen lezen: een
   levering die is afgetekend blijft staan. Zie
   docs/Modules/haccp/haccpmodule.md. */

const PERIODES = [
  { waarde: 30, label: '30 dagen' },
  { waarde: 90, label: '3 maanden' },
  { waarde: 365, label: 'Een jaar' },
]

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

export function Leveringen() {
  const [dagen, setDagen] = useState(30)
  const [alleenGeweigerd, setAlleenGeweigerd] = useState(false)
  const { data, isPending, error, refetch } = useLeveringen(dagen)

  if (isPending) return <Laden tekst="Leveringen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const geweigerd = data.filter((l) => !l.ok).length
  const zichtbaar = alleenGeweigerd ? data.filter((l) => !l.ok) : data

  const perDag = new Map<string, typeof data>()
  zichtbaar.forEach((l) => {
    const lijst = perDag.get(l.datum) ?? []
    lijst.push(l)
    perDag.set(l.datum, lijst)
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
          <p className="text-sm text-muted">Leveringen</p>
          <p className="font-display text-2xl tabular-nums">{data.length}</p>
        </Kaart>
        <Kaart className={`flex-1 px-4 py-3 ${geweigerd > 0 ? 'border-bad' : ''}`}>
          <p className="text-sm text-muted">Geweigerd</p>
          <p className={`font-display text-2xl tabular-nums ${geweigerd > 0 ? 'text-bad' : ''}`}>
            {geweigerd}
          </p>
        </Kaart>
      </div>

      {geweigerd > 0 && (
        <button
          type="button"
          onClick={() => setAlleenGeweigerd((v) => !v)}
          className={`flex min-h-11 w-fit items-center gap-2 rounded-[4px] px-4 py-2.5 text-sm font-semibold ${
            alleenGeweigerd ? 'bg-bad text-white' : 'border border-line-strong hover:bg-surface-2'
          }`}
        >
          {alleenGeweigerd ? 'Toon alles' : 'Alleen geweigerd'}
        </button>
      )}

      {zichtbaar.length === 0 ? (
        <Leeg
          titel="Nog niets afgetekend"
          uitleg="Zodra er een levering wordt aangenomen, staat hij hier — met de temperatuur en wie hem aannam."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {[...perDag.entries()].map(([datum, regels]) => (
            <section key={datum} className="flex flex-col gap-2">
              <Kopje>{dagLabel(datum)}</Kopje>
              <Kaart>
                {regels.map((l) => (
                  <div
                    key={l.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 ${
                      l.ok ? '' : 'bg-bad-soft'
                    }`}
                  >
                    <Truck className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 font-medium">{l.leverancier}</span>
                    <span className={`font-bold tabular-nums ${l.ok ? '' : 'text-bad'}`}>
                      {l.temperatuur} °C
                    </span>
                    {l.ok ? <Pil soort="goed">Aangenomen</Pil> : <Pil soort="fout">Geweigerd</Pil>}
                    <span className="text-sm text-muted">{toonNaam(l.door_naam ?? l.employee_naam)}</span>
                    {l.opmerking && <span className="w-full text-sm text-muted">{l.opmerking}</span>}
                  </div>
                ))}
              </Kaart>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
