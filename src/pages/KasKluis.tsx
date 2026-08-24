import { useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Banknote, Coins, Landmark, Scale } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { CoupureInvoer, pastHet, waardeVan } from '../components/CoupureInvoer'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { korteDatum, toonNaam } from '../lib/personeel'
import {
  coupureNaam,
  euro,
  useCoupures,
  useKluis,
  useKluisGrens,
  useKluisMutatie,
  type Aantallen,
} from '../lib/kas'

/* De kluis. Twee voorraden — briefgeld dat naar de bank gaat en munten die
   blijven liggen als wisselgeld — en van allebei weten we hoeveel er van elke
   coupure ligt. Zie docs/Modules/kas.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const SOORTNAAM: Record<string, string> = {
  uit_kassa: 'Uit de kassa',
  naar_bank: 'Naar de bank',
  naar_kassa: 'Terug in de lade',
  wisseling: 'Gewisseld',
  correctie: 'Bijgesteld',
}

/** Welke handeling er open staat. Eén tegelijk, want je hebt je handen in het
 *  geld en niet in het scherm. */
type Handeling = 'naar_bank' | 'naar_kassa' | 'wisselen' | 'natellen' | 'beginstand' | null

export function KasKluis() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data: coupures, isPending: coupuresBezig } = useCoupures()
  const { data, isPending, error, refetch } = useKluis()
  const { data: grens } = useKluisGrens()
  const boeken = useKluisMutatie()

  const [handeling, setHandeling] = useState<Handeling>(null)
  const [aantallen, setAantallen] = useState<Aantallen>({})
  const [terug, setTerug] = useState<Aantallen>({})
  const [notitie, setNotitie] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  if (isPending || coupuresBezig) return <Laden tekst="Kluis laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const alles = coupures ?? []
  const leeg = data.mutaties.length === 0
  const inKluis = data.perCoupure
  const doorNaam = wie?.naam ?? email ?? 'onbekend'

  function sluit() {
    setHandeling(null)
    setAantallen({})
    setTerug({})
    setNotitie('')
  }

  function boek(soort: Parameters<typeof boeken.mutate>[0]['soort'], regels: Aantallen, opmerking: string | null) {
    setFout(null)
    boeken.mutate(
      { soort, coupures: alles, aantallen: regels, opmerking, doorNaam },
      { onSuccess: sluit, onError: (e) => setFout(e.message) },
    )
  }

  /* ---------------------------------------------------------- handelingen --- */

  if (handeling === 'beginstand' || leeg) {
    const totaal = waardeVan(alles, aantallen)
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-display text-xl">Wat ligt er nu in de kluis?</p>
          <p className="mt-1 text-sm text-muted">
            De app begint op nul, maar er ligt al geld. Tel het één keer per munt en
            biljet; daarna telt de app zelf mee en kun je hem natellen.
          </p>
        </div>

        {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

        <CoupureInvoer coupures={alles} aantallen={aantallen} zet={setAantallen} totaalLabel="Ligt er in totaal" />

        <Knop
          soort="primair"
          bezig={boeken.isPending}
          disabled={totaal === 0}
          onClick={() => boek('correctie', aantallen, 'Beginstand')}
        >
          Beginstand vastleggen
        </Knop>
      </div>
    )
  }

  if (handeling === 'naar_bank' || handeling === 'naar_kassa') {
    const naarBank = handeling === 'naar_bank'
    const soort = naarBank ? ('biljet' as const) : ('munt' as const)
    const totaal = waardeVan(alles, aantallen, soort)
    const past = pastHet(aantallen, inKluis)

    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-display text-xl">
            {naarBank ? 'Briefgeld naar de bank' : 'Munten terug in de lade'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Tel wat je meeneemt, per {naarBank ? 'biljet' : 'munt'}.
          </p>
        </div>

        {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

        <CoupureInvoer
          coupures={alles}
          aantallen={aantallen}
          zet={setAantallen}
          soort={soort}
          beschikbaar={inKluis}
          totaalLabel="Neem je mee"
        />

        <input
          className={invoer}
          placeholder="Opmerking (mag leeg)"
          aria-label="Opmerking"
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Knop
            soort="primair"
            bezig={boeken.isPending}
            disabled={totaal === 0 || !past}
            onClick={() =>
              boek(
                handeling,
                // Eraf is negatief; het saldo is de optelsom van alle mutaties.
                Object.fromEntries(Object.entries(aantallen).map(([w, n]) => [w, -n])),
                notitie,
              )
            }
          >
            Vastleggen
          </Knop>
          <Knop soort="rustig" onClick={sluit}>
            Annuleren
          </Knop>
        </div>
      </div>
    )
  }

  if (handeling === 'wisselen') {
    const krijgt = waardeVan(alles, aantallen)
    const geeft = waardeVan(alles, terug)
    const past = pastHet(terug, inKluis)
    const gelijk = krijgt > 0 && krijgt === geeft

    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="font-display text-xl">Iemand komt wisselen</p>
          <p className="mt-1 text-sm text-muted">
            Gelijk oversteken. Het totaal in de kluis verandert niet, alleen wat
            erin ligt.
          </p>
        </div>

        {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

        <section className="flex flex-col gap-2">
          <Kopje>Wat je krijgt</Kopje>
          <CoupureInvoer coupures={alles} aantallen={aantallen} zet={setAantallen} totaalLabel="Je krijgt" />
        </section>

        <section className="flex flex-col gap-2">
          <Kopje>Wat je teruggeeft</Kopje>
          <CoupureInvoer
            coupures={alles}
            aantallen={terug}
            zet={setTerug}
            beschikbaar={inKluis}
            totaalLabel="Je geeft"
          />
        </section>

        {krijgt > 0 && !gelijk && (
          <p className="flex items-start gap-2 rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Dit steekt niet gelijk over: je krijgt {euro(krijgt)} en geeft {euro(geeft)}.
            Verschil {euro(Math.abs(krijgt - geeft))}.
          </p>
        )}

        <input
          className={invoer}
          placeholder="Met wie (mag leeg)"
          aria-label="Met wie gewisseld"
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Knop
            soort="primair"
            bezig={boeken.isPending}
            disabled={!gelijk || !past}
            onClick={() => {
              const saldo: Aantallen = { ...aantallen }
              Object.entries(terug).forEach(([w, n]) => {
                saldo[Number(w)] = (saldo[Number(w)] ?? 0) - n
              })
              boek('wisseling', saldo, notitie)
            }}
          >
            Vastleggen
          </Knop>
          <Knop soort="rustig" onClick={sluit}>
            Annuleren
          </Knop>
        </div>
      </div>
    )
  }

  if (handeling === 'natellen') {
    const verschillen = alles
      .map((c) => ({
        waarde_cent: c.waarde_cent,
        volgens: inKluis[c.waarde_cent] ?? 0,
        geteld: aantallen[c.waarde_cent] ?? 0,
      }))
      .map((r) => ({ ...r, verschil: r.geteld - r.volgens }))
    const scheef = verschillen.filter((r) => r.verschil !== 0)
    const inGeld = scheef.reduce((n, r) => n + r.verschil * r.waarde_cent, 0)

    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-display text-xl">Kluis natellen</p>
          <p className="mt-1 text-sm text-muted">
            Vul in wat je telt. De app zet ernaast wat hij dacht, en je kunt het in
            één keer rechtzetten.
          </p>
        </div>

        {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

        <CoupureInvoer
          coupures={alles}
          aantallen={aantallen}
          zet={setAantallen}
          beschikbaar={inKluis}
          totaalLabel="Je telt"
        />

        {scheef.length === 0 ? (
          <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
            Dit klopt met wat de app dacht.
          </p>
        ) : (
          <Kaart className="flex flex-col gap-2 border-warn bg-warn-soft p-4">
            <p className="font-semibold text-warn">
              Verschil: {euro(inGeld)}
            </p>
            <ul className="flex flex-col gap-0.5 text-sm">
              {scheef.map((r) => (
                <li key={r.waarde_cent}>
                  {coupureNaam(r.waarde_cent)}: geteld {r.geteld}, verwacht {r.volgens} (
                  {r.verschil > 0 ? '+' : ''}
                  {r.verschil})
                </li>
              ))}
            </ul>
          </Kaart>
        )}

        <input
          className={invoer}
          placeholder="Waarom klopt het niet? (verplicht bij een verschil)"
          aria-label="Reden"
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Knop
            soort="primair"
            bezig={boeken.isPending}
            disabled={scheef.length > 0 && notitie.trim().length === 0}
            onClick={() => {
              if (scheef.length === 0) {
                sluit()
                return
              }
              boek(
                'correctie',
                Object.fromEntries(scheef.map((r) => [r.waarde_cent, r.verschil])),
                notitie,
              )
            }}
          >
            {scheef.length === 0 ? 'Klaar' : 'Rechtzetten'}
          </Knop>
          <Knop soort="rustig" onClick={sluit}>
            Annuleren
          </Knop>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------- overzicht --- */

  const munten = alles.filter((c) => c.soort === 'munt' && (inKluis[c.waarde_cent] ?? 0) !== 0)
  const biljetten = alles.filter((c) => c.soort === 'biljet' && (inKluis[c.waarde_cent] ?? 0) !== 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Kaart className={`min-w-[11rem] flex-1 p-4 ${grens !== undefined && data.biljet >= grens ? 'border-warn' : ''}`}>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Banknote className="size-4" aria-hidden />
            Briefgeld
          </p>
          <p className="font-display text-3xl tabular-nums">{euro(data.biljet)}</p>
          <p className="mt-1 text-sm text-muted">
            {biljetten.map((c) => `${inKluis[c.waarde_cent]}× ${coupureNaam(c.waarde_cent)}`).join(' · ') ||
              'wacht op een bankstorting'}
          </p>
        </Kaart>
        <Kaart className="min-w-[11rem] flex-1 p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Coins className="size-4" aria-hidden />
            Munten
          </p>
          <p className="font-display text-3xl tabular-nums">{euro(data.munt)}</p>
          <p className="mt-1 text-sm text-muted">
            {munten.map((c) => `${inKluis[c.waarde_cent]}× ${coupureNaam(c.waarde_cent)}`).join(' · ') ||
              'wisselgeldvoorraad'}
          </p>
        </Kaart>
      </div>

      {grens !== undefined && data.biljet >= grens && (
        <p className="flex items-start gap-2 rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Er ligt {euro(data.biljet)} aan briefgeld in de kluis, boven je grens van {euro(grens)}.
          Tijd voor een storting.
        </p>
      )}

      {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" disabled={data.biljet <= 0} onClick={() => setHandeling('naar_bank')}>
          <Landmark className="size-4" aria-hidden />
          Storting naar de bank
        </Knop>
        <Knop soort="rustig" disabled={data.munt <= 0} onClick={() => setHandeling('naar_kassa')}>
          <Coins className="size-4" aria-hidden />
          Munten terug in de lade
        </Knop>
        <Knop soort="rustig" onClick={() => setHandeling('wisselen')}>
          <ArrowLeftRight className="size-4" aria-hidden />
          Iemand komt wisselen
        </Knop>
        <Knop soort="rustig" onClick={() => setHandeling('natellen')}>
          <Scale className="size-4" aria-hidden />
          Natellen
        </Knop>
      </div>

      <section className="flex flex-col gap-3">
        <Kopje>Wat er in en uit ging</Kopje>
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
                    {m.door_naam && <span className="block text-sm text-muted">{toonNaam(m.door_naam)}</span>}
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
      </section>
    </div>
  )
}
