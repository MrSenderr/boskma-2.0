import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { magIk, useMijnRechten } from '../lib/rechten'
import {
  KLEUREN,
  useCategorieen,
  useKaartBewaren,
  useKaartWeggooien,
  useStappen,
  useStappenBewaren,
  useWerkkaarten,
  weergaveVan,
  type Stap,
  type Weergave,
  type Werkkaart,
} from '../lib/werkkaarten'

/* Werkkaarten toevoegen en aanpassen. Zie docs/Modules/werkkaarten.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'
const klein =
  'rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 py-2 text-base outline-none focus:border-accent'

type Ontwerp = Omit<Stap, 'id' | 'kaart_id'>

function Stappen({
  stappen,
  zet,
  stapel,
}: {
  stappen: Ontwerp[]
  zet: (s: Ontwerp[]) => void
  stapel: boolean
}) {
  function wijzig(i: number, deel: Partial<Ontwerp>) {
    zet(stappen.map((s, n) => (n === i ? { ...s, ...deel } : s)))
  }
  function verplaats(i: number, richting: -1 | 1) {
    const doel = i + richting
    if (doel < 0 || doel >= stappen.length) return
    const nieuw = [...stappen]
    ;[nieuw[i], nieuw[doel]] = [nieuw[doel], nieuw[i]]
    zet(nieuw)
  }

  return (
    <div className="flex flex-col gap-2">
      {stapel && (
        <p className="text-sm text-muted">
          Stap 1 ligt onderop. De kleur bepaalt hoe het blok eruitziet.
        </p>
      )}

      {stappen.map((s, i) => (
        <Kaart key={i} className="flex flex-wrap items-center gap-2 p-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand tabular-nums">
            {i + 1}
          </span>

          <input
            className={`${invoer} min-w-[10rem] flex-1`}
            placeholder="Wat er moet gebeuren"
            aria-label={`Stap ${i + 1}`}
            value={s.tekst}
            onChange={(e) => wijzig(i, { tekst: e.target.value })}
          />

          <input
            type="number"
            min={0}
            className={`${klein} w-20 tabular-nums`}
            placeholder="min"
            aria-label={`Minuten bij stap ${i + 1}`}
            value={s.minuten ?? ''}
            onChange={(e) => wijzig(i, { minuten: e.target.value === '' ? null : Number(e.target.value) })}
          />

          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[#B87A22]"
              checked={s.apparaat}
              onChange={(e) => wijzig(i, { apparaat: e.target.checked })}
            />
            oven
          </label>

          {stapel && (
            <select
              className={klein}
              aria-label={`Kleur van stap ${i + 1}`}
              value={s.kleur ?? 'overig'}
              onChange={(e) => wijzig(i, { kleur: e.target.value })}
            >
              {KLEUREN.map((k) => (
                <option key={k.waarde} value={k.waarde}>
                  {k.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => verplaats(i, -1)}
            aria-label="Naar boven"
            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => verplaats(i, 1)}
            aria-label="Naar beneden"
            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => zet(stappen.filter((_, n) => n !== i))}
            aria-label={`Stap ${i + 1} weghalen`}
            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </Kaart>
      ))}

      <Knop
        soort="rustig"
        className="w-fit"
        onClick={() => zet([...stappen, { volgorde: stappen.length + 1, tekst: '', apparaat: false, minuten: null, kleur: stapel ? 'overig' : null }])}
      >
        <Plus className="size-4" aria-hidden />
        Stap erbij
      </Knop>
    </div>
  )
}

export function WerkkaartBeheer() {
  const { data: rechten } = useMijnRechten()
  const { data: categorieen, isPending, error, refetch } = useCategorieen()
  const { data: kaarten } = useWerkkaarten()
  const bewaren = useKaartBewaren()
  const weggooien = useKaartWeggooien()
  const stappenBewaren = useStappenBewaren()

  const [gekozen, setGekozen] = useState<number | null>(null)
  const [bewerkt, setBewerkt] = useState<Partial<Werkkaart> | null>(null)
  const [ontwerp, setOntwerp] = useState<Ontwerp[]>([])
  const { data: bestaandeStappen } = useStappen(bewerkt?.id)
  const [geladen, setGeladen] = useState<number | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [weg, setWeg] = useState<number | null>(null)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />
  if (!magIk(rechten, 'recepten')) {
    return <Mislukt tekst="Je mag werkkaarten niet aanpassen. Vraag Sander om het vinkje 'recepten bijhouden'." />
  }

  // Bij het openen van een bestaande kaart de stappen één keer overnemen.
  if (bewerkt?.id && geladen !== bewerkt.id && bestaandeStappen) {
    setOntwerp(bestaandeStappen.map(({ volgorde, tekst, apparaat, minuten, kleur }) => ({ volgorde, tekst, apparaat, minuten, kleur })))
    setGeladen(bewerkt.id)
  }

  const cat = categorieen.find((c) => c.id === (bewerkt?.categorie_id ?? gekozen))
  const stapel = bewerkt
    ? weergaveVan({ ...(bewerkt as Werkkaart), weergave: bewerkt.weergave ?? null }, cat) === 'stapel'
    : false

  function nieuw(categorieId: number) {
    setBewerkt({ categorie_id: categorieId, naam: '', gebruikt_gedeelde: true, eigen_bereiding: '' })
    setOntwerp([])
    setGeladen(-1)
  }

  async function bewaar() {
    if (!bewerkt?.naam?.trim() || !bewerkt.categorie_id) return
    setFout(null)
    try {
      const id = await bewaren.mutateAsync(bewerkt as Werkkaart & { naam: string; categorie_id: number })
      await stappenBewaren.mutateAsync({ kaartId: id, stappen: ontwerp.filter((s) => s.tekst.trim()) })
      setBewerkt(null)
      setGeladen(null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'bewaren mislukt')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to="/werkkaarten" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden />
        Naar de werkkaarten
      </Link>

      <Kopje>Werkkaarten beheren</Kopje>

      {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

      {bewerkt ? (
        <div className="flex flex-col gap-4">
          <Veld
            label="Naam van het gerecht"
            value={bewerkt.naam ?? ''}
            autoFocus
            onChange={(e) => setBewerkt({ ...bewerkt, naam: e.target.value })}
          />

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="w-cat" className="text-sm font-semibold text-muted">Categorie</label>
              <select
                id="w-cat"
                className={invoer}
                value={bewerkt.categorie_id}
                onChange={(e) => setBewerkt({ ...bewerkt, categorie_id: Number(e.target.value) })}
              >
                {categorieen.map((c) => (
                  <option key={c.id} value={c.id}>{c.naam}</option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="w-weergave" className="text-sm font-semibold text-muted">Weergave</label>
              <select
                id="w-weergave"
                className={invoer}
                value={bewerkt.weergave ?? ''}
                onChange={(e) => setBewerkt({ ...bewerkt, weergave: (e.target.value || null) as Weergave | null })}
              >
                <option value="">Zoals de categorie ({cat?.weergave === 'stapel' ? 'gestapeld' : 'lijst'})</option>
                <option value="lijst">Genummerde lijst</option>
                <option value="stapel">Gestapeld</option>
              </select>
            </div>
          </div>

          {cat?.gedeelde_bereiding && (
            <label className="flex items-start gap-3 rounded-[4px] bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[#003A41]"
                checked={bewerkt.gebruikt_gedeelde ?? true}
                onChange={(e) => setBewerkt({ ...bewerkt, gebruikt_gedeelde: e.target.checked })}
              />
              <span>
                De gedeelde bereiding van {cat.naam} erboven tonen
                <span className="mt-0.5 block text-muted">
                  Zet uit als dit gerecht een eigen voorbereiding heeft — zoals de
                  Royal Spicy.
                </span>
              </span>
            </label>
          )}

          {stapel && (
            <label className="flex items-start gap-3 rounded-[4px] bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[#003A41]"
                checked={bewerkt.broodje ?? false}
                onChange={(e) => setBewerkt({ ...bewerkt, broodje: e.target.checked })}
              />
              <span>
                Een broodje om de stapel tekenen
                <span className="mt-0.5 block text-muted">
                  Onder- en bovenkant van een burgerbroodje om de blokken heen.
                </span>
              </span>
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="w-eigen" className="text-sm font-semibold text-muted">
              Eigen voorbereiding (mag leeg)
            </label>
            <textarea
              id="w-eigen"
              rows={3}
              className={invoer}
              placeholder={'1. Kipburger in de frituur\n2. Broodje 3 min in de oven'}
              value={bewerkt.eigen_bereiding ?? ''}
              onChange={(e) => setBewerkt({ ...bewerkt, eigen_bereiding: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="w-btijd" className="text-sm font-semibold text-muted">
                Timer bij de voorbereiding (minuten)
              </label>
              <input
                id="w-btijd"
                type="number"
                min={0}
                className={`${invoer} tabular-nums`}
                placeholder="leeg = geen timer"
                value={bewerkt.bereiding_minuten ?? ''}
                onChange={(e) =>
                  setBewerkt({
                    ...bewerkt,
                    bereiding_minuten: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="w-blabel" className="text-sm font-semibold text-muted">
                Waar die timer over gaat
              </label>
              <input
                id="w-blabel"
                className={invoer}
                placeholder="Broodje in de oven"
                value={bewerkt.bereiding_label ?? ''}
                onChange={(e) => setBewerkt({ ...bewerkt, bereiding_label: e.target.value })}
              />
            </div>
          </div>

          <Kopje>Stappen</Kopje>
          <Stappen stappen={ontwerp} zet={setOntwerp} stapel={stapel} />

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={bewaren.isPending || stappenBewaren.isPending} disabled={!bewerkt.naam?.trim()} onClick={bewaar}>
              Bewaren
            </Knop>
            <Knop soort="rustig" onClick={() => { setBewerkt(null); setGeladen(null) }}>
              Annuleren
            </Knop>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {categorieen.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setGekozen(c.id)}
                className={`min-h-11 rounded-[4px] px-4 py-2.5 text-sm font-semibold ${
                  gekozen === c.id ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
                }`}
              >
                {c.naam}
              </button>
            ))}
          </div>

          {gekozen && (
            <>
              <Knop soort="rustig" className="w-fit" onClick={() => nieuw(gekozen)}>
                <Plus className="size-4" aria-hidden />
                Gerecht toevoegen
              </Knop>

              <Kaart>
                {(kaarten ?? [])
                  .filter((k) => k.categorie_id === gekozen)
                  .map((k) => (
                    <div key={k.id} className="border-b border-line px-4 py-3 last:border-b-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <span className="min-w-0 flex-1 font-medium">{k.naam}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setBewerkt(k); setGeladen(null) }}
                            className="min-h-11 rounded-[4px] border border-line-strong px-3 text-sm font-semibold hover:bg-surface-2"
                          >
                            Wijzigen
                          </button>
                          <button
                            type="button"
                            onClick={() => setWeg(k.id)}
                            aria-label={`${k.naam} weggooien`}
                            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                      {weg === k.id && (
                        <div className="mt-2 flex flex-wrap gap-2 rounded-[4px] border border-bad bg-bad-soft p-3">
                          <p className="w-full text-sm text-bad">"{k.naam}" met alle stappen weggooien?</p>
                          <Knop soort="gevaar" bezig={weggooien.isPending} onClick={() => weggooien.mutate(k.id, { onSuccess: () => setWeg(null), onError: (e) => setFout(e.message) })}>
                            Ja, weggooien
                          </Knop>
                          <Knop soort="rustig" onClick={() => setWeg(null)}>Toch niet</Knop>
                        </div>
                      )}
                    </div>
                  ))}
              </Kaart>
            </>
          )}
        </>
      )}
    </div>
  )
}
