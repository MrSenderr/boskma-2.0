import { useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import { useGemiddeldeUren } from '../lib/gewerkteUren'
import { Uurloonveld } from './Uurloon'
import {
  KETEN_MAX_CONTRACTEN,
  SOORTNAAM,
  WERKGEVERNAAM,
  eindeVan,
  ketenVan,
  urenTekst,
  useContractOpslaan,
  useContractWeg,
  useContracten,
  type Contract,
  type Duur,
  type Soort,
  type Werkgever,
} from '../lib/contracten'

/* De contractgeschiedenis van één medewerker.
 *
 * Meer dan een lijstje: hieruit volgt hoeveelste tijdelijke contract het is en
 * of er een pauze tussen zat die de telling opnieuw liet beginnen. Dat is wat
 * je moet weten vóór je een verlenging aanbiedt — een vierde tijdelijk
 * contract is er namelijk geen, dat is er van rechtswege een voor onbepaalde
 * tijd.
 *
 * Wat hier staat is wat er is afgesproken en getekend. Voorstellen staan er
 * niet in; die komen apart. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Keuze<T extends string>({
  label,
  waarde,
  opties,
  onKies,
}: {
  label: string
  waarde: T | ''
  opties: { waarde: T; label: string }[]
  onKies: (v: T) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <select className={invoer} value={waarde} onChange={(e) => onKies(e.target.value as T)}>
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Formulier({
  persoon,
  begin,
  onKlaar,
}: {
  persoon: Persoon
  begin: Partial<Contract>
  onKlaar: () => void
}) {
  const persoonId = persoon.id
  const [c, setC] = useState<Partial<Contract>>({
    werkgever: 'boskma',
    soort: 'nuluren',
    duur: 'bepaalde',
    ...begin,
  })
  const opslaan = useContractOpslaan(persoonId)
  const [fout, setFout] = useState<string | null>(null)

  const metUren = c.soort === 'vaste_uren'
  const metBandbreedte = c.soort === 'min_max' || c.soort === 'bandbreedte'

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Keuze<Werkgever>
          label="Werkgever"
          waarde={(c.werkgever ?? 'boskma') as Werkgever}
          opties={(['boskma', 'kai'] as Werkgever[]).map((w) => ({ waarde: w, label: WERKGEVERNAAM[w] }))}
          onKies={(v) => setC({ ...c, werkgever: v })}
        />
        <Keuze<Soort>
          label="Soort"
          waarde={(c.soort ?? 'nuluren') as Soort}
          opties={(['nuluren', 'min_max', 'vaste_uren', 'bandbreedte'] as Soort[]).map((s) => ({
            waarde: s,
            label: SOORTNAAM[s],
          }))}
          onKies={(v) => setC({ ...c, soort: v })}
        />
        <Keuze<Duur>
          label="Duur"
          waarde={(c.duur ?? 'bepaalde') as Duur}
          opties={[
            { waarde: 'bepaalde' as Duur, label: 'Bepaalde tijd' },
            { waarde: 'onbepaalde' as Duur, label: 'Onbepaalde tijd' },
          ]}
          onKies={(v) => setC({ ...c, duur: v, eindigt: v === 'onbepaalde' ? null : c.eindigt })}
        />
        <Veld
          label="Begint"
          type="date"
          value={c.begint ?? ''}
          onChange={(e) => setC({ ...c, begint: e.target.value })}
        />
        {c.duur === 'bepaalde' && (
          <Veld
            label="Eindigt"
            type="date"
            value={c.eindigt ?? ''}
            onChange={(e) => setC({ ...c, eindigt: e.target.value || null })}
          />
        )}
        {metUren && (
          <Veld
            label="Uren per week"
            type="number"
            step="0.5"
            value={String(c.uren_vast ?? '')}
            onChange={(e) => setC({ ...c, uren_vast: e.target.value === '' ? null : Number(e.target.value) })}
          />
        )}
        {metBandbreedte && (
          <>
            <Veld
              label="Minimaal uren per week"
              type="number"
              step="0.5"
              value={String(c.uren_min ?? '')}
              onChange={(e) => setC({ ...c, uren_min: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <Veld
              label="Maximaal uren per week"
              type="number"
              step="0.5"
              value={String(c.uren_max ?? '')}
              onChange={(e) => setC({ ...c, uren_max: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </>
        )}
        <Uurloonveld
          waarde={c.uurloon}
          onVeranderd={(v) => setC({ ...c, uurloon: v })}
          persoon={persoon}
          opDatum={c.begint}
        />
        <Veld
          label="Functie"
          value={c.functie ?? ''}
          onChange={(e) => setC({ ...c, functie: e.target.value || null })}
        />
      </div>

      <Veld
        label="Opmerking"
        value={c.opmerking ?? ''}
        onChange={(e) => setC({ ...c, opmerking: e.target.value || null })}
      />

      {fout && <p className="text-sm text-bad">{fout}</p>}

      <div className="flex flex-wrap gap-2">
        <Knop
          bezig={opslaan.isPending}
          onClick={() => {
            if (!c.begint) return setFout('Vul in wanneer het contract begint.')
            if (c.duur === 'bepaalde' && !c.eindigt) {
              return setFout('Een contract voor bepaalde tijd heeft een einddatum.')
            }
            setFout(null)
            opslaan.mutate(c as Parameters<typeof opslaan.mutate>[0], {
              onSuccess: onKlaar,
              onError: (e) => setFout(e instanceof Error ? e.message : 'Opslaan lukte niet.'),
            })
          }}
        >
          Bewaren
        </Knop>
        <Knop soort="rustig" onClick={onKlaar}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}

/* Het gemiddelde over twaalf maanden, voor het aanbod vaste uren.
 *
 * Alleen bij een oproepcontract: daar hangt de verplichting aan. Bij vaste
 * uren is het al afgesproken en zegt een gemiddelde niets nieuws.
 *
 * Staat er geen getal, dan is dat geen storing maar het eerlijke antwoord: de
 * uren van die twaalf maanden zijn niet allemaal ingelezen, en een gemiddelde
 * over een deel is geen gemiddelde over het geheel. */
function GemiddeldeUren({ persoonId }: { persoonId: string }) {
  const { data } = useGemiddeldeUren(persoonId)
  if (!data) return null

  // Nederlandse komma; 11.09 uur leest als een foutje.
  const getal = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 2 })

  const { urenPerWeek, urenPerMaand, dekking, totaalUren, nietMeegeteld } = data

  if (urenPerWeek !== null) {
    return (
      <Kaart className="flex flex-col gap-1 p-4">
        <p>
          Gemiddeld <strong className="font-semibold">{getal(urenPerWeek)} uur per week</strong> over
          de afgelopen twaalf maanden ({getal(urenPerMaand ?? 0)} uur per maand).
        </p>
        <p className="text-sm text-muted">
          Een aanbod voor vaste uren moet minstens dat zijn. Betaald verlof telt mee.
        </p>
        {nietMeegeteld.length > 0 && (
          <p className="text-sm text-muted">
            Niet meegeteld:{' '}
            {nietMeegeteld.map((n) => `${getal(n.uren)} uur ${n.soort}`).join(', ')}.
          </p>
        )}
      </Kaart>
    )
  }

  const weken = Math.round(dekking.dagenGedekt / 7)
  return (
    <Kaart className="flex flex-col gap-1 border-warn p-4">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
        Het gemiddelde is nog niet te zeggen
      </p>
      <p className="text-sm text-muted">
        Van de twaalf maanden{' '}
        {dekking.dagenGedekt === 0
          ? 'is er nog niets ingelezen'
          : `${weken === 1 ? 'is er één week' : `zijn er ${weken} weken`} ingelezen (${getal(totaalUren)} uur)`}
        . Zolang dat zo is kan de app geen getal geven dat in een aanbod mag — te laag aanbieden kan
        de medewerker tot vijf jaar terug opeisen.
      </p>
      <p className="text-sm text-muted">
        Dit komt goed zodra de automatische export van gewerkte uren in eitje aanstaat; de planning
        loopt al wel.
      </p>
    </Kaart>
  )
}

