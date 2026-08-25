import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import { korteDatum, naamVan } from '../lib/personeel'
import { useAfgevinkteTaken, useTaakGezien, useTakenOverDatum, type TaakVanIemand } from '../lib/vandaag'

/* Wat er met de taken gebeurt die jij hebt uitgedeeld. Zonder dit kwam een
   afgevinkte taak nergens terug behalve onderaan de pagina van die ene persoon. */

function wie(t: TaakVanIemand) {
  return naamVan({
    voornaam: t.sollicitaties?.voornaam ?? null,
    achternaam: t.sollicitaties?.achternaam ?? null,
  } as Parameters<typeof naamVan>[0])
}

export function PersoonlijkeTakenSeintje() {
  const { data: gedaan } = useAfgevinkteTaken()
  const { data: blijftLiggen } = useTakenOverDatum()
  const gezien = useTaakGezien()
  const [fout, setFout] = useState<string | null>(null)

  const af = gedaan ?? []
  const laat = blijftLiggen ?? []
  if (af.length === 0 && laat.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Taken die je gaf</Kopje>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {laat.length > 0 && (
        <Kaart className="border-warn">
          {laat.map((t) => (
            <Link
              key={t.id}
              to={`/personeel/${t.medewerker_id}`}
              data-touch
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <Clock className="size-4 shrink-0 text-warn" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.tekst}</span>
                <span className="block text-sm text-muted">{wie(t)}</span>
              </span>
              <Pil soort="letop">was voor {korteDatum(t.datum)}</Pil>
            </Link>
          ))}
        </Kaart>
      )}

      {af.map((t) => (
        <Kaart key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
          <Check className="size-4 shrink-0 text-good" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t.tekst}</span>
            <span className="block text-sm text-muted">
              {wie(t)} · afgevinkt {korteDatum(t.gedaan_op)}
            </span>
          </span>
          <Knop
            soort="primair"
            bezig={gezien.isPending}
            onClick={() => gezien.mutate(t.id, { onError: (e) => setFout(e.message) })}
          >
            Gezien
          </Knop>
        </Kaart>
      ))}
    </section>
  )
}
