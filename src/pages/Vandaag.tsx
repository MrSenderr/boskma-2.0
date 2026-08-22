import { Link } from 'react-router-dom'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { useSollicitaties, watErNuMoet } from './Personeel'

export function Vandaag() {
  const { data, isPending, error, refetch } = useSollicitaties()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const openstaand = data
    .filter((s) => s.status !== 'afgewezen')
    .map((s) => ({ s, actie: watErNuMoet(s) }))
    .filter(({ actie }) => actie.soort === 'fout' || actie.soort === 'goed')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Kopje>Wat er vandaag op jou wacht</Kopje>
        {openstaand.length === 0 ? (
          <Kaart className="p-6">
            <p className="font-display text-lg">Niets dat op jou wacht.</p>
            <p className="mt-1 text-sm text-muted">
              Alles in de personeelsrij ligt bij iemand anders.
            </p>
          </Kaart>
        ) : (
          <div className="flex flex-col gap-2">
            {openstaand.map(({ s, actie }) => (
              <Kaart key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-semibold">
                  {[s.voornaam, s.achternaam].filter(Boolean).join(' ') || 'Naamloos'}
                </span>
                <Pil soort={actie.soort}>{actie.tekst}</Pil>
              </Kaart>
            ))}
          </div>
        )}
      </section>

      <Link
        to="/personeel"
        data-touch
        className="inline-flex w-fit items-center rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
      >
        Naar de hele rij
      </Link>
    </div>
  )
}
