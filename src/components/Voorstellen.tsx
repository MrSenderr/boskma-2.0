import { useMemo, useState } from 'react'
import { AlertTriangle, FileText, Info, Plus } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import {
  ketenVan,
  useContracten,
  lopendContract,
  type Contract,
  type Duur,
  type Soort,
} from '../lib/contracten'
import { useGemiddeldeUren } from '../lib/gewerkteUren'
import {
  AARDNAAM,
  STANDNAAM,
  controleer,
  magVerstuurd,
  metVasteUren,
  metVerlenging,
  samenvatting,
  schoonVoorstel,
  vulVoorstelIn,
  standVan,
  useVoorstelIntrekken,
  useVoorstelOpslaan,
  useVoorstellen,
  type Aard,
  type Voorstel,
} from '../lib/contractvoorstellen'

/* Een contractvoorstel opstellen.
 *
 * Wat hier gebeurt is vooral nakijken. De app vult in wat uit het lopende
 * contract en de keten volgt, laat zien hoe het er voor de medewerker uitziet,
 * en houdt tegen wat juridisch niet kan — een vierde tijdelijk contract, of
 * een aanbod vaste uren onder het twaalfmaandsgemiddelde.
 *
 * Versturen zit hier nog niet in. Dat hoort bij het scherm waar de medewerker
 * het voorstel ziet; een mail sturen naar een pagina die nog niets toont is
 * een belofte die je niet waarmaakt. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const STAND_KLEUR = {
  concept: 'neutraal',
  verstuurd: 'letop',
  gezien: 'letop',
  beantwoord: 'goed',
  ingetrokken: 'neutraal',
} as const

function Keuze<T extends string>({
  label,
  waarde,
  opties,
  onKies,
}: {
  label: string
  waarde: T
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

function Opstellen({
  persoon,
  huidig,
  keten,
  gemiddelde,
  onKlaar,
}: {
  persoon: Persoon
  huidig: Contract | null
  keten: ReturnType<typeof ketenVan>
  gemiddelde: number | null
  onKlaar: () => void
}) {
  /* Elke vorm heeft zijn eigen vooringevulde waarden: verlengen sluit aan op
     het vorige contract, een aanbod begint bij het gemiddelde. Daarom vult de
     app bij het wisselen van vorm opnieuw in, in plaats van de oude waarden te
     laten staan — die horen bij een voorstel dat je niet meer doet. */
  const vul = (a: Aard) => vulVoorstelIn({ aard: a, huidig, keten, gemiddelde })
  const [v, setV] = useState<Partial<Voorstel>>(() => vul('verlengen'))
  const opslaan = useVoorstelOpslaan(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  /* Alles leest hetzelfde voorstel: het voorbeeld, de controle en het
     opslaan. Anders kijk je naar iets anders dan je bewaart. */
  const schoon = useMemo(() => schoonVoorstel(v), [v])
  const bezwaren = useMemo(() => controleer(schoon, keten), [schoon, keten])
  const regels = useMemo(() => samenvatting(schoon), [schoon])
  const aard = (v.aard ?? 'verlengen') as Aard
  const verlengt = metVerlenging(aard)

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Keuze<Aard>
        label="Wat stel je voor"
        waarde={aard}
        opties={(Object.keys(AARDNAAM) as Aard[]).map((a) => ({ waarde: a, label: AARDNAAM[a] }))}
        onKies={(nieuw) => setV({ ...vul(nieuw), toelichting: v.toelichting })}
      />

      {aard !== 'stoppen' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Soort, duur en einddatum horen bij een contract. Bied je alleen
              vaste uren aan, dan verandert het contract niet en zouden die
              velden iets suggereren wat er niet staat. */}
          {verlengt && (
            <>
              <Keuze<Soort>
                label="Soort"
                waarde={(v.soort ?? 'nuluren') as Soort}
                opties={[
                  { waarde: 'nuluren' as Soort, label: 'Nuluren (oproep)' },
                  { waarde: 'min_max' as Soort, label: 'Min-max' },
                  { waarde: 'vaste_uren' as Soort, label: 'Vaste uren' },
                  { waarde: 'bandbreedte' as Soort, label: 'Bandbreedte' },
                ]}
                onKies={(s) => setV({ ...v, soort: s })}
              />
              <Keuze<Duur>
                label="Duur"
                waarde={(v.duur ?? 'bepaalde') as Duur}
                opties={[
                  { waarde: 'bepaalde' as Duur, label: 'Bepaalde tijd' },
                  { waarde: 'onbepaalde' as Duur, label: 'Onbepaalde tijd' },
                ]}
                onKies={(d) =>
                  setV({ ...v, duur: d, eindigt: d === 'onbepaalde' ? null : v.eindigt })
                }
              />
            </>
          )}
          <Veld
            label={verlengt ? 'Begint' : 'Gaat in op'}
            type="date"
            value={v.begint ?? ''}
            onChange={(e) => setV({ ...v, begint: e.target.value || null })}
          />
          {verlengt && v.duur === 'bepaalde' && (
            <Veld
              label="Eindigt"
              type="date"
              value={v.eindigt ?? ''}
              onChange={(e) => setV({ ...v, eindigt: e.target.value || null })}
            />
          )}
          {(v.soort === 'vaste_uren' || metVasteUren(aard)) && (
            <Veld
              label="Uren per week"
              type="number"
              step="0.5"
              value={String(v.uren_vast ?? '')}
              onChange={(e) =>
                setV({ ...v, uren_vast: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          )}
          {verlengt && (v.soort === 'min_max' || v.soort === 'bandbreedte') && (
            <>
              <Veld
                label="Minimaal uren"
                type="number"
                step="0.5"
                value={String(v.uren_min ?? '')}
                onChange={(e) =>
                  setV({ ...v, uren_min: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
              <Veld
                label="Maximaal uren"
                type="number"
                step="0.5"
                value={String(v.uren_max ?? '')}
                onChange={(e) =>
                  setV({ ...v, uren_max: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </>
          )}
          <Veld
            label="Uurloon bruto"
            type="number"
            step="0.01"
            value={String(v.uurloon ?? '')}
            onChange={(e) =>
              setV({ ...v, uurloon: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
          <Veld
            label="Functie"
            value={v.functie ?? ''}
            onChange={(e) => setV({ ...v, functie: e.target.value || null })}
          />
        </div>
      )}

      <Veld
        label="Antwoord uiterlijk"
        type="date"
        value={v.uiterlijk ?? ''}
        onChange={(e) => setV({ ...v, uiterlijk: e.target.value || null })}
      />
      <Veld
        label="Toelichting voor de medewerker"
        value={v.toelichting ?? ''}
        onChange={(e) => setV({ ...v, toelichting: e.target.value || null })}
      />

      {metVasteUren(aard) && gemiddelde === null && (
        <p className="text-sm text-muted">
          Het gemiddelde over twaalf maanden is niet bekend, dus de app kan niet nakijken of dit
          aanbod hoog genoeg is.
        </p>
      )}

      {/* Wat de medewerker straks leest. */}
      <div className="flex flex-col gap-2">
        <Kopje>Zo ziet het eruit</Kopje>
        <Kaart className="flex flex-col gap-1 p-4">
          {regels.length === 0 ? (
            <p className="text-sm text-muted">Vul hierboven in wat je voorstelt.</p>
          ) : (
            regels.map((r) => <p key={r}>{r}</p>)
          )}
          {v.toelichting && <p className="mt-1 whitespace-pre-wrap text-muted">{v.toelichting}</p>}
        </Kaart>
      </div>

      {bezwaren.length > 0 && (
        <Kaart className={`flex flex-col gap-2 p-4 ${magVerstuurd(bezwaren) ? 'border-warn' : 'border-bad'}`}>
          {bezwaren.map((b) => (
            <p key={b.wat} className="flex items-start gap-2 text-sm">
              {b.ernst === 'fout' ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              )}
              <span>{b.wat}</span>
            </p>
          ))}
        </Kaart>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Knop
          bezig={opslaan.isPending}
          disabled={!magVerstuurd(bezwaren)}
          onClick={() =>
            opslaan.mutate(schoon, {
              onSuccess: onKlaar,
              onError: (e) => setFout(e instanceof Error ? e.message : 'Opslaan lukte niet.'),
            })
          }
        >
          Opslaan als concept
        </Knop>
        <Knop soort="rustig" onClick={onKlaar}>
          Annuleren
        </Knop>
        {!magVerstuurd(bezwaren) && (
          <span className="text-sm text-muted">Los eerst op wat hierboven rood staat.</span>
        )}
      </div>
    </Kaart>
  )
}

export function Voorstellen({ persoon }: { persoon: Persoon }) {
  const { data: contracten } = useContracten(persoon.id)
  const { data: voorstellen } = useVoorstellen(persoon.id)
  const { data: uren } = useGemiddeldeUren(persoon.id)
  const intrekken = useVoorstelIntrekken(persoon.id)
  const [opstellen, setOpstellen] = useState(false)

  if (!contracten || !voorstellen) return null

  const keten = ketenVan(contracten)
  const huidig = lopendContract(contracten)
  const gemiddelde = uren?.urenPerWeek ?? null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Voorstellen</Kopje>

      {voorstellen.length > 0 && (
        <Kaart className="flex flex-col py-2">
          {voorstellen.map((v) => {
            const stand = standVan(v)
            return (
              <div key={v.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{AARDNAAM[v.aard]}</span>
                    <Pil soort={STAND_KLEUR[stand]}>{STANDNAAM[stand]}</Pil>
                  </span>
                  <span className="text-sm text-muted">{korteDatum(v.opgesteld_op)}</span>
                </div>
                {samenvatting(v).map((r) => (
                  <p key={r} className="mt-0.5 text-sm text-muted">
                    {r}
                  </p>
                ))}
                {v.ingetrokken_op && (
                  <p className="mt-0.5 text-sm text-muted">
                    Ingetrokken op {korteDatum(v.ingetrokken_op)}
                    {v.ingetrokken_reden ? ` — ${v.ingetrokken_reden}` : ''}
                  </p>
                )}
                {!v.ingetrokken_op && (
                  <button
                    type="button"
                    className="mt-1 text-sm text-muted underline hover:text-text"
                    onClick={() => intrekken.mutate({ id: v.id })}
                  >
                    intrekken
                  </button>
                )}
              </div>
            )
          })}
        </Kaart>
      )}

      {opstellen ? (
        <Opstellen
          persoon={persoon}
          huidig={huidig}
          keten={keten}
          gemiddelde={gemiddelde}
          onKlaar={() => setOpstellen(false)}
        />
      ) : (
        <Knop
          soort="rustig"
          className="w-fit"
          onClick={() => setOpstellen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Voorstel opstellen
        </Knop>
      )}

      <p className="flex items-start gap-2 text-sm text-muted">
        <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
        Versturen komt samen met het scherm waar de medewerker het voorstel ziet. Tot die tijd kun
        je het hier opstellen en nakijken.
      </p>
    </section>
  )
}
