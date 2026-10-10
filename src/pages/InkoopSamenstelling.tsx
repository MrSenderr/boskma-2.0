import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Laden, Leeg, Mislukt, Veld } from '../components/ui'
import { GetalVeld } from '../components/GetalVeld'
import { eenheidTekst, euro, fijnEuro, getal } from '../lib/inkoop'
import { metKostprijzen, useLaatstePrijzen, zoek } from '../lib/stuksprijzen'
import {
  useRegelToevoegen,
  useRegelWeg,
  useSamenstellingWeg,
  useSamenstellingen,
  useWijzigSamenstelling,
} from '../lib/samenstellingen'
import type { Berekend, Eenheid } from '../lib/foodcost'

/* Eén product: wat erin gaat, wat het kost en wat je ervoor zou moeten vragen.

   Elke wijziging gaat meteen de database in en het hele plaatje wordt opnieuw
   doorgerekend. Dat kan, want het rekenwerk gebeurt hier op het toestel en
   niet op de server. */

const EENHEDEN: Eenheid[] = ['stuk', 'gram', 'kilo', 'ml', 'liter', 'verpakking']

function procent(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(0)}%`
}

function Cijfer({ waarde, bij, kleur }: { waarde: string; bij: string; kleur?: string }) {
  return (
    <Kaart className="p-4">
      <p className={`font-display text-2xl tabular-nums ${kleur ?? ''}`}>{waarde}</p>
      <p className="mt-1 text-sm text-muted">{bij}</p>
    </Kaart>
  )
}

/* ------------------------------------------------------ ingrediënt erbij --- */

function Toevoegen({ s, alles }: { s: Berekend; alles: Berekend[] }) {
  const prijzen = useLaatstePrijzen()
  const toevoegen = useRegelToevoegen()

  const [term, setTerm] = useState('')
  const [hoeveelheid, setHoeveelheid] = useState<number | null>(null)
  const [eenheid, setEenheid] = useState<Eenheid>('stuk')
  const [gekozen, setGekozen] = useState<
    { soort: 'artikel'; leverancierId: number; artikelnr: string; naam: string } | { soort: 'onderdeel'; id: number; naam: string } | null
  >(null)

  const artikelen = prijzen.data ? metKostprijzen(prijzen.data).bekend : []
  const gevonden = term.trim() ? zoek(artikelen, term).slice(0, 8) : []
  // Jezelf als onderdeel kiezen kan niet; dat zou een kringetje zijn.
  const onderdelen = term.trim()
    ? alles.filter((a) => a.id !== s.id && a.naam.toLowerCase().includes(term.trim().toLowerCase()))
    : []

  async function erbij() {
    if (!gekozen || hoeveelheid === null || hoeveelheid <= 0) return
    await toevoegen.mutateAsync({
      samenstelling_id: s.id,
      volgorde: s.regels.length,
      leverancier_id: gekozen.soort === 'artikel' ? gekozen.leverancierId : null,
      artikelnr: gekozen.soort === 'artikel' ? gekozen.artikelnr : null,
      onderdeel_id: gekozen.soort === 'onderdeel' ? gekozen.id : null,
      hoeveelheid: String(hoeveelheid),
      eenheid: gekozen.soort === 'onderdeel' ? 'portie' : eenheid,
      notitie: null,
    })
    setGekozen(null)
    setTerm('')
    setHoeveelheid(null)
  }

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <p className="font-display text-lg">Ingrediënt toevoegen</p>

      {gekozen === null ? (
        <>
          <Veld
            label="Zoek een artikel of een ander product"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="brood, ui, 390400…"
          />
          {term.trim() && gevonden.length === 0 && onderdelen.length === 0 && (
            <p className="text-sm text-muted">
              Niets gevonden. Een artikel kan alleen gekozen worden als het al een keer op een
              factuur heeft gestaan.
            </p>
          )}
          <div className="flex flex-col">
            {onderdelen.map((o) => (
              <button
                key={`o-${o.id}`}
                type="button"
                onClick={() => setGekozen({ soort: 'onderdeel', id: o.id, naam: o.naam })}
                className="border-b border-line px-1 py-2 text-left last:border-0 hover:bg-surface-2"
              >
                {o.naam}
                <span className="block text-xs text-muted">
                  eigen product ·{' '}
                  {o.kostprijs === null ? 'kostprijs onbekend' : `${fijnEuro(o.kostprijs)} per ${o.eenheidnaam}`}
                </span>
              </button>
            ))}
            {gevonden.map((a) => (
              <button
                key={`a-${a.leverancier_id}-${a.artikelnr}`}
                type="button"
                onClick={() =>
                  setGekozen({
                    soort: 'artikel',
                    leverancierId: a.leverancier_id,
                    artikelnr: a.artikelnr,
                    naam: a.naam ?? a.artikelnr,
                  })
                }
                className="border-b border-line px-1 py-2 text-left last:border-0 hover:bg-surface-2"
              >
                {a.naam}
                <span className="block text-xs text-muted">
                  {[a.merk, a.inhoud, `${euro(a.prijs)} per verpakking`].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-semibold">{gekozen.naam}</span>
            <button
              type="button"
              onClick={() => setGekozen(null)}
              className="ml-2 text-muted underline"
            >
              anders kiezen
            </button>
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28">
              <GetalVeld
                label="Hoeveel"
                waarde={hoeveelheid}
                onWijzig={setHoeveelheid}
                placeholder="1"
              />
            </div>
            {gekozen.soort === 'artikel' ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-muted">Eenheid</span>
                <select
                  value={eenheid}
                  onChange={(e) => setEenheid(e.target.value as Eenheid)}
                  className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 outline-none focus:border-accent"
                >
                  {EENHEDEN.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="pb-3 text-sm text-muted">porties</p>
            )}
            <Knop onClick={erbij} bezig={toevoegen.isPending} disabled={!hoeveelheid}>
              <Plus className="size-4" aria-hidden />
              Erbij
            </Knop>
          </div>
          {toevoegen.error && <p className="text-sm text-bad">{toevoegen.error.message}</p>}
        </>
      )}
    </Kaart>
  )
}

/* ------------------------------------------------------------- de pagina --- */

export function InkoopSamenstelling() {
  const { id } = useParams()
  const navigeer = useNavigate()
  const { alles, isPending, error, refetch } = useSamenstellingen()
  const wijzig = useWijzigSamenstelling()
  const regelWeg = useRegelWeg()
  const weg = useSamenstellingWeg()
  const [verwijderen, setVerwijderen] = useState(false)

  if (isPending) return <Laden tekst="Kostprijs uitrekenen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={refetch} />

  const s = alles.find((a) => a.id === Number(id))
  if (!s) {
    return (
      <Leeg
        titel="Dit product bestaat niet"
        uitleg="Misschien is het verwijderd."
        actie={
          <Link to="/inkoop/producten" className="text-sm font-semibold underline">
            Terug naar alle producten
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/inkoop/producten"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Alle producten
        </Link>
        <h2 className="mt-2 font-display text-xl">{s.naam}</h2>
        <p className="mt-1 text-sm text-muted">
          {[s.groep, `per ${s.eenheidnaam}`, `doel ${(s.doel * 100).toFixed(0)}%`]
            .filter(Boolean)
            .join(' · ')}
          {s.gebruiktIn.length > 0 && ` · zit in ${s.gebruiktIn.map((g) => g.naam).join(', ')}`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cijfer
          waarde={s.kostprijs === null ? '—' : euro(s.kostprijs)}
          bij={`kostprijs per ${s.eenheidnaam}`}
        />
        <Cijfer
          waarde={procent(s.percentage)}
          bij={s.teDuur ? 'foodcost — boven je doel' : 'foodcost'}
          kleur={s.teDuur ? 'text-bad' : undefined}
        />
        <Cijfer
          waarde={s.advies === null ? '—' : euro(s.advies)}
          bij={
            s.adviesVerschil === null
              ? 'adviesprijs'
              : s.adviesVerschil > 0
                ? `adviesprijs — ${euro(s.adviesVerschil)} meer dan nu`
                : 'adviesprijs — je zit goed'
          }
        />
      </div>

      {s.fouten.length > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {s.fouten.join('; ')}. Zolang één regel geen prijs heeft blijft de kostprijs leeg —
            liever geen getal dan een getal dat te laag is.
          </span>
        </p>
      )}

      {/* ------------------------------------------------------- ingrediënten --- */}
      <Kaart className="flex flex-col py-2">
        <div className="grid grid-cols-[1fr_5rem_5rem_2rem] items-baseline gap-x-3 border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Ingrediënt</span>
          <span className="text-right">Hoeveel</span>
          <span className="text-right">Kosten</span>
          <span />
        </div>

        {s.regels.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted">Nog niets. Voeg hieronder iets toe.</p>
        )}

        {s.regels.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_5rem_5rem_2rem] items-baseline gap-x-3 border-b border-line px-4 py-2 last:border-0"
          >
            <span>
              {r.naam}
              <span className="block text-xs text-muted">
                {r.isOnderdeel ? 'eigen product' : [r.inhoud, r.artikelnr].filter(Boolean).join(' · ')}
                {r.eenheidsprijs !== null && ` · ${fijnEuro(r.eenheidsprijs)} per ${r.eenheid}`}
              </span>
            </span>
            <span className="text-right tabular-nums text-muted">
              {getal(r.hoeveelheid).toLocaleString('nl-NL', { maximumFractionDigits: 4 })}{' '}
              {eenheidTekst(getal(r.hoeveelheid), r.eenheid)}
            </span>
            <span className="text-right tabular-nums">
              {r.kosten === null ? <span className="text-muted">—</span> : euro(r.kosten)}
            </span>
            <button
              type="button"
              onClick={() => regelWeg.mutate(r.id)}
              aria-label={`${r.naam} weghalen`}
              className="justify-self-end text-muted hover:text-bad"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}

        {s.ingredienten !== null && (
          <div className="flex flex-col gap-1 border-t border-line px-4 pt-2 text-sm tabular-nums">
            <p className="flex justify-between">
              <span className="text-muted">Samen</span>
              <span>{euro(s.ingredienten)}</span>
            </p>
            {s.opslag > 0 && (
              <p className="flex justify-between">
                <span className="text-muted">Opslag frituurvet</span>
                <span>{euro(s.opslag)}</span>
              </p>
            )}
            {getal(s.opbrengst) !== 1 && (
              <p className="flex justify-between">
                <span className="text-muted">
                  Gedeeld door {getal(s.opbrengst)} {eenheidTekst(getal(s.opbrengst), s.eenheidnaam)}
                </span>
                <span>{euro(s.kostprijs)}</span>
              </p>
            )}
          </div>
        )}
      </Kaart>

      <Toevoegen s={s} alles={alles} />

      {/* ------------------------------------------------------------ instellen --- */}
      <Kaart className="flex flex-col gap-3 p-4">
        <p className="font-display text-lg">Instellingen van dit product</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <GetalVeld
            label="Verkoopprijs inclusief btw"
            waarde={s.verkoopprijs === null ? null : getal(s.verkoopprijs)}
            onWijzig={(n) => wijzig.mutate({ id: s.id, verkoopprijs: n === null ? null : String(n) })}
            placeholder="9,95"
          />
          <GetalVeld
            label={`Opbrengst (aantal ${s.eenheidnaam})`}
            waarde={getal(s.opbrengst)}
            onWijzig={(n) => n && n > 0 && wijzig.mutate({ id: s.id, opbrengst: String(n) })}
            placeholder="1"
          />
          <GetalVeld
            label="Eigen foodcost-doel in procenten"
            waarde={s.doel_foodcost === null ? null : getal(s.doel_foodcost) * 100}
            onWijzig={(n) =>
              wijzig.mutate({ id: s.id, doel_foodcost: n === null ? null : String(n / 100) })
            }
            placeholder={`${(s.doel * 100).toFixed(0)}`}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-muted">Btw</span>
            <select
              value={s.btw_pct}
              onChange={(e) => wijzig.mutate({ id: s.id, btw_pct: Number(e.target.value) })}
              className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 outline-none focus:border-accent"
            >
              <option value={9}>9%</option>
              <option value={21}>21%</option>
              <option value={0}>0%</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.vet_opslag}
            onChange={(e) => wijzig.mutate({ id: s.id, vet_opslag: e.target.checked })}
            className="size-4"
          />
          <span className="text-sm">Gefrituurd — tel de opslag voor frituurvet mee</span>
        </label>

        {wijzig.error && <p className="text-sm text-bad">{wijzig.error.message}</p>}
      </Kaart>

      <div className="flex flex-wrap items-center gap-2">
        {verwijderen ? (
          <>
            <span className="text-sm">Dit product helemaal weghalen?</span>
            <Knop
              soort="gevaar"
              bezig={weg.isPending}
              onClick={async () => {
                await weg.mutateAsync(s.id)
                navigeer('/inkoop/producten')
              }}
            >
              Ja, weg ermee
            </Knop>
            <Knop soort="rustig" onClick={() => setVerwijderen(false)}>
              Nee, laat staan
            </Knop>
          </>
        ) : (
          <Knop soort="rustig" onClick={() => setVerwijderen(true)}>
            <Trash2 className="size-4" aria-hidden />
            Product verwijderen
          </Knop>
        )}
      </div>
      {weg.error && <p className="text-sm text-bad">{weg.error.message}</p>}
    </div>
  )
}
