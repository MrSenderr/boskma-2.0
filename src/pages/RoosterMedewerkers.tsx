import { useState } from 'react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { naarKlok, naarUren } from '../lib/eitje'
import {
  afwijkendeDagen,
  datumKort,
  dagnaam,
  statistiek,
  useRooster,
} from '../lib/rooster'

/* De periodes die je in de praktijk wilt zien. "Vorige maand" staat vooraan
   omdat je daar pas over praat als hij voorbij is. */
function periodes(vandaag = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const jaar = vandaag.getFullYear()
  const maand = vandaag.getMonth()
  const eerste = (j: number, m: number) => iso(new Date(Date.UTC(j, m, 1)))
  const laatste = (j: number, m: number) => iso(new Date(Date.UTC(j, m + 1, 0)))

  return [
    { sleutel: 'vorige', label: 'Vorige maand', van: eerste(jaar, maand - 1), tot: laatste(jaar, maand - 1) },
    { sleutel: 'deze', label: 'Deze maand', van: eerste(jaar, maand), tot: laatste(jaar, maand) },
    { sleutel: 'kwartaal', label: 'Laatste 3 maanden', van: eerste(jaar, maand - 2), tot: iso(vandaag) },
    { sleutel: 'jaar', label: 'Dit jaar', van: `${jaar}-01-01`, tot: iso(vandaag) },
  ]
}

function Balk({ deel }: { deel: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full rounded-full bg-accent" style={{ width: `${deel * 100}%` }} />
    </span>
  )
}

export function RoosterMedewerkers() {
  const keuzes = periodes()
  const [gekozen, setGekozen] = useState(keuzes[1])
  const { data, isPending, error, refetch } = useRooster(gekozen.van, gekozen.tot)

  const rijen = data ? statistiek(data.gepland, data.gewerkt) : []
  const afwijkend = data ? afwijkendeDagen(data.gepland, data.gewerkt) : []
  const meeste = Math.max(1, ...rijen.map((r) => r.gewerkt))

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2">
        {keuzes.map((p) => (
          <button
            key={p.sleutel}
            type="button"
            onClick={() => setGekozen(p)}
            aria-pressed={p.sleutel === gekozen.sleutel}
            className={`min-h-11 rounded-[4px] border-[1.5px] px-3 text-sm font-semibold transition-colors ${
              p.sleutel === gekozen.sleutel
                ? 'border-accent bg-surface-2'
                : 'border-line-strong hover:bg-surface-2'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {isPending && <Laden tekst="Uren optellen…" />}
      {error && <Mislukt tekst={error.message} opnieuw={() => refetch()} />}

      {data && rijen.length === 0 && (
        <Leeg
          titel="Over deze periode is niets bekend"
          uitleg="Importeer eerst een export uit eitje."
        />
      )}

      {rijen.length > 0 && (
        <Kaart className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-semibold">Medewerker</th>
                <th className="px-4 py-3 text-right font-semibold">Gepland</th>
                <th className="px-4 py-3 text-right font-semibold">Gewerkt</th>
                <th className="px-4 py-3 text-right font-semibold">Verschil</th>
                <th className="px-4 py-3 text-right font-semibold">Diensten</th>
                <th className="px-4 py-3 text-right font-semibold">Dagen</th>
                <th className="px-4 py-3 text-right font-semibold">Langste</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.sleutel} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2 font-semibold">
                        {r.naam}
                        {!r.medewerker_id && <Pil soort="letop">Niet gekoppeld</Pil>}
                      </span>
                      <Balk deel={r.gewerkt / meeste} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{naarKlok(r.gepland)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {naarKlok(r.gewerkt)}
                    <span className="block text-xs font-normal text-muted">
                      {naarUren(r.gewerkt)} uur
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.vergelijkbaar === 0 && r.gewerkt === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={r.verschil > 29 ? 'text-warn' : r.verschil < -29 ? 'text-bad' : 'text-good'}>
                        {r.verschil > 0 ? '+' : ''}
                        {naarKlok(r.verschil)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.shifts}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.dagen}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{naarKlok(r.langste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kaart>
      )}

      {rijen.length > 0 && (
        <p className="max-w-2xl text-sm text-muted">
          Het verschil gaat alleen over dagen waarvan de gewerkte uren zijn ingelezen. Een week die
          wel op het rooster staat maar waarvan de urenregistratie nog moet komen, telt dus niet mee
          als gemiste dienst — die staat alleen bij Gepland.
        </p>
      )}

      {afwijkend.length > 0 && (
        <div className="flex flex-col gap-3">
          <Kopje>Dagen waarop het anders liep</Kopje>
          <p className="max-w-2xl text-sm text-muted">
            Een half uur of meer verschil tussen wat er stond en wat er gewerkt is. Langer
            doorgewerkt staat in het oranje, korter of helemaal niet gekomen in het rood.
          </p>
          <Kaart>
            <ul className="divide-y divide-line">
              {afwijkend.slice(0, 25).map((dag) => (
                <li key={`${dag.naam}-${dag.datum}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{dag.naam}</span>
                    <span className="text-xs text-muted">
                      {dagnaam(dag.datum, true)} {datumKort(dag.datum)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-sm tabular-nums">
                    <span className="text-muted">
                      {naarKlok(dag.gepland)} → {naarKlok(dag.gewerkt)}
                    </span>
                    <Pil soort={dag.verschil > 0 ? 'letop' : 'fout'}>
                      {dag.verschil > 0 ? '+' : ''}
                      {naarKlok(dag.verschil)}
                    </Pil>
                  </span>
                </li>
              ))}
            </ul>
          </Kaart>
        </div>
      )}
    </div>
  )
}
