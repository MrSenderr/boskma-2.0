import { useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Banknote, Coins, Landmark, Scale } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { toonNaam, korteDatum } from '../lib/personeel'
import { euro, naarCent, useKluis, useKluisGrens, useKluisMutatie } from '../lib/kas'

/* De kluis. Twee voorraden: briefgeld dat naar de bank gaat, en munten die
   blijven liggen als wisselgeld. Zie docs/Modules/kas.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base tabular-nums outline-none focus:border-accent'

const SOORTNAAM: Record<string, string> = {
  uit_kassa: 'Uit de kassa',
  wisseling: 'Gewisseld',
  naar_bank: 'Naar de bank',
  naar_kassa: 'Terug in de lade',
  correctie: 'Correctie',
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

  // Bijstellen gaat op wat er wérkelijk ligt, niet op een verschil dat je zelf
  // moet uitrekenen. De app boekt het verschil.
  // Wisselen is geen correctie: het totaal blijft gelijk, alleen de verhouding
  // munten/briefgeld verschuift.
  const [wisselen, setWisselen] = useState(false)
  const [wisselKant, setWisselKant] = useState<'munten_erbij' | 'munten_eraf'>('munten_erbij')
  const [wisselBedrag, setWisselBedrag] = useState('')
  const [wisselWie, setWisselWie] = useState('')

  const [bijstellen, setBijstellen] = useState(false)
  const [echtMunt, setEchtMunt] = useState('')
  const [echtBiljet, setEchtBiljet] = useState('')
  const [reden, setReden] = useState('')

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

  const nieuwMunt = naarCent(echtMunt)
  const nieuwBiljet = naarCent(echtBiljet)
  const huidigMunt = data.munt
  const huidigBiljet = data.biljet
  const leeg = data.mutaties.length === 0
  const kanBijstellen =
    nieuwMunt !== null && nieuwBiljet !== null && (leeg || reden.trim().length > 0)

  const wisselCent = naarCent(wisselBedrag)
  // Je kunt niet meer weggeven dan er ligt van wat je weggeeft.
  const wisselVoorraad = wisselKant === 'munten_erbij' ? huidigBiljet : huidigMunt
  const wisselTeveel = wisselCent !== null && wisselCent > wisselVoorraad
  const kanWisselen = wisselCent !== null && wisselCent > 0 && !wisselTeveel

  function wissel() {
    if (wisselCent === null) return
    setFout(null)
    const erbij = wisselKant === 'munten_erbij'
    boeken.mutate(
      {
        soort: 'wisseling',
        muntCent: erbij ? wisselCent : -wisselCent,
        biljetCent: erbij ? -wisselCent : wisselCent,
        opmerking: wisselWie.trim() || null,
        doorNaam: wie?.naam ?? email ?? 'onbekend',
      },
      {
        onSuccess: () => {
          setWisselen(false)
          setWisselBedrag('')
          setWisselWie('')
        },
        onError: (e) => setFout(e.message),
      },
    )
  }

  function stelBij() {
    if (nieuwMunt === null || nieuwBiljet === null) return
    setFout(null)
    boeken.mutate(
      {
        soort: 'correctie',
        muntCent: nieuwMunt - huidigMunt,
        biljetCent: nieuwBiljet - huidigBiljet,
        opmerking: reden.trim() || (leeg ? 'Beginstand' : null),
        doorNaam: wie?.naam ?? email ?? 'onbekend',
      },
      {
        onSuccess: () => {
          setBijstellen(false)
          setEchtMunt('')
          setEchtBiljet('')
          setReden('')
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

      {(leeg || bijstellen) && (
        <Kaart className={`flex flex-col gap-3 p-4 ${leeg ? 'border-accent' : ''}`}>
          <p className="font-display text-lg">
            {leeg ? 'Wat ligt er nu in de kluis?' : 'Kluis bijstellen'}
          </p>
          <p className="text-sm text-muted">
            {leeg
              ? 'De app begint op nul, maar er ligt al geld. Tel het één keer en vul het hier in; daarna telt de app zelf mee.'
              : 'Vul in wat er wérkelijk ligt. De app boekt het verschil, zodat je in de geschiedenis kunt zien dat er is bijgesteld.'}
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="echt-munt" className="text-sm font-semibold text-muted">
                Munten
              </label>
              <input
                id="echt-munt"
                inputMode="decimal"
                className={invoer}
                placeholder="0,00"
                value={echtMunt}
                onChange={(e) => setEchtMunt(e.target.value)}
              />
            </div>
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="echt-biljet" className="text-sm font-semibold text-muted">
                Briefgeld
              </label>
              <input
                id="echt-biljet"
                inputMode="decimal"
                className={invoer}
                placeholder="0,00"
                value={echtBiljet}
                onChange={(e) => setEchtBiljet(e.target.value)}
              />
            </div>
          </div>

          {!leeg && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bijstel-reden" className="text-sm font-semibold text-muted">
                Waarom klopt het niet?
              </label>
              <input
                id="bijstel-reden"
                className={invoer}
                placeholder="Bijvoorbeeld: storting van vorige week niet geboekt"
                value={reden}
                onChange={(e) => setReden(e.target.value)}
              />
              <span className="text-sm text-muted">
                Verplicht. Een kluissaldo dat zomaar verspringt is later niet uit te
                leggen.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={boeken.isPending} disabled={!kanBijstellen} onClick={stelBij}>
              {leeg ? 'Beginstand vastleggen' : 'Bijstellen'}
            </Knop>
            {!leeg && (
              <Knop soort="rustig" onClick={() => setBijstellen(false)}>
                Annuleren
              </Knop>
            )}
          </div>
        </Kaart>
      )}

      {wisselen && (
        <Kaart className="flex flex-col gap-3 p-4">
          <p className="font-display text-lg">Iemand komt wisselen</p>
          <p className="text-sm text-muted">
            Gelijk oversteken. Het totaal in de kluis verandert niet, alleen de
            verhouding tussen munten en briefgeld.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setWisselKant('munten_erbij')}
              aria-pressed={wisselKant === 'munten_erbij'}
              className={`min-h-14 flex-1 rounded-[4px] border-2 px-3 text-sm font-semibold ${
                wisselKant === 'munten_erbij' ? 'border-brand bg-surface-2' : 'border-line'
              }`}
            >
              Ik krijg munten
              <span className="mt-0.5 block font-normal text-muted">en geef briefgeld terug</span>
            </button>
            <button
              type="button"
              onClick={() => setWisselKant('munten_eraf')}
              aria-pressed={wisselKant === 'munten_eraf'}
              className={`min-h-14 flex-1 rounded-[4px] border-2 px-3 text-sm font-semibold ${
                wisselKant === 'munten_eraf' ? 'border-brand bg-surface-2' : 'border-line'
              }`}
            >
              Ik krijg briefgeld
              <span className="mt-0.5 block font-normal text-muted">en geef munten terug</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="wissel-bedrag" className="text-sm font-semibold text-muted">
              Bedrag — je geeft {wisselKant === 'munten_erbij' ? 'briefgeld' : 'munten'} weg, er ligt{' '}
              {euro(wisselVoorraad)}
            </label>
            <input
              id="wissel-bedrag"
              inputMode="decimal"
              autoFocus
              className={invoer}
              placeholder="0,00"
              value={wisselBedrag}
              onChange={(e) => setWisselBedrag(e.target.value)}
            />
            {wisselTeveel && <span className="text-sm text-bad">Zoveel ligt er niet.</span>}
          </div>

          <input
            className={invoer}
            placeholder="Met wie (mag leeg)"
            aria-label="Met wie gewisseld"
            value={wisselWie}
            onChange={(e) => setWisselWie(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={boeken.isPending} disabled={!kanWisselen} onClick={wissel}>
              Vastleggen
            </Knop>
            <Knop soort="rustig" onClick={() => setWisselen(false)}>
              Annuleren
            </Knop>
          </div>
        </Kaart>
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
          {/* Altijd zichtbaar, ook als er nog niets in de kluis ligt — anders
              denk je dat de knop er niet is. Uitgegrijsd als er niets te
              wisselen valt. */}
          {!wisselen && (
            <Knop
              soort="rustig"
              disabled={data.munt + data.biljet <= 0}
              onClick={() => setWisselen(true)}
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              Iemand komt wisselen
            </Knop>
          )}
          {!leeg && !bijstellen && (
            <Knop
              soort="rustig"
              onClick={() => {
                setBijstellen(true)
                setEchtMunt(String(data.munt / 100).replace('.', ','))
                setEchtBiljet(String(data.biljet / 100).replace('.', ','))
              }}
            >
              <Scale className="size-4" aria-hidden />
              Klopt niet, bijstellen
            </Knop>
          )}
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
