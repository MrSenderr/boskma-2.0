import { useState } from 'react'
import { ArrowDown, Droplet } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { korteDatum, toonNaam } from '../lib/personeel'
import {
  AANTAL_PANNEN,
  laatsteDoorschuif,
  standVanDePannen,
  useDoorschuiven,
  useDoorschuiven_bewaren,
} from '../lib/frituurvet'

/* Het frituurvet. Eén knop: doorgeschoven. De rest rekent de app uit. Zie
   docs/Modules/haccp/haccpmodule.md. */

export function Frituurvet() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data, isPending, error, refetch } = useDoorschuiven()
  const bewaar = useDoorschuiven_bewaren()
  const [bevestigen, setBevestigen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Frituurvet laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const pannen = standVanDePannen(data)
  const laatste = laatsteDoorschuif(data)
  const oudste = pannen[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Kopje>Frituurvet</Kopje>
        <p className="mt-1 text-sm text-muted">
          {laatste
            ? `Laatst doorgeschoven op ${korteDatum(laatste.gedaan_op)}${
                laatste.door_naam ? ` door ${toonNaam(laatste.door_naam)}` : ''
              }.`
            : 'Er is nog niet doorgeschoven. Vanaf de eerste keer rekent de app de rest uit.'}
        </p>
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <section className="flex flex-col gap-2">
        {pannen
          .slice()
          .reverse()
          .map((p) => (
            <Kaart
              key={p.nummer}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 p-4 ${
                p.nummer === 1 ? 'border-line-strong' : ''
              }`}
            >
              <Droplet className="size-5 shrink-0 text-muted" aria-hidden />
              <span className="font-display text-lg">Pan {p.nummer}</span>
              {p.nummer === AANTAL_PANNEN && <Pil soort="goed">Verse olie</Pil>}
              {p.nummer === 1 && <Pil soort="letop">Gaat er als volgende uit</Pil>}
              <span className="ml-auto text-sm text-muted">
                {p.dagen === null ? (
                  'nog niet vastgelegd'
                ) : (
                  <>
                    draait <span className="font-bold tabular-nums text-text">{p.dagen}</span>{' '}
                    {p.dagen === 1 ? 'dag' : 'dagen'} mee
                  </>
                )}
              </span>
            </Kaart>
          ))}
      </section>

      {oudste?.dagen !== null && oudste !== undefined && (
        <p className="rounded-[4px] bg-surface-2 px-3 py-2 text-sm">
          De olie die er als volgende uit gaat, draait{' '}
          <span className="font-bold tabular-nums">{oudste.dagen}</span> dagen mee.
        </p>
      )}

      <section className="flex flex-col gap-3">
        {bevestigen ? (
          <Kaart className="flex flex-col gap-3 border-line-strong p-4">
            <p className="font-semibold">Alles een plek opschuiven?</p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li className="flex items-center gap-2">
                <ArrowDown className="size-4 shrink-0" aria-hidden />
                Pan 1 gaat naar de afgewerktvetbak
              </li>
              {Array.from({ length: AANTAL_PANNEN - 1 }, (_, i) => (
                <li key={i} className="flex items-center gap-2">
                  <ArrowDown className="size-4 shrink-0" aria-hidden />
                  Pan {i + 2} gaat naar pan {i + 1}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <ArrowDown className="size-4 shrink-0" aria-hidden />
                Pan {AANTAL_PANNEN} wordt gevuld met verse olie
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Knop
                soort="primair"
                bezig={bewaar.isPending}
                onClick={() =>
                  bewaar.mutate(
                    {
                      medewerkerId: wie?.medewerker_id ?? null,
                      doorNaam: wie?.naam || email || 'onbekend',
                    },
                    {
                      onSuccess: () => setBevestigen(false),
                      onError: (e) => setFout(e.message),
                    },
                  )
                }
              >
                Ja, doorgeschoven
              </Knop>
              <Knop soort="rustig" onClick={() => setBevestigen(false)}>
                Annuleren
              </Knop>
            </div>
          </Kaart>
        ) : (
          <Knop soort="primair" onClick={() => setBevestigen(true)} className="min-h-14">
            Doorgeschoven
          </Knop>
        )}
        <p className="text-sm text-muted">
          Eén tik legt het hele systeem vast: wanneer, en door wie. Verder hoef je
          niets in te vullen.
        </p>
      </section>

      {data.length > 0 && (
        <section className="flex flex-col gap-3">
          <Kopje>Eerder doorgeschoven</Kopje>
          <Kaart>
            {data.slice(0, 10).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 last:border-b-0 text-sm"
              >
                <span className="font-medium">{korteDatum(d.gedaan_op)}</span>
                <span className="text-muted">{toonNaam(d.door_naam)}</span>
              </div>
            ))}
          </Kaart>
        </section>
      )}
    </div>
  )
}
