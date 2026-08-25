import { Link } from 'react-router-dom'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { inArchief, naamVan, toestandVan, usePersonen } from '../lib/personeel'
import { Wijzigingen } from '../components/Wijzigingen'
import { Reacties } from '../components/Reacties'
import { Meldingen } from '../components/Meldingen'
import { PersoonlijkeTakenSeintje } from '../components/PersoonlijkeTakenSeintje'

export function Vandaag() {
  const { data, isPending, error, refetch } = usePersonen()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  // Alleen wat op jou wacht: rood is meteen, oranje is deze week.
  const opJou = data
    .filter((p) => !inArchief(p))
    .map((p) => ({ p, toestand: toestandVan(p) }))
    .filter(({ toestand }) => toestand.soort === 'fout' || toestand.soort === 'letop')
    .sort((a, b) => (a.toestand.soort === 'fout' ? -1 : 1) - (b.toestand.soort === 'fout' ? -1 : 1))

  return (
    <div className="flex flex-col gap-6">
      <Meldingen />

      <PersoonlijkeTakenSeintje />

      <Wijzigingen />

      <Reacties />

      <section className="flex flex-col gap-3">
        <Kopje>Wat er op jou wacht</Kopje>
        {opJou.length === 0 ? (
          <Kaart className="p-6">
            <p className="font-display text-lg">Niets dat op jou wacht.</p>
            <p className="mt-1 text-sm text-muted">
              Alles in de personeelslijst ligt bij iemand anders.
            </p>
          </Kaart>
        ) : (
          <Kaart>
            {opJou.map(({ p, toestand }) => (
              <Link
                key={p.id}
                to={`/personeel/${p.id}`}
                data-touch
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{naamVan(p)}</span>
                <Pil soort={toestand.soort}>{toestand.label}</Pil>
              </Link>
            ))}
          </Kaart>
        )}
      </section>

      <Link
        to="/personeel"
        data-touch
        className="inline-flex w-fit items-center rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
      >
        Naar de hele lijst
      </Link>
    </div>
  )
}
