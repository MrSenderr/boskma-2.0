import { useState } from 'react'
import { Check, Truck, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { useWieWerkt } from '../lib/wieWerkt'
import { useLeveranciers, useLeveringBewaren, useLeveringenVandaag } from '../lib/leveringen'

/* Een levering aftekenen. Komt op een willekeurig moment binnen, dus dit is geen
   taak die af moet — het is een knop die er altijd is. Zie
   docs/Modules/haccp/haccpmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

export function Levering() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { vraagWie } = useWieWerkt()
  const { data: eerder } = useLeveranciers()
  const { data: vandaag } = useLeveringenVandaag()
  const bewaar = useLeveringBewaren()

  const [leverancier, setLeverancier] = useState('')
  const [temp, setTemp] = useState('')
  // Op een telefoon geeft het cijfertoetsenbord geen minteken, en diepvries komt
  // hier vaak binnen. Vandaar een eigen knop.
  const [negatief, setNegatief] = useState(false)
  const [ok, setOk] = useState(true)
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [gelukt, setGelukt] = useState<string | null>(null)

  const ruw = temp === '' ? null : Number(temp.replace(',', '.').replace('-', ''))
  const getal = ruw === null || Number.isNaN(ruw) ? null : negatief ? -Math.abs(ruw) : Math.abs(ruw)
  const kan =
    leverancier.trim().length > 0 &&
    getal !== null &&
    (ok || opmerking.trim().length > 0)

  async function bewaren() {
    if (getal === null) return
    const w = await vraagWie()
    if (w === null) return
    setFout(null)
    bewaar.mutate(
      {
        leverancier,
        temperatuur: getal,
        ok,
        opmerking: opmerking.trim() || null,
        medewerkerId: w?.id || wie?.medewerker_id || null,
        doorNaam: w?.naam || wie?.naam || email || 'onbekend',
      },
      {
        onSuccess: () => {
          setGelukt(`${leverancier.trim()} afgetekend.`)
          setLeverancier('')
          setTemp('')
          setOk(true)
          setOpmerking('')
        },
        onError: (e) => setFout(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Kopje>Levering aantekenen</Kopje>
        <p className="mt-1 text-sm text-muted">
          Wie het bracht, hoe koud het was, en of je het hebt aangenomen.
        </p>
      </div>

      {gelukt && (
        <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
          {gelukt}
        </p>
      )}
      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <Kaart className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="leverancier" className="text-sm font-semibold text-muted">
            Leverancier
          </label>
          <input
            id="leverancier"
            list="eerdere-leveranciers"
            className={invoer}
            value={leverancier}
            onChange={(e) => setLeverancier(e.target.value)}
            placeholder="Sligro"
          />
          <datalist id="eerdere-leveranciers">
            {(eerder ?? []).map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="temperatuur" className="text-sm font-semibold text-muted">
            Temperatuur bij aankomst
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNegatief((v) => !v)}
              aria-label={negatief ? 'Nu min, tik voor plus' : 'Nu plus, tik voor min'}
              className="flex size-12 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-line-strong text-lg font-bold hover:bg-surface-2"
            >
              {negatief ? '−' : '+'}
            </button>
            <input
              id="temperatuur"
              type="text"
              inputMode="decimal"
              className={`${invoer} tabular-nums`}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder="4"
            />
            <span className="shrink-0 font-semibold text-muted">°C</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Aangenomen?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOk(true)}
              aria-pressed={ok}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${
                ok ? 'border-good bg-good text-white' : 'border-line-strong hover:bg-surface-2'
              }`}
            >
              <Check className="size-4" aria-hidden />
              Aangenomen
            </button>
            <button
              type="button"
              onClick={() => setOk(false)}
              aria-pressed={!ok}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${
                !ok ? 'border-bad bg-bad text-white' : 'border-line-strong hover:bg-surface-2'
              }`}
            >
              <X className="size-4" aria-hidden />
              Geweigerd
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="opmerking" className="text-sm font-semibold text-muted">
            {ok ? 'Opmerking (mag leeg)' : 'Waarom geweigerd?'}
          </label>
          <input
            id="opmerking"
            className={invoer}
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder={ok ? '' : 'Te warm bij aankomst'}
          />
        </div>

        <Knop soort="primair" bezig={bewaar.isPending} disabled={!kan} onClick={bewaren}>
          Aftekenen
        </Knop>
        {!ok && opmerking.trim().length === 0 && (
          <p className="text-sm text-muted">
            Schrijf erbij waarom je hem geweigerd hebt — anders is het later niet
            uit te leggen.
          </p>
        )}
      </Kaart>

      {(vandaag ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Vandaag afgetekend</Kopje>
          <Kaart>
            {(vandaag ?? []).map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <Truck className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 font-medium">{l.leverancier}</span>
                <span className="font-bold tabular-nums">{l.temperatuur} °C</span>
                {l.ok ? <Pil soort="goed">Aangenomen</Pil> : <Pil soort="fout">Geweigerd</Pil>}
                {l.opmerking && (
                  <span className="w-full text-sm text-muted">{l.opmerking}</span>
                )}
              </div>
            ))}
          </Kaart>
        </section>
      )}
    </div>
  )
}
