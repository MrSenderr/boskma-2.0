import { useState } from 'react'
import { AlertTriangle, Banknote, Coins, Landmark } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { toonNaam, korteDatum } from '../lib/personeel'
import { euro, useKluis, useKluisGrens, useKluisMutatie } from '../lib/kas'

/* De kluis. Twee voorraden: briefgeld dat naar de bank gaat, en munten die
   blijven liggen als wisselgeld. Zie docs/Modules/kas.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base tabular-nums outline-none focus:border-accent'

const SOORTNAAM: Record<string, string> = {
  uit_kassa: 'Uit de kassa',
  naar_bank: 'Naar de bank',
  naar_kassa: 'Terug in de lade',
  correctie: 'Correctie',
}

/** Van "125,50" of "125.5" naar 12550 cent. In centen rekenen, altijd. */
function naarCent(tekst: string): number | null {
  const schoon = tekst.trim().replace(/[€\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(schoon)) return null
  const [heel, deel = ''] = schoon.split('.')
  return Number(heel) * 100 + Number(deel.padEnd(2, '0'))
}

export function KasKluis() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data, isPending, error, refetch } = useKluis()
  const { data: grens } = useKluisGrens()
  const boeken = useKluisMutatie()

  const [wat, setWat] = useState<'naar_bank' | 'naar_kassa' | null>(null)
  const [bedrag, setBedrag] = useState('')
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Kluis laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const cent = naarCent(bedrag)
  const beschikbaar = wat === 'naar_bank' ? data.biljet : data.munt
  const teveel = cent !== null && cent > beschikbaar
  const kan = cent !== null && cent > 0 && !teveel

  function boek() {
    if (cent === null || !wat) return
    setFout(null)
    boeken.mutate(
      {
        soort: wat,
        // Eraf is negatief; het saldo is gewoon de optelsom van alle mutaties.
        muntCent: wat === 'naar_kassa' ? -cent : 0,
        biljetCent: wat === 'naar_bank' ? -cent : 0,
        opmerking,
        doorNaam: wie?.naam ?? email ?? 'onbekend',
      },
      {
        onSuccess: () => {
          setWat(null)
          setBedrag('')
          setOpmerking('')
        },
        onError: (e) => setFout(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Kaart className={`min-w-[11rem] flex-1 p-4 ${grens && data.biljet >= grens ? 'border-warn' : ''}`}>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Banknote className="size-4" aria-hidden />
            Briefgeld
          </p>
          <p className="font-display text-3xl tabular-nums">{euro(data.biljet)}</p>
          <p className="mt-1 text-sm text-muted">wacht op een bankstorting</p>
        </Kaart>
        <Kaart className="min-w-[11rem] flex-1 p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Coins className="size-4" aria-hidden />
            Munten
          </p>
          <p className="font-display text-3xl tabular-nums">{euro(data.munt)}</p>
          <p className="mt-1 text-sm text-muted">wisselgeldvoorraad</p>
        </Kaart>
      </div>

      {grens !== undefined && data.biljet >= grens && (
        <p className="flex items-start gap-2 rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Er ligt {euro(data.biljet)} aan briefgeld in de kluis, boven je grens van{' '}
          {euro(grens)}. Tijd voor een storting.
        </p>
      )}

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {wat ? (
        <Kaart className="flex flex-col gap-3 p-4">
          <p className="font-display text-lg">
            {wat === 'naar_bank' ? 'Briefgeld naar de bank' : 'Munten terug in de lade'}
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="kluis-bedrag" className="text-sm font-semibold text-muted">
              Bedrag — er ligt {euro(beschikbaar)}
            </label>
            <input
              id="kluis-bedrag"
              inputMode="decimal"
              autoFocus
              className={invoer}
              placeholder="0,00"
              value={bedrag}
              onChange={(e) => setBedrag(e.target.value)}
            />
            {teveel && <span className="text-sm text-bad">Dat is meer dan er ligt.</span>}
          </div>
          <input
            className={invoer}
            placeholder="Opmerking (mag leeg)"
            aria-label="Opmerking"
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={boeken.isPending} disabled={!kan} onClick={boek}>
              Vastleggen
            </Knop>
            <Knop soort="rustig" onClick={() => setWat(null)}>
              Annuleren
            </Knop>
          </div>
        </Kaart>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Knop soort="primair" disabled={data.biljet <= 0} onClick={() => setWat('naar_bank')}>
            <Landmark className="size-4" aria-hidden />
            Storting naar de bank
          </Knop>
          <Knop soort="rustig" disabled={data.munt <= 0} onClick={() => setWat('naar_kassa')}>
            <Coins className="size-4" aria-hidden />
            Munten terug in de lade
          </Knop>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <Kopje>Wat er in en uit ging</Kopje>
        {data.mutaties.length === 0 ? (
          <Kaart className="p-4">
            <p className="text-sm text-muted">Nog niets vastgelegd.</p>
          </Kaart>
        ) : (
          <Kaart className="overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-sm">
              <colgroup>
                <col className="w-28" />
                <col />
                <col className="w-28" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Datum</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Wat</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Briefgeld</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Munten</th>
                </tr>
              </thead>
              <tbody>
                {data.mutaties.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 text-muted">{korteDatum(m.datum)}</td>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium">{SOORTNAAM[m.soort] ?? m.soort}</span>
                      {m.opmerking && <span className="block text-sm text-muted">{m.opmerking}</span>}
                      {m.door_naam && (
                        <span className="block text-sm text-muted">{toonNaam(m.door_naam)}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${m.biljet_cent < 0 ? 'text-bad' : ''}`}>
                      {m.biljet_cent === 0 ? '—' : euro(m.biljet_cent)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${m.munt_cent < 0 ? 'text-bad' : ''}`}>
                      {m.munt_cent === 0 ? '—' : euro(m.munt_cent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>
        )}
      </section>
    </div>
  )
}
