import { useState } from 'react'
import { Check } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { useRooster, vandaagStr, volgendeOpendag } from '../lib/openingstijden'
import {
  ZONDER_GROEP,
  groepenVan,
  useMepAanpassen,
  useMepAanzetten,
  useMepAfzetten,
  useMepDag,
  useMepNotitie,
  useMepNotitieZetten,
  useMepTaken,
  type MepDagTaak,
  type MepTaak,
} from '../lib/mep'

/* Wat er de volgende opendag klaargemaakt moet worden. Zie docs/Modules/mep.md.

   De dag waar dit over gaat is niet "morgen" maar de eerstvolgende dag dat de
   zaak open is. Op zondagavond is dat dinsdag, en dat staat er groot bij — daar
   gaat het anders mis. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2 text-base outline-none focus:border-accent'

function Regel({
  taak,
  aan,
  datum,
  doorNaam,
  meldFout,
}: {
  taak: MepTaak
  aan: MepDagTaak | undefined
  datum: string
  doorNaam: string
  meldFout: (f: string) => void
}) {
  const aanzetten = useMepAanzetten()
  const afzetten = useMepAfzetten()
  const aanpassen = useMepAanpassen()

  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <button
        type="button"
        // Tijdens het aan- of afzetten niet nog eens: anders vuurt een tweede
        // tik voordat de lijst is bijgewerkt.
        disabled={aanzetten.isPending || afzetten.isPending}
        onClick={() =>
          aan
            ? afzetten.mutate(aan.id, { onError: (e) => meldFout(e.message) })
            : aanzetten.mutate({ datum, taak, doorNaam }, { onError: (e) => meldFout(e.message) })
        }
        className="flex w-full items-start gap-3 text-left disabled:opacity-60"
      >
        <span
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
            aan ? 'border-brand bg-brand text-on-brand' : 'border-line-strong'
          }`}
          aria-hidden
        >
          {aan && <Check className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={aan ? 'font-semibold' : ''}>{taak.naam}</span>
          {taak.toelichting && (
            <span className="block text-sm text-muted">{taak.toelichting}</span>
          )}
        </span>
      </button>

      {aan && (
        <div className="mt-2 flex flex-wrap gap-2 pl-9">
          <input
            className={`${invoer} w-24 shrink-0`}
            placeholder="hoeveel"
            aria-label={`Hoeveel ${taak.naam}`}
            defaultValue={aan.hoeveelheid ?? ''}
            onBlur={(e) =>
              e.target.value !== (aan.hoeveelheid ?? '') &&
              aanpassen.mutate(
                { id: aan.id, hoeveelheid: e.target.value },
                { onError: (x) => meldFout(x.message) },
              )
            }
          />
          <input
            className={`${invoer} min-w-[10rem] flex-1`}
            placeholder="bijzonderheden (mag leeg)"
            aria-label={`Bijzonderheden bij ${taak.naam}`}
            defaultValue={aan.notitie ?? ''}
            onBlur={(e) =>
              e.target.value !== (aan.notitie ?? '') &&
              aanpassen.mutate(
                { id: aan.id, notitie: e.target.value },
                { onError: (x) => meldFout(x.message) },
              )
            }
          />
        </div>
      )}
    </div>
  )
}

export function MepKlaarzetten() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data: rooster } = useRooster()
  const datum = volgendeOpendag(rooster, vandaagStr())

  const { data: taken, isPending, error, refetch } = useMepTaken()
  const { data: dag } = useMepDag(datum)
  const { data: notitie } = useMepNotitie(datum)
  const notitieZetten = useMepNotitieZetten()
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Lijst laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const doorNaam = wie?.naam || email || 'onbekend'
  const groepen = groepenVan(taken)
  const aangezet = dag ?? []
  const lang = new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-xl capitalize">{lang}</p>
        <p className="mt-1 text-sm text-muted">
          Vink aan wat er die dag klaargemaakt moet worden. Zet erbij hoeveel, en
          wat er bijzonder aan is.
        </p>
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {groepen.map((groep) => {
        const inGroep = taken.filter((t) => (t.groep?.trim() || ZONDER_GROEP) === groep)
        if (inGroep.length === 0) return null
        return (
          <section key={groep} className="flex flex-col gap-2">
            <Kopje>{groep}</Kopje>
            <Kaart>
              {inGroep.map((t) => (
                <Regel
                  key={t.id}
                  taak={t}
                  aan={aangezet.find((a) => a.sjabloon_id === t.id)}
                  datum={datum}
                  doorNaam={doorNaam}
                  meldFout={setFout}
                />
              ))}
            </Kaart>
          </section>
        )
      })}

      <section className="flex flex-col gap-2">
        <Kopje>Extra opmerkingen</Kopje>
        <Kaart className="p-3">
          <textarea
            rows={3}
            className={invoer}
            placeholder="Iets dat voor de hele dag geldt"
            aria-label="Extra opmerkingen"
            defaultValue={notitie ?? ''}
            key={notitie}
            onBlur={(e) =>
              e.target.value !== (notitie ?? '') &&
              notitieZetten.mutate(
                { datum, tekst: e.target.value, doorNaam },
                { onError: (x) => setFout(x.message) },
              )
            }
          />
        </Kaart>
      </section>

      <p className="max-w-prose text-sm text-muted">
        Alles wordt bewaard zodra je uit een veld klikt — er is geen knop om te
        vergeten. Morgenvroeg staat deze lijst onder Vandaag.
      </p>
      <Knop soort="rustig" className="w-fit" onClick={() => refetch()}>
        Lijst verversen
      </Knop>
    </div>
  )
}
