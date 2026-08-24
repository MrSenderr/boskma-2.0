import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Flame, Timer as TimerIcoon } from 'lucide-react'
import { Kaart, Laden, Mislukt } from '../components/ui'
import { useTimers } from '../lib/timers'
import {
  kleurKlasse,
  useCategorieen,
  useStappen,
  useWerkkaarten,
  weergaveVan,
  type Stap,
} from '../lib/werkkaarten'

/* Eén gerecht, om tijdens de service in één blik te lezen. Zie
   docs/Modules/werkkaarten.md. */

function Tijdknop({ stap, kaartnaam }: { stap: Stap; kaartnaam: string }) {
  const { start } = useTimers()
  if (!stap.minuten) return null
  return (
    <button
      type="button"
      onClick={() => start(`${kaartnaam} — ${stap.tekst}`, stap.minuten!)}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[4px] bg-accent px-3 py-2 text-sm font-bold text-white hover:opacity-90"
    >
      <TimerIcoon className="size-4" aria-hidden />
      {stap.minuten} min
    </button>
  )
}

function Bereiding({
  regels,
  minuten,
  label,
  kaartnaam,
}: {
  regels: string[]
  minuten?: number | null
  label?: string | null
  kaartnaam: string
}) {
  const { start } = useTimers()
  if (regels.length === 0 && !minuten) return null

  return (
    <Kaart className="border-accent bg-accent-soft p-4">
      <p className="flex items-center gap-2 font-display text-base">
        <Flame className="size-4 shrink-0 text-accent" aria-hidden />
        Bereiding
      </p>
      <div className="mt-2 flex flex-col gap-1 text-sm">
        {regels.map((regel, i) => (regel ? <p key={i}>{regel}</p> : <span key={i} className="h-2" />))}
      </div>
      {minuten ? (
        <button
          type="button"
          onClick={() => start(`${kaartnaam} — ${label ?? 'in de oven'}`, minuten)}
          className="mt-3 flex min-h-11 w-fit items-center gap-2 rounded-[4px] bg-accent px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          <TimerIcoon className="size-4" aria-hidden />
          {label ?? 'Timer'} — {minuten} min
        </button>
      ) : null}
    </Kaart>
  )
}

export function Werkkaart() {
  const { id } = useParams()
  const kaartId = Number(id)
  const { data: kaarten, isPending, error, refetch } = useWerkkaarten()
  const { data: categorieen } = useCategorieen()
  const { data: stappen } = useStappen(kaartId)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const kaart = (kaarten ?? []).find((k) => k.id === kaartId)
  if (!kaart) return <Mislukt tekst="Dit gerecht bestaat niet (meer)." />

  const cat = (categorieen ?? []).find((c) => c.id === kaart.categorie_id)
  const weergave = weergaveVan(kaart, cat)
  const lijst = stappen ?? []

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={`/werkkaarten/${kaart.categorie_id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {cat?.naam ?? 'Terug'}
      </Link>

      <h2 className="font-display text-2xl">{kaart.naam}</h2>

      {/* Het gedeelde stuk en de eigen toevoeging lezen als één lijstje. Zo staat
          er bij een classic niets over een cheeseburger, terwijl een wijziging
          aan de uien nog steeds maar op één plek hoeft. */}
      <Bereiding
        regels={[
          ...(kaart.gebruikt_gedeelde && cat?.gedeelde_bereiding
            ? cat.gedeelde_bereiding.split('\n')
            : []),
          ...(kaart.eigen_bereiding ? kaart.eigen_bereiding.split('\n') : []),
        ]}
        minuten={kaart.bereiding_minuten ?? (kaart.gebruikt_gedeelde ? cat?.bereiding_minuten : null)}
        label={kaart.bereiding_label ?? (kaart.gebruikt_gedeelde ? cat?.bereiding_label : null)}
        kaartnaam={kaart.naam}
      />

      {weergave === 'stapel' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">Van onder naar boven opbouwen.</p>
          <div className="flex flex-col-reverse gap-1.5">
            {lijst.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand tabular-nums">
                  {s.volgorde}
                </span>
                <span
                  className={`flex-1 rounded-full px-4 py-3 text-center font-semibold ${kleurKlasse(s.kleur)}`}
                >
                  {s.tekst}
                </span>
                <Tijdknop stap={s} kaartnaam={kaart.naam} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <Kaart>
          {lijst.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 ${
                s.apparaat ? 'bg-accent-soft' : ''
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                  s.apparaat ? 'bg-accent text-white' : 'bg-brand text-on-brand'
                }`}
              >
                {s.volgorde}
              </span>
              <span className={`min-w-0 flex-1 ${s.apparaat ? 'font-semibold text-accent' : ''}`}>
                {s.tekst}
              </span>
              <Tijdknop stap={s} kaartnaam={kaart.naam} />
            </div>
          ))}
        </Kaart>
      )}

      {lijst.length === 0 && (
        <Kaart className="p-4">
          <p className="text-sm text-muted">Voor dit gerecht staan nog geen stappen ingevuld.</p>
        </Kaart>
      )}
    </div>
  )
}
