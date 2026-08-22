import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, UserPlus, Users } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { inArchief, naamVan, sinds, toestandVan, usePersonen, type Persoon } from '../lib/personeel'

function Regel({ p }: { p: Persoon }) {
  const toestand = toestandVan(p)
  return (
    <Link
      to={`/personeel/${p.id}`}
      data-touch
      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1 truncate font-semibold">{naamVan(p)}</span>
      <Pil soort={toestand.soort}>{toestand.label}</Pil>
      <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-muted sm:block">
        {sinds(p.aangemeld_op)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
    </Link>
  )
}

function Groep({
  titel,
  aantal,
  mensen,
  leeg,
}: {
  titel: string
  aantal: number
  mensen: Persoon[]
  leeg: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <Kopje>{titel}</Kopje>
        <span className="text-sm tabular-nums text-muted">{aantal}</span>
      </div>
      {mensen.length === 0 ? (
        <Kaart className="p-6 text-sm text-muted">{leeg}</Kaart>
      ) : (
        <Kaart>
          {mensen.map((p) => (
            <Regel key={p.id} p={p} />
          ))}
        </Kaart>
      )}
    </section>
  )
}

export function Personeel() {
  const { data, isPending, error, refetch } = usePersonen()
  const [toonArchief, setToonArchief] = useState(false)

  if (isPending) return <Laden tekst="Personeel laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />
  if (!data.length) {
    return (
      <Leeg
        titel="Nog niemand in de lijst"
        uitleg="Zodra iemand het formulier op werkenbij.snackerietzonnetje.nl invult, verschijnt die hier vanzelf als sollicitant."
      />
    )
  }

  const lopend = data.filter((p) => !inArchief(p))
  const sollicitanten = lopend.filter((p) => p.fase === 'sollicitant')
  const medewerkers = lopend.filter((p) => p.fase === 'medewerker')
  const archief = data.filter(inArchief)

  return (
    <div className="flex flex-col gap-8">
      <Groep
        titel="Sollicitanten"
        aantal={sollicitanten.length}
        mensen={sollicitanten}
        leeg="Geen openstaande sollicitaties."
      />

      <Groep
        titel="Medewerkers"
        aantal={medewerkers.length}
        mensen={medewerkers}
        leeg="Nog geen medewerkers. Neem een sollicitant aan, of voeg iemand rechtstreeks toe."
      />

      {archief.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setToonArchief((v) => !v)}
            className="flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-text"
          >
            <Users className="size-4" aria-hidden />
            Archief ({archief.length})
            <span aria-hidden>{toonArchief ? '▾' : '▸'}</span>
          </button>
          {toonArchief && (
            <Kaart>
              {archief.map((p) => (
                <Regel key={p.id} p={p} />
              ))}
            </Kaart>
          )}
        </section>
      )}

      <p className="flex items-center gap-2 text-sm text-muted">
        <UserPlus className="size-4 shrink-0" aria-hidden />
        Iemand rechtstreeks als medewerker toevoegen kan nog niet — dat komt in
        de volgende stap. De invullink zit inmiddels wel op elke medewerkerskaart.
      </p>
    </div>
  )
}
