import { useRef, useState } from 'react'
import { FolderOpen, Trash2, Upload } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import {
  ZONDER_MAP,
  mappenVan,
  useAfbeeldingInMap,
  useAfbeeldingUploaden,
  useAfbeeldingWeggooien,
  useAfbeeldingen,
  useSchermen,
  type Afbeelding,
} from '../lib/schermen'

/* De bibliotheek. Zie docs/Modules/schermen/schermenmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Beeld({
  afbeelding: a,
  mappen,
  opScherm,
  meldFout,
}: {
  afbeelding: Afbeelding
  mappen: string[]
  opScherm: string | null
  meldFout: (f: string) => void
}) {
  const inMap = useAfbeeldingInMap()
  const weg = useAfbeeldingWeggooien()
  const [nieuweMap, setNieuweMap] = useState(false)
  const [bevestigen, setBevestigen] = useState(false)

  return (
    <Kaart className="flex flex-col overflow-hidden">
      <img
        src={a.url}
        alt={a.bestandsnaam}
        loading="lazy"
        className="aspect-video w-full bg-surface-2 object-contain"
      />
      <div className="flex flex-col gap-2 p-3">
        <p className="truncate text-sm font-medium" title={a.bestandsnaam}>
          {a.bestandsnaam}
        </p>

        {opScherm && <Pil soort="goed">Staat op {opScherm}</Pil>}

        {nieuweMap ? (
          <input
            className={invoer}
            autoFocus
            placeholder="Naam van de map"
            defaultValue={a.map ?? ''}
            aria-label="Naam van de map"
            onBlur={(e) => {
              inMap.mutate(
                { id: a.id, map: e.target.value },
                { onError: (err) => meldFout(err.message) },
              )
              setNieuweMap(false)
            }}
          />
        ) : (
          <select
            className={invoer}
            aria-label={`Map van ${a.bestandsnaam}`}
            value={a.map?.trim() || ''}
            onChange={(e) => {
              if (e.target.value === '__nieuw__') {
                setNieuweMap(true)
                return
              }
              inMap.mutate(
                { id: a.id, map: e.target.value || null },
                { onError: (err) => meldFout(err.message) },
              )
            }}
          >
            <option value="">{ZONDER_MAP}</option>
            {mappen
              .filter((m) => m !== ZONDER_MAP)
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            <option value="__nieuw__">Nieuwe map…</option>
          </select>
        )}

        {bevestigen ? (
          <div className="flex flex-col gap-2 rounded-[4px] border border-bad bg-bad-soft p-2">
            <p className="text-sm text-bad">
              {opScherm
                ? `Deze staat op ${opScherm}. Dan blijft dat scherm hem tonen, maar kun je hem hier niet meer kiezen.`
                : 'Uit de lijst halen?'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Knop
                soort="gevaar"
                bezig={weg.isPending}
                onClick={() => weg.mutate(a, { onError: (e) => meldFout(e.message) })}
              >
                Ja, weghalen
              </Knop>
              <Knop soort="rustig" onClick={() => setBevestigen(false)}>
                Toch niet
              </Knop>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBevestigen(true)}
            className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-bad"
          >
            <Trash2 className="size-4" aria-hidden />
            Weghalen
          </button>
        )}
      </div>
    </Kaart>
  )
}

export function SchermAfbeeldingen() {
  const { data, isPending, error, refetch } = useAfbeeldingen()
  const { data: schermen } = useSchermen()
  const uploaden = useAfbeeldingUploaden()
  const kiezer = useRef<HTMLInputElement>(null)
  const [map, setMap] = useState<string | null>(null)
  const [naarMap, setNaarMap] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(0)

  if (isPending) return <Laden tekst="Afbeeldingen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const mappen = mappenVan(data)
  const zichtbaar = map === null ? data : data.filter((a) => (a.map?.trim() || ZONDER_MAP) === map)

  /** Op welk scherm staat deze afbeelding nu? */
  const opScherm = (url: string) =>
    (schermen ?? []).find((s) => s.actieve_afbeelding_url === url)?.naam ?? null

  async function upload(bestanden: FileList) {
    setFout(null)
    const lijst = [...bestanden]
    setBezig(lijst.length)
    for (const bestand of lijst) {
      try {
        // 'Zonder map' is een filter, geen mapnaam — daar mag niets in belanden.
        const doel = naarMap.trim() || (map && map !== ZONDER_MAP ? map : null)
        await uploaden.mutateAsync({ bestand, map: doel })
      } catch (e) {
        setFout(e instanceof Error ? e.message : 'uploaden mislukt')
      }
      setBezig((n) => n - 1)
    }
    setBezig(0)
  }

  return (
    <div className="flex flex-col gap-5">
      <Kaart className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <label htmlFor="naar-map" className="text-sm font-semibold text-muted">
            In welke map komen nieuwe beelden?
          </label>
          <input
            id="naar-map"
            list="bestaande-mappen"
            className={invoer}
            placeholder={map && map !== ZONDER_MAP ? map : 'bijv. kermis'}
            value={naarMap}
            onChange={(e) => setNaarMap(e.target.value)}
          />
          <datalist id="bestaande-mappen">
            {mappen
              .filter((m) => m !== ZONDER_MAP)
              .map((m) => (
                <option key={m} value={m} />
              ))}
          </datalist>
        </div>
        <input
          ref={kiezer}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ''
          }}
        />
        <Knop soort="primair" bezig={bezig > 0} onClick={() => kiezer.current?.click()}>
          <Upload className="size-4" aria-hidden />
          {bezig > 0 ? `Nog ${bezig} bezig…` : 'Afbeeldingen toevoegen'}
        </Knop>
      </Kaart>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMap(null)}
          className={`min-h-11 rounded-[4px] px-3 py-2 text-sm font-semibold ${
            map === null ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
          }`}
        >
          Alles ({data.length})
        </button>
        {mappen.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMap(m)}
            className={`flex min-h-11 items-center gap-1.5 rounded-[4px] px-3 py-2 text-sm font-semibold ${
              map === m ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
            }`}
          >
            <FolderOpen className="size-4" aria-hidden />
            {m} ({data.filter((a) => (a.map?.trim() || ZONDER_MAP) === m).length})
          </button>
        ))}
      </div>

      {zichtbaar.length === 0 ? (
        <Leeg
          titel="Geen afbeeldingen"
          uitleg="Voeg er hierboven een paar toe; ze komen dan in de map die je erbij zet."
        />
      ) : (
        <>
          <Kopje>
            {zichtbaar.length} {zichtbaar.length === 1 ? 'afbeelding' : 'afbeeldingen'}
          </Kopje>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {zichtbaar.map((a) => (
              <Beeld
                key={a.id}
                afbeelding={a}
                mappen={mappen}
                opScherm={opScherm(a.url)}
                meldFout={setFout}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
