import { useState } from 'react'
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import {
  coupureNaam,
  euro,
  kasbedrag,
  tel,
  useCoupures,
  useTellingBewaren,
  verdeel,
} from '../lib/kas'

/* De kastelling. Zie docs/Modules/kas.md.

   Twee stappen: eerst de lade tellen, dan zien wat er blijft en wat eruit gaat.
   Het totaal loopt tijdens het tellen mee, want dat is het getal dat je in NTF
   overtikt. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-right text-lg font-bold tabular-nums outline-none focus:border-accent'

export function KasTellen() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data: coupures, isPending, error, refetch } = useCoupures()
  const bewaren = useTellingBewaren()

  const [aantallen, setAantallen] = useState<Record<number, number>>({})
  const [stap, setStap] = useState<'tellen' | 'splitsen'>('tellen')
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState(false)

  if (isPending) return <Laden tekst="Coupures laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const verdeling = verdeel(coupures, aantallen)
  const totalen = tel(verdeling)
  const gewenst = kasbedrag(coupures)

  if (klaar) {
    return (
      <div className="flex flex-col gap-4">
        <Kaart className="flex flex-col gap-2 border-good p-5">
          <p className="flex items-center gap-2 font-display text-xl text-good">
            <Check className="size-5 shrink-0" aria-hidden />
            Telling vastgelegd
          </p>
          <p className="text-sm">
            Geteld {euro(totalen.geteld)} · blijft in de lade {euro(totalen.blijft)} ·
            naar de kluis {euro(totalen.eruitMunt + totalen.eruitBiljet)}, waarvan{' '}
            {euro(totalen.eruitBiljet)} briefgeld.
          </p>
        </Kaart>
        <Knop
          soort="rustig"
          className="w-fit"
          onClick={() => {
            setAantallen({})
            setOpmerking('')
            setStap('tellen')
            setKlaar(false)
          }}
        >
          Nieuwe telling
        </Knop>
      </div>
    )
  }

  if (stap === 'splitsen') {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setStap('tellen')}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar de telling
        </button>

        <div className="flex flex-wrap gap-3">
          <Kaart className="min-w-[9rem] flex-1 px-4 py-3">
            <p className="text-sm text-muted">Geteld</p>
            <p className="font-display text-2xl tabular-nums">{euro(totalen.geteld)}</p>
          </Kaart>
          <Kaart className="min-w-[9rem] flex-1 px-4 py-3">
            <p className="text-sm text-muted">Blijft in de lade</p>
            <p className="font-display text-2xl tabular-nums">{euro(totalen.blijft)}</p>
          </Kaart>
          <Kaart className="min-w-[9rem] flex-1 px-4 py-3">
            <p className="text-sm text-muted">Naar de kluis</p>
            <p className="font-display text-2xl tabular-nums">
              {euro(totalen.eruitMunt + totalen.eruitBiljet)}
            </p>
          </Kaart>
        </div>

        {totalen.tekort.length > 0 && (
          <Kaart className="flex flex-col gap-2 border-warn bg-warn-soft p-4">
            <p className="flex items-center gap-2 font-semibold text-warn">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Je komt wisselgeld tekort
            </p>
            <ul className="flex flex-col gap-0.5 text-sm">
              {totalen.tekort.map((t) => (
                <li key={t.waarde_cent}>
                  {t.tekort}× {coupureNaam(t.waarde_cent)} te weinig
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              Kijk of het in de kluis ligt, of regel het voordat je morgen opengaat.
            </p>
          </Kaart>
        )}

        <Kaart className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-line-strong text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Coupure</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Geteld</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Blijft</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Eruit</th>
              </tr>
            </thead>
            <tbody>
              {verdeling.map((v) => (
                <tr key={v.waarde_cent} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{coupureNaam(v.waarde_cent)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{v.geteld}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{v.blijft}</td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${v.eruit > 0 ? 'text-accent' : 'text-muted'}`}>
                    {v.eruit || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kaart>

        <p className="text-sm text-muted">
          Van de {euro(totalen.eruitMunt + totalen.eruitBiljet)} die eruit gaat is{' '}
          <span className="font-semibold text-text">{euro(totalen.eruitBiljet)}</span> briefgeld — dat
          is wat er naar de bank kan. De {euro(totalen.eruitMunt)} aan munten blijft in de kluis als
          wisselgeld.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="kas-opm" className="text-sm font-semibold text-muted">
            Opmerking (mag leeg)
          </label>
          <input
            id="kas-opm"
            className="w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
            placeholder="Bijvoorbeeld: briefje van 50 uit de fooienpot"
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />
        </div>

        {fout && (
          <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
        )}

        <Knop
          soort="primair"
          bezig={bewaren.isPending}
          onClick={() =>
            bewaren.mutate(
              {
                verdeling,
                opmerking,
                medewerkerId: wie?.medewerker_id,
                doorNaam: wie?.naam ?? email ?? 'onbekend',
              },
              { onSuccess: () => setKlaar(true), onError: (e) => setFout(e.message) },
            )
          }
        >
          Vastleggen en naar de kluis boeken
        </Knop>
        <p className="text-sm text-muted">
          Een vastgelegde telling verandert niet meer. Klopt er iets niet, dan maak
          je een nieuwe telling of zet je het in de opmerking.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Tel de lade en tik per coupure het aantal in. Onderaan staat het totaal dat
        je in de kassa overtikt.
      </p>

      <Kaart>
        {verdeling.map((v) => (
          <div
            key={v.waarde_cent}
            className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <span className="w-20 shrink-0 font-display text-lg">{coupureNaam(v.waarde_cent)}</span>
            <input
              type="text"
              inputMode="numeric"
              className={`${invoer} max-w-[7rem]`}
              aria-label={`Aantal van ${coupureNaam(v.waarde_cent)}`}
              value={aantallen[v.waarde_cent] ?? ''}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, '')
                setAantallen({ ...aantallen, [v.waarde_cent]: n === '' ? 0 : Number(n) })
              }}
            />
            <span className="min-w-0 flex-1 text-right tabular-nums text-muted">
              {v.geteld > 0 ? euro(v.geteld * v.waarde_cent) : ''}
            </span>
          </div>
        ))}
      </Kaart>

      <Kaart className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 border-line-strong p-4">
        <span>
          <span className="block text-sm text-muted">Totaal in de lade</span>
          <span className="font-display text-3xl tabular-nums">{euro(totalen.geteld)}</span>
        </span>
        <Knop soort="primair" disabled={totalen.geteld === 0} onClick={() => setStap('splitsen')}>
          Splitsen
        </Knop>
      </Kaart>

      <p className="text-sm text-muted">
        Als alles klopt hoort er {euro(gewenst)} in de lade te blijven. Dat bedrag
        volgt uit je wisselgeldinstelling, niet uit een los getal.
      </p>
    </div>
  )
}
