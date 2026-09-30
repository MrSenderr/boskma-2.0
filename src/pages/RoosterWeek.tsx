import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Kaart, Knop, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { naarKlok } from '../lib/eitje'
import {
  dagnaam,
  dagoverzicht,
  datumKort,
  maandagVan,
  useRooster,
  verschuif,
  weekVan,
  weeknummer,
  type Dagregel,
} from '../lib/rooster'

/** Hoe ver het gewerkt afwijkt van wat er stond. Een kwartier is ruis; daarom
 *  pas een pil zodra het een half uur scheelt. */
function Verschil({ regel }: { regel: Dagregel }) {
  if (regel.gewerkt === 0) return null
  const verschil = regel.gewerkt - regel.gepland
  if (regel.onverwacht) return <Pil soort="letop">Niet ingepland</Pil>
  if (Math.abs(verschil) < 30) return <Pil soort="goed">Zoals gepland</Pil>
  return (
    <Pil soort={verschil > 0 ? 'letop' : 'fout'}>
      {verschil > 0 ? '+' : ''}
      {naarKlok(verschil)}
    </Pil>
  )
}

function Dag({ datum, regels }: { datum: string; regels: Dagregel[] }) {
  const gepland = regels.reduce((s, r) => s + r.gepland, 0)
  const gewerkt = regels.reduce((s, r) => s + r.gewerkt, 0)
  const vandaag = datum === new Date().toISOString().slice(0, 10)

  return (
    <Kaart className={`flex flex-col ${vandaag ? 'border-accent' : ''}`}>
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2.5">
        <span className="text-sm font-semibold">
          {dagnaam(datum)} {datumKort(datum)}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {naarKlok(gepland)}
          {gewerkt > 0 && ` → ${naarKlok(gewerkt)}`}
        </span>
      </div>

      {regels.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">Niemand ingeroosterd.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {regels.map((regel) => (
            <li key={regel.sleutel} className="flex flex-col gap-1 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-sm font-semibold ${regel.open ? 'text-bad' : ''}`}>
                  {regel.open ? 'Nog niemand' : regel.naam}
                </span>
                <Verschil regel={regel} />
              </div>
              <span className="text-xs tabular-nums text-muted">
                {regel.geplandTijd ?? regel.gewerktTijd}
                {regel.gewerktTijd && regel.geplandTijd && regel.gewerktTijd !== regel.geplandTijd && (
                  <> → {regel.gewerktTijd}</>
                )}
              </span>
              {regel.team && <span className="text-xs text-muted">{regel.team}</span>}
            </li>
          ))}
        </ul>
      )}
    </Kaart>
  )
}

export function RoosterWeek() {
  const [maandag, setMaandag] = useState(() => maandagVan(new Date()))
  const zondag = verschuif(maandag, 6)
  const { data, isPending, error, refetch } = useRooster(maandag, zondag)

  const dagen = weekVan(maandag)
  const overzicht = data ? dagoverzicht(data.gepland, data.gewerkt) : new Map()
  const totaalGepland = data?.gepland.reduce((s, r) => s + r.minuten, 0) ?? 0
  const totaalGewerkt = data?.gewerkt.reduce((s, r) => s + r.minuten, 0) ?? 0
  const dezeWeek = maandag === maandagVan(new Date())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Knop soort="rustig" onClick={() => setMaandag(verschuif(maandag, -7))} aria-label="Vorige week">
            <ChevronLeft className="size-4" aria-hidden />
          </Knop>
          <div className="min-w-44 text-center">
            <p className="font-display text-lg">Week {weeknummer(maandag)}</p>
            <p className="text-sm text-muted">
              {datumKort(maandag)} – {datumKort(zondag)}
            </p>
          </div>
          <Knop soort="rustig" onClick={() => setMaandag(verschuif(maandag, 7))} aria-label="Volgende week">
            <ChevronRight className="size-4" aria-hidden />
          </Knop>
          {!dezeWeek && (
            <Knop soort="rustig" onClick={() => setMaandag(maandagVan(new Date()))}>
              Deze week
            </Knop>
          )}
        </div>

        {data && (
          <p className="text-sm text-muted">
            <span className="tabular-nums">{naarKlok(totaalGepland)}</span> gepland
            {totaalGewerkt > 0 && (
              <>
                , <span className="tabular-nums">{naarKlok(totaalGewerkt)}</span> gewerkt
              </>
            )}
          </p>
        )}
      </div>

      {isPending && <Laden tekst="Rooster ophalen…" />}
      {error && <Mislukt tekst={error.message} opnieuw={() => refetch()} />}

      {data && totaalGepland === 0 && totaalGewerkt === 0 && (
        <Leeg
          titel="Voor deze week staat er niets"
          uitleg="Importeer de export uit eitje, dan verschijnt het rooster hier."
        />
      )}

      {data && (totaalGepland > 0 || totaalGewerkt > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {dagen.map((datum) => (
            <Dag key={datum} datum={datum} regels={overzicht.get(datum) ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}
