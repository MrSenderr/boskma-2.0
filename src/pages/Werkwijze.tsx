import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { DocumentLink } from '../components/DocumentLink'
import { korteDatum, toonNaam } from '../lib/personeel'
import { magIk, useMijnRechten } from '../lib/rechten'
import { fotoUrl } from '../lib/meldingen'
import {
  fotoOpslaan,
  useStappen,
  useStappenBewaren,
  useWerkwijze,
  useWerkwijzeBewaren,
  useWerkwijzeWeggooien,
} from '../lib/werkwijzen'

/* Eén werkwijze: lezen tijdens het werk, schrijven door wie dat mag. Zie
   docs/Modules/werkwijzen.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

type Ontwerp = { tekst: string; foto_pad: string | null }

/** Een foto uit de beveiligde opslag. Het adres verloopt, dus hier ophalen en
 *  niet in de database bewaren. */
function Foto({ pad, alt }: { pad: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let nog = true
    fotoUrl(pad)
      .then((u) => nog && setUrl(u))
      .catch(() => nog && setUrl(null))
    return () => {
      nog = false
    }
  }, [pad])
  if (!url) return null
  return <img src={url} alt={alt} loading="lazy" className="mt-2 max-h-64 rounded-[4px] border border-line" />
}

function StapBewerken({
  stap,
  nummer,
  werkwijzeId,
  wijzig,
  weg,
  omhoog,
  omlaag,
  meldFout,
}: {
  stap: Ontwerp
  nummer: number
  werkwijzeId: number | null
  wijzig: (s: Ontwerp) => void
  weg: () => void
  omhoog: () => void
  omlaag: () => void
  meldFout: (f: string) => void
}) {
  const kiezer = useRef<HTMLInputElement>(null)
  const [bezig, setBezig] = useState(false)

  return (
    <Kaart className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand tabular-nums">
          {nummer}
        </span>
        <textarea
          rows={2}
          className={`${invoer} min-w-0 flex-1`}
          placeholder="Wat er moet gebeuren"
          aria-label={`Stap ${nummer}`}
          value={stap.tekst}
          onChange={(e) => wijzig({ ...stap, tekst: e.target.value })}
        />
      </div>

      {stap.foto_pad && (
        <div className="pl-10">
          <Foto pad={stap.foto_pad} alt={`Foto bij stap ${nummer}`} />
          <button
            type="button"
            onClick={() => wijzig({ ...stap, foto_pad: null })}
            className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-bad"
          >
            <X className="size-4" aria-hidden />
            Foto weghalen
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pl-10">
        <input
          ref={kiezer}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const bestand = e.target.files?.[0]
            e.target.value = ''
            if (!bestand || !werkwijzeId) {
              if (!werkwijzeId) meldFout('Bewaar de werkwijze eerst, dan kun je foto’s toevoegen.')
              return
            }
            setBezig(true)
            try {
              wijzig({ ...stap, foto_pad: await fotoOpslaan(werkwijzeId, bestand) })
            } catch (x) {
              meldFout(x instanceof Error ? x.message : 'foto mislukt')
            } finally {
              setBezig(false)
            }
          }}
        />
        {!stap.foto_pad && (
          <Knop soort="rustig" bezig={bezig} onClick={() => kiezer.current?.click()}>
            <Camera className="size-4" aria-hidden />
            Foto
          </Knop>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={omhoog} aria-label="Naar boven" className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2">
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={omlaag} aria-label="Naar beneden" className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2">
            <ChevronDown className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={weg} aria-label={`Stap ${nummer} weghalen`} className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </span>
      </div>
    </Kaart>
  )
}

export function Werkwijze() {
  const { id } = useParams()
  const nieuw = id === 'nieuw'
  const werkwijzeId = nieuw ? undefined : Number(id)
  const navigeer = useNavigate()

  const { data: rechten } = useMijnRechten()
  const { data: werkwijze, isPending, error, refetch } = useWerkwijze(werkwijzeId)
  const { data: stappen } = useStappen(werkwijzeId)
  const bewaren = useWerkwijzeBewaren()
  const stappenBewaren = useStappenBewaren()
  const weggooien = useWerkwijzeWeggooien()

  const [bewerken, setBewerken] = useState(nieuw)
  const [naam, setNaam] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [ontwerp, setOntwerp] = useState<Ontwerp[]>([])
  const [geladen, setGeladen] = useState<number | null>(nieuw ? -1 : null)
  const [fout, setFout] = useState<string | null>(null)
  const [bevestigen, setBevestigen] = useState(false)

  const mag = magIk(rechten, 'recepten')

  // Bij het openen één keer overnemen; daarna is het ontwerp van jou.
  if (werkwijze && stappen && geladen !== werkwijze.id) {
    setNaam(werkwijze.naam)
    setOmschrijving(werkwijze.omschrijving ?? '')
    setOntwerp(stappen.map((s) => ({ tekst: s.tekst, foto_pad: s.foto_pad })))
    setGeladen(werkwijze.id)
  }

  if (!nieuw && isPending) return <Laden />
  if (!nieuw && error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  async function bewaar() {
    if (!naam.trim()) return
    setFout(null)
    try {
      const nieuwId = await bewaren.mutateAsync({ id: werkwijzeId, naam, omschrijving })
      await stappenBewaren.mutateAsync({
        werkwijzeId: nieuwId,
        stappen: ontwerp.filter((s) => s.tekst.trim()),
      })
      setBewerken(false)
      if (nieuw) navigeer(`/werkwijzen/${nieuwId}`, { replace: true })
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'bewaren mislukt')
    }
  }

  function verplaats(i: number, richting: -1 | 1) {
    const doel = i + richting
    if (doel < 0 || doel >= ontwerp.length) return
    const lijst = [...ontwerp]
    ;[lijst[i], lijst[doel]] = [lijst[doel], lijst[i]]
    setOntwerp(lijst)
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to="/werkwijzen" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar de werkwijzen
      </Link>

      {fout && <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>}

      {bewerken ? (
        <div className="flex flex-col gap-4">
          <Veld label="Naam" placeholder="Sla drogen" value={naam} autoFocus onChange={(e) => setNaam(e.target.value)} />
          <Veld
            label="Korte omschrijving"
            placeholder="Optioneel"
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
          />

          <Kopje>Stappen</Kopje>
          {!werkwijzeId && (
            <p className="text-sm text-muted">
              Bewaar eerst, dan kun je bij elke stap een foto zetten.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {ontwerp.map((s, i) => (
              <StapBewerken
                key={i}
                stap={s}
                nummer={i + 1}
                werkwijzeId={werkwijzeId ?? null}
                wijzig={(nieuwS) => setOntwerp(ontwerp.map((x, n) => (n === i ? nieuwS : x)))}
                weg={() => setOntwerp(ontwerp.filter((_, n) => n !== i))}
                omhoog={() => verplaats(i, -1)}
                omlaag={() => verplaats(i, 1)}
                meldFout={setFout}
              />
            ))}
            <Knop
              soort="rustig"
              className="w-fit"
              onClick={() => setOntwerp([...ontwerp, { tekst: '', foto_pad: null }])}
            >
              <Plus className="size-4" aria-hidden />
              Stap erbij
            </Knop>
          </div>

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={bewaren.isPending || stappenBewaren.isPending} disabled={!naam.trim()} onClick={bewaar}>
              Bewaren
            </Knop>
            <Knop
              soort="rustig"
              onClick={() => {
                if (nieuw) navigeer('/werkwijzen')
                else {
                  setBewerken(false)
                  setGeladen(null)
                }
              }}
            >
              Annuleren
            </Knop>
          </div>
        </div>
      ) : (
        werkwijze && (
          <>
            <div>
              <h2 className="font-display text-2xl">{werkwijze.naam}</h2>
              {werkwijze.omschrijving && <p className="mt-2">{werkwijze.omschrijving}</p>}
            </div>

            {(stappen ?? []).length === 0 ? (
              <Kaart className="p-4">
                <p className="text-sm text-muted">Er staan nog geen stappen in.</p>
              </Kaart>
            ) : (
              <div className="flex flex-col gap-2">
                {(stappen ?? []).map((s) => (
                  <Kaart key={s.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand tabular-nums">
                        {s.volgorde}
                      </span>
                      <p className="min-w-0 flex-1 whitespace-pre-wrap">{s.tekst}</p>
                    </div>
                    {s.foto_pad && (
                      <div className="pl-11">
                        <Foto pad={s.foto_pad} alt={`Foto bij stap ${s.volgorde}`} />
                        <DocumentLink pad={s.foto_pad} className="mt-2">
                          Foto groot bekijken
                        </DocumentLink>
                      </div>
                    )}
                  </Kaart>
                ))}
              </div>
            )}

            <p className="text-sm text-muted">
              Laatst bijgewerkt op {korteDatum(werkwijze.bijgewerkt_op)}
              {werkwijze.bijgewerkt_door ? ` door ${toonNaam(werkwijze.bijgewerkt_door)}` : ''}.
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
                        weggooien.mutate(werkwijze.id, {
                          onSuccess: () => navigeer('/werkwijzen'),
                          onError: (e) => setFout(e.message),
                        })
                      }
                    >
                      Ja, weggooien
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
