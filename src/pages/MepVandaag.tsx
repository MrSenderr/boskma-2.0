import { useState } from 'react'
import { BookOpen, Check, ChefHat, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Kaart, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { korteDatum, toonNaam } from '../lib/personeel'
import { vandaagStr } from '../lib/openingstijden'
import { isBlijvenLiggen, useMepAftikken, useMepNotitie, useMepTaken, useMepVandaag } from '../lib/mep'

/* Waar de keuken vandaag mee werkt. Zie docs/Modules/mep.md. */

export function MepVandaag() {
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data, isPending, error, refetch } = useMepVandaag()
  const { data: notitie } = useMepNotitie(vandaagStr())
  const { data: taken } = useMepTaken(true)
  const aftikken = useMepAftikken()
  const [fout, setFout] = useState<string | null>(null)

  if (isPending) return <Laden tekst="Voorbereiding laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (data.length === 0) {
    return (
      <Leeg
        titel="Niets voorbereiden vandaag"
        uitleg="Er is gisteravond niets aangevinkt. Onder het tabblad hiernaast zet je klaar wat er de volgende dag moet gebeuren."
      />
    )
  }

  const open = data.filter((t) => !t.gedaan).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl">
          {data.length - open} van {data.length} gedaan
        </p>
        {open === 0 && <Pil soort="goed">Alles klaar</Pil>}
      </div>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {notitie && (
        <Kaart className="flex items-start gap-2 p-4">
          <ChefHat className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p className="whitespace-pre-wrap text-sm">{notitie}</p>
        </Kaart>
      )}

      <Kaart>
        {data.map((t) => {
          const laat = isBlijvenLiggen(t)
          const recept = (taken ?? []).find((x) => x.id === t.sjabloon_id)?.recept_id ?? null
          return (
            <div key={t.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() =>
                aftikken.mutate(
                  {
                    id: t.id,
                    gedaan: !t.gedaan,
                    medewerkerId: wie?.medewerker_id,
                    doorNaam: wie?.naam ?? email ?? 'onbekend',
                  },
                  { onError: (e) => setFout(e.message) },
                )
              }
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                  t.gedaan ? 'border-good bg-good text-white' : 'border-line-strong'
                }`}
                aria-hidden
              >
                {t.gedaan && <Check className="size-4" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={t.gedaan ? 'text-muted line-through' : 'font-medium'}>
                    {t.naam}
                  </span>
                  {t.hoeveelheid && !t.gedaan && (
                    <span className="rounded-[4px] bg-surface-2 px-2 py-0.5 text-sm font-bold">
                      {t.hoeveelheid}
                    </span>
                  )}
                  {laat && (
                    <Pil soort="letop">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        van {korteDatum(t.datum)}
                      </span>
                    </Pil>
                  )}
                </span>
                {t.notitie && !t.gedaan && (
                  <span className="mt-0.5 block text-sm text-muted">{t.notitie}</span>
                )}
                {t.gedaan && t.gedaan_door_naam && (
                  <span className="mt-0.5 block text-sm text-muted">
                    door {toonNaam(t.gedaan_door_naam)}
                  </span>
                )}
              </span>
            </button>

            {recept && !t.gedaan && (
              <Link
                to={`/recepten/${recept}`}
                data-touch
                className="mb-2 ml-12 inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong px-3 py-2 text-sm font-semibold hover:bg-surface-2"
              >
                <BookOpen className="size-4" aria-hidden />
                Recept
              </Link>
            )}
            </div>
          )
        })}
      </Kaart>

      <p className="max-w-prose text-sm text-muted">
        Wat je niet afkrijgt blijft staan en komt morgen terug, met de datum erbij.
        Er verdwijnt dus niets omdat de dag om is.
      </p>
    </div>
  )
}
