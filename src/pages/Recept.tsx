import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Pencil, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { korteDatum, toonNaam } from '../lib/personeel'
import { magIk, useMijnRechten } from '../lib/rechten'
import {
  regelsVan,
  useFotoToevoegen,
  useFotoWeg,
  useRecept,
  useReceptBewaren,
  useReceptFotos,
  useReceptWeggooien,
  type Recept as ReceptType,
} from '../lib/recepten'

/* Eén recept: lezen in de keuken, schrijven door wie dat mag. Zie
   docs/Modules/recepten.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

type Concept = {
  naam: string
  omschrijving: string
  basis: string
  ingredienten: string
  bereiding: string
}

function conceptVan(r: ReceptType | undefined): Concept {
  return {
    naam: r?.naam ?? '',
    omschrijving: r?.omschrijving ?? '',
    basis: r?.basis ?? '',
    ingredienten: r?.ingredienten ?? '',
    bereiding: r?.bereiding ?? '',
  }
}

function Fotos({ receptId, mag }: { receptId: number; mag: boolean }) {
  const { data } = useReceptFotos(receptId)
  const toevoegen = useFotoToevoegen(receptId)
  const weg = useFotoWeg()
  const kiezer = useRef<HTMLInputElement>(null)
  const [fout, setFout] = useState<string | null>(null)

  const fotos = data ?? []
  if (fotos.length === 0 && !mag) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Foto's</Kopje>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fotos.map((f) => (
            <Kaart key={f.id} className="flex flex-col overflow-hidden">
              <img
                src={f.url}
                alt={f.bijschrift ?? 'Foto bij dit recept'}
                loading="lazy"
                className="w-full bg-surface-2 object-contain"
              />
              {mag && (
                <button
                  type="button"
                  onClick={() => weg.mutate(f, { onError: (e) => setFout(e.message) })}
                  className="flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-muted hover:text-bad"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Weghalen
                </button>
              )}
            </Kaart>
          ))}
        </div>
      )}

      {mag && (
        <>
          <input
            ref={kiezer}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const b = e.target.files?.[0]
              if (b) toevoegen.mutate(b, { onError: (x) => setFout(x.message) })
              e.target.value = ''
            }}
          />
          <Knop soort="rustig" className="w-fit" bezig={toevoegen.isPending} onClick={() => kiezer.current?.click()}>
            <Camera className="size-4" aria-hidden />
            Foto toevoegen
          </Knop>
        </>
      )}
    </section>
  )
}

export function Recept() {
  const { id } = useParams()
  const nieuw = id === 'nieuw'
  const receptId = nieuw ? undefined : Number(id)
  const navigeer = useNavigate()

  const { data: rechten } = useMijnRechten()
  const { data: recept, isPending, error, refetch } = useRecept(receptId)
  const bewaren = useReceptBewaren()
  const weggooien = useReceptWeggooien()

  const [bewerken, setBewerken] = useState(nieuw)
  const [concept, setConcept] = useState<Concept | null>(nieuw ? conceptVan(undefined) : null)
  const [fout, setFout] = useState<string | null>(null)
  const [bevestigen, setBevestigen] = useState(false)

  const mag = magIk(rechten, 'recepten')

  if (!nieuw && isPending) return <Laden />
  if (!nieuw && error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const c = concept ?? conceptVan(recept)

  function bewaar() {
    setFout(null)
    bewaren.mutate(
      { ...c, id: receptId },
      {
        onSuccess: (nieuwId) => {
          setBewerken(false)
          setConcept(null)
          if (nieuw) navigeer(`/recepten/${nieuwId}`, { replace: true })
        },
        onError: (e) => setFout(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/recepten"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar de recepten
      </Link>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {bewerken ? (
        <div className="flex flex-col gap-4">
          <Veld
            label="Naam"
            placeholder="Pindasaus"
            value={c.naam}
            autoFocus
            onChange={(e) => setConcept({ ...c, naam: e.target.value })}
          />
          <Veld
            label="Waar dit recept voor is"
            placeholder="1 bak — ongeveer 40 porties"
            value={c.basis}
            onChange={(e) => setConcept({ ...c, basis: e.target.value })}
          />
          <Veld
            label="Korte omschrijving"
            placeholder="Optioneel"
            value={c.omschrijving}
            onChange={(e) => setConcept({ ...c, omschrijving: e.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-ingr" className="text-sm font-semibold text-muted">
              Ingrediënten — één per regel
            </label>
            <textarea
              id="r-ingr"
              rows={8}
              className={`${invoer} font-mono text-sm`}
              placeholder={'500 g pindakaas\n1 l water\n2 el sambal'}
              value={c.ingredienten}
              onChange={(e) => setConcept({ ...c, ingredienten: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-ber" className="text-sm font-semibold text-muted">
              Bereiding
            </label>
            <textarea
              id="r-ber"
              rows={10}
              className={invoer}
              placeholder="Stap voor stap. Eén stap per regel leest het prettigst."
              value={c.bereiding}
              onChange={(e) => setConcept({ ...c, bereiding: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={bewaren.isPending} disabled={!c.naam.trim()} onClick={bewaar}>
              Bewaren
            </Knop>
            <Knop
              soort="rustig"
              onClick={() => {
                if (nieuw) navigeer('/recepten')
                else {
                  setBewerken(false)
                  setConcept(null)
                }
              }}
            >
              Annuleren
            </Knop>
          </div>
        </div>
      ) : (
        recept && (
          <>
            <div>
              <h2 className="font-display text-2xl">{recept.naam}</h2>
              {recept.basis && <p className="mt-1 text-sm text-muted">Voor {recept.basis}</p>}
              {recept.omschrijving && <p className="mt-2">{recept.omschrijving}</p>}
            </div>

            {regelsVan(recept.ingredienten).length > 0 && (
              <section className="flex flex-col gap-3">
                <Kopje>Ingrediënten</Kopje>
                <Kaart>
                  {regelsVan(recept.ingredienten).map((r, i) => (
                    <p key={i} className="border-b border-line px-4 py-2.5 last:border-b-0">
                      {r}
                    </p>
                  ))}
                </Kaart>
              </section>
            )}

            {recept.bereiding && (
              <section className="flex flex-col gap-3">
                <Kopje>Bereiding</Kopje>
                <Kaart className="p-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{recept.bereiding}</p>
                </Kaart>
              </section>
            )}

            <Fotos receptId={recept.id} mag={mag} />

            <p className="text-sm text-muted">
              Laatst bijgewerkt op {korteDatum(recept.bijgewerkt_op)}
              {recept.bijgewerkt_door ? ` door ${toonNaam(recept.bijgewerkt_door)}` : ''}.
            </p>

            {mag && (
              <div className="flex flex-wrap gap-2">
                <Knop soort="rustig" onClick={() => setBewerken(true)}>
                  <Pencil className="size-4" aria-hidden />
                  Wijzigen
                </Knop>
                {bevestigen ? (
                  <>
                    <Knop
                      soort="gevaar"
                      bezig={weggooien.isPending}
                      onClick={() =>
                        weggooien.mutate(recept.id, {
                          onSuccess: () => navigeer('/recepten'),
                          onError: (e) => setFout(e.message),
                        })
                      }
                    >
                      Ja, recept weggooien
                    </Knop>
                    <Knop soort="rustig" onClick={() => setBevestigen(false)}>
                      Toch niet
                    </Knop>
                  </>
                ) : (
                  <Knop soort="gevaar" onClick={() => setBevestigen(true)}>
                    <Trash2 className="size-4" aria-hidden />
                    Weggooien
                  </Knop>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