function maanden(dagen: number): string {
  const m = Math.round(dagen / 30.44)
  if (m < 1) return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`
  return `${m} ${m === 1 ? 'maand' : 'maanden'}`
}

export function Contracten({ persoon }: { persoon: Persoon }) {
  const { data, isPending, error } = useContracten(persoon.id)
  const weg = useContractWeg(persoon.id)
  const [bewerkt, setBewerkt] = useState<Partial<Contract> | null>(null)
  const [weghalen, setWeghalen] = useState<string | null>(null)

  if (isPending) {
    return (
      <section className="flex flex-col gap-3">
        <Kopje>Contracten</Kopje>
        <Kaart className="p-4">
          <p className="text-sm text-muted">Bezig met laden…</p>
        </Kaart>
      </section>
    )
  }
  if (error) {
    return (
      <section className="flex flex-col gap-3">
        <Kopje>Contracten</Kopje>
        <Kaart className="p-4">
          <p className="text-sm text-bad">Kon de contracten niet laden: {error.message}</p>
        </Kaart>
      </section>
    )
  }

  const keten = ketenVan(data)
  // Nieuwste bovenaan leest prettiger; de keten rekent van oud naar nieuw.
  const schakels = [...keten.schakels].reverse()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Kopje>Contracten</Kopje>
        {persoon.in_dienst_sinds && (
          <span className="text-sm text-muted">In dienst sinds {korteDatum(persoon.in_dienst_sinds)}</span>
        )}
      </div>

      {keten.reden && (
        <Kaart className="flex items-start gap-2 border-warn p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <p className="text-sm">{keten.reden}</p>
        </Kaart>
      )}

      {data.length === 0 ? (
        <Kaart className="p-4">
          <p className="text-sm text-muted">
            Nog geen contract vastgelegd. Zonder contract kan de app de ketenregeling en de twaalf
            maanden oproep niet tellen.
          </p>
        </Kaart>
      ) : (
        <Kaart className="flex flex-col py-2">
          {schakels.map(({ contract, nummer, pauze, nieuweKeten }) => {
            const einde = eindeVan(contract)
            return (
              <div key={contract.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{SOORTNAAM[contract.soort]}</span>
                    {contract.duur === 'onbepaalde' ? (
                      <Pil soort="goed">Onbepaalde tijd</Pil>
                    ) : (
                      <Pil soort={nummer >= KETEN_MAX_CONTRACTEN ? 'letop' : 'neutraal'}>
                        Contract {nummer} van {KETEN_MAX_CONTRACTEN}
                      </Pil>
                    )}
                    {contract.werkgever === 'kai' && <Pil soort="neutraal">Bij Kai</Pil>}
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    {korteDatum(contract.begint)} — {einde ? korteDatum(einde) : 'loopt door'}
                  </span>
                </div>

                <p className="mt-0.5 text-sm text-muted">
                  {urenTekst(contract)}
                  {contract.uurloon != null && ` · € ${Number(contract.uurloon).toFixed(2).replace('.', ',')}`}
                  {contract.functie && ` · ${contract.functie}`}
                  {contract.beeindigd_op && ` · eerder beëindigd${contract.beeindigd_reden ? `: ${contract.beeindigd_reden}` : ''}`}
                </p>

                {contract.opmerking && (
                  <p className="mt-0.5 text-sm text-muted">{contract.opmerking}</p>
                )}

                {/* Een gat van een paar dagen is gewoon de overgang van het ene
                    contract naar het andere; dat hoeft er niet bij te staan. */}
                {pauze !== null && (pauze > 7 || nieuweKeten) && (
                  <p className="mt-1 text-sm text-muted">
                    {maanden(pauze)} ertussen
                    {nieuweKeten && ' — langer dan zes maanden, dus de telling begon hier opnieuw'}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap gap-3 text-sm">
                  <button
                    type="button"
                    className="text-muted underline hover:text-text"
                    onClick={() => setBewerkt(contract)}
                  >
                    wijzigen
                  </button>
                  {weghalen === contract.id ? (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-bad underline"
                        onClick={() => {
                          weg.mutate(contract.id)
                          setWeghalen(null)
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        ja, weghalen
                      </button>
                      <button
                        type="button"
                        className="text-muted underline hover:text-text"
                        onClick={() => setWeghalen(null)}
                      >
                        toch niet
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-muted underline hover:text-text"
                      onClick={() => setWeghalen(contract.id)}
                    >
                      weghalen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </Kaart>
      )}

      {data.some((c) => c.soort === 'nuluren') && <GemiddeldeUren persoonId={persoon.id} />}

      {keten.driejaarOp && !keten.heeftVast && (
        <p className="text-sm text-muted">
          De keten begon op {korteDatum(keten.begonOp)} en wordt drie jaar op{' '}
          {korteDatum(keten.driejaarOp)}.
        </p>
      )}

      {bewerkt ? (
        <Formulier persoon={persoon} begin={bewerkt} onKlaar={() => setBewerkt(null)} />
      ) : (
        <Knop soort="rustig" className="w-fit" onClick={() => setBewerkt({})}>
          <Plus className="size-4" aria-hidden />
          Contract toevoegen
        </Knop>
      )}
    </section>
  )
}
