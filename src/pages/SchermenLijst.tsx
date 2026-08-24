import { useState } from 'react'
import { Images, Layers, Monitor, X } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt, Pil } from '../components/ui'
import {
  ZONDER_MAP,
  leeftNog,
  mappenVan,
  stilSinds,
  useAfbeeldingen,
  useBewaardeReeksen,
  useLopendeReeksen,
  useReeksZetten,
  useSchermInstellen,
  useSchermen,
  type Scherm,
} from '../lib/schermen'

/* De zes schermen in de zaak. Zie docs/Modules/schermen/schermenmodule.md. */

function Kiezer({
  scherm,
  sluiten,
}: {
  scherm: Scherm
  sluiten: () => void
}) {
  const { data: afbeeldingen } = useAfbeeldingen()
  const instellen = useSchermInstellen()
  const [map, setMap] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const alles = afbeeldingen ?? []
  const mappen = mappenVan(alles)
  const zichtbaar = map === null ? alles : alles.filter((a) => (a.map?.trim() || ZONDER_MAP) === map)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Afbeelding kiezen voor ${scherm.naam}`}
    >
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-card bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <span className="font-display text-base">Wat komt er op {scherm.naam}?</span>
          <button
            type="button"
            onClick={sluiten}
            aria-label="Sluiten"
            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={() => setMap(null)}
            className={`min-h-11 rounded-[4px] px-3 py-2 text-sm font-semibold ${
              map === null ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
            }`}
          >
            Alles
          </button>
          {mappen.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMap(m)}
              className={`min-h-11 rounded-[4px] px-3 py-2 text-sm font-semibold ${
                map === m ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {fout && (
          <p className="m-4 rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {zichtbaar.length === 0 ? (
            <p className="text-sm text-muted">Geen afbeeldingen in deze map.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {zichtbaar.map((a) => {
                const staatErop = a.url === scherm.actieve_afbeelding_url
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      instellen.mutate(
                        { schermId: scherm.id, url: a.url },
                        { onSuccess: sluiten, onError: (e) => setFout(e.message) },
                      )
                    }
                    className={`flex flex-col overflow-hidden rounded-card border-2 text-left transition-colors ${
                      staatErop ? 'border-accent' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <img
                      src={a.url}
                      alt={a.bestandsnaam}
                      loading="lazy"
                      className="aspect-video w-full bg-surface-2 object-contain"
                    />
                    <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate">{a.bestandsnaam}</span>
                      {staatErop && <Pil soort="goed">Staat erop</Pil>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SchermKaart({
  scherm,
  lopend,
  bewaard,
  kies,
}: {
  scherm: Scherm
  lopend: number
  bewaard: number
  kies: () => void
}) {
  const reeks = useReeksZetten()
  const [fout, setFout] = useState<string | null>(null)
  const leeft = leeftNog(scherm)

  return (
    <Kaart className={`flex flex-col gap-3 p-4 ${leeft ? '' : 'border-bad'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Monitor className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="font-display text-lg">{scherm.naam}</span>
        {leeft ? <Pil soort="goed">Online</Pil> : <Pil soort="fout">{stilSinds(scherm)}</Pil>}
      </div>

      {lopend > 0 && (
        <div className="flex flex-col gap-2 rounded-[4px] border border-warn bg-warn-soft p-3">
          <p className="flex items-start gap-2 text-sm text-warn">
            <Layers className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Hier draait een reeks van {lopend} beelden. Zolang die aanstaat doet een
              vast beeld niets — het scherm kijkt er niet naar.
            </span>
          </p>
          <Knop
            soort="rustig"
            className="w-fit"
            bezig={reeks.isPending}
            onClick={() =>
              reeks.mutate({ schermId: scherm.id, aan: false }, { onError: (e) => setFout(e.message) })
            }
          >
            Reeks stoppen
          </Knop>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="w-40 shrink-0 overflow-hidden rounded-[4px] border border-line bg-surface-2">
          {scherm.actieve_afbeelding_url ? (
            <img
              src={scherm.actieve_afbeelding_url}
              alt={`Wat er op ${scherm.naam} staat`}
              loading="lazy"
              className="aspect-video w-full object-contain"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-xs text-muted">
              leeg
            </div>
          )}
        </div>

        <div className="flex min-w-[10rem] flex-1 flex-col items-start gap-2">
          <Knop soort="primair" onClick={kies}>
            <Images className="size-4" aria-hidden />
            Andere afbeelding
          </Knop>
          {lopend === 0 && bewaard > 0 && (
            <Knop
              soort="rustig"
              bezig={reeks.isPending}
              onClick={() =>
                reeks.mutate({ schermId: scherm.id, aan: true }, { onError: (e) => setFout(e.message) })
              }
            >
              <Layers className="size-4" aria-hidden />
              Bewaarde reeks van {bewaard} weer aanzetten
            </Knop>
          )}
        </div>
      </div>

      {fout && <p className="text-sm text-bad">{fout}</p>}
    </Kaart>
  )
}

export function SchermenLijst() {
  const { data, isPending, error, refetch } = useSchermen()
  const { data: lopend } = useLopendeReeksen()
  const { data: bewaard } = useBewaardeReeksen()
  const [kiezen, setKiezen] = useState<Scherm | null>(null)

  if (isPending) return <Laden tekst="Schermen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const stil = data.filter((s) => !leeftNog(s)).length

  return (
    <div className="flex flex-col gap-4">
      {stil > 0 && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          {stil === 1 ? 'Eén scherm heeft' : `${stil} schermen hebben`} zich al een
          tijd niet gemeld. Meestal helpt de stekker eruit en er weer in.
        </p>
      )}

      {data.map((s) => (
        <SchermKaart
          key={s.id}
          scherm={s}
          lopend={lopend?.[s.id] ?? 0}
          bewaard={bewaard?.[s.id] ?? 0}
          kies={() => setKiezen(s)}
        />
      ))}

      {kiezen && (
        <Kiezer
          scherm={data.find((s) => s.id === kiezen.id) ?? kiezen}
          sluiten={() => setKiezen(null)}
        />
      )}

      <p className="max-w-prose text-sm text-muted">
        Elk scherm haalt om de dertig seconden op wat het moet tonen. Een wijziging
        staat er dus binnen een halve minuut op — je hoeft niets te verversen.
      </p>
    </div>
  )
}

