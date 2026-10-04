import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, UserPlus, Users } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil, Veld } from '../components/ui'
import {
  inArchief,
  naamVan,
  sinds,
  toestandVan,
  usePersonen,
  usePersoonToevoegen,
  type Fase,
  type Persoon,
} from '../lib/personeel'

/* Iemand met de hand toevoegen: voor wie niet via werkenbij binnenkomt maar
   bijvoorbeeld gewoon aan de deur staat. Zie
   docs/modules/personeel/personeelsmodule.md. */
function Toevoegen({ sluit }: { sluit: () => void }) {
  const navigeer = useNavigate()
  const toevoegen = usePersoonToevoegen()
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email, setEmail] = useState('')
  const [fase, setFase] = useState<Fase>('medewerker')
  const [fout, setFout] = useState<string | null>(null)

  async function bewaren(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    if (!voornaam.trim() || !achternaam.trim()) {
      setFout('Vul een voor- en achternaam in.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setFout('Vul een geldig mailadres in. Daarmee logt hij later in.')
      return
    }
    try {
      const id = await toevoegen.mutateAsync({ voornaam, achternaam, email, fase })
      navigeer(`/personeel/${id}`)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Toevoegen lukte niet.')
    }
  }

  const keuze = (waarde: Fase, label: string, uitleg: string) => (
    <button
      key={waarde}
      type="button"
      onClick={() => setFase(waarde)}
      aria-pressed={fase === waarde}
      className={`flex-1 rounded-[4px] border-[1.5px] px-3 py-2.5 text-left transition-colors ${
        fase === waarde ? 'border-accent bg-surface-2' : 'border-line-strong hover:bg-surface-2'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-sm text-muted">{uitleg}</span>
    </button>
  )

  return (
    <Kaart className="p-5">
      <form onSubmit={bewaren} className="flex flex-col gap-4">
        <Kopje>Iemand toevoegen</Kopje>

        <div className="grid gap-4 sm:grid-cols-2">
          <Veld
            label="Voornaam"
            value={voornaam}
            autoFocus
            onChange={(e) => setVoornaam(e.target.value)}
          />
          <Veld
            label="Achternaam"
            value={achternaam}
            onChange={(e) => setAchternaam(e.target.value)}
          />
        </div>

        <Veld
          label="Mailadres"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Waar zet ik hem neer?</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            {keuze('medewerker', 'Medewerker', 'Aangenomen, invullink moet nog weg')}
            {keuze('sollicitant', 'Sollicitant', 'Eerst nog een gesprek')}
          </div>
        </div>

        {fout && <p className="text-sm text-bad">{fout}</p>}

        <p className="text-sm text-muted">
          Meer hoef je niet te weten. De rest — adres, rekeningnummer, BSN — vult
          hij zelf in via de invullink, die je hierna op zijn kaart verstuurt.
        </p>

        <div className="flex flex-wrap gap-2">
          <Knop soort="primair" type="submit" bezig={toevoegen.isPending}>
            Toevoegen
          </Knop>
          <Knop soort="rustig" type="button" onClick={sluit}>
            Annuleren
          </Knop>
        </div>
      </form>
    </Kaart>
  )
}

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
  const [toevoegen, setToevoegen] = useState(false)

  if (isPending) return <Laden tekst="Personeel laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const lopend = data.filter((p) => !inArchief(p))
  const sollicitanten = lopend.filter((p) => p.fase === 'sollicitant')
  const medewerkers = lopend.filter((p) => p.fase === 'medewerker')
  const archief = data.filter(inArchief)

  return (
    <div className="flex flex-col gap-8">
      {toevoegen ? (
        <Toevoegen sluit={() => setToevoegen(false)} />
      ) : (
        <div>
          <Knop soort="rustig" onClick={() => setToevoegen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Iemand toevoegen
          </Knop>
        </div>
      )}

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
        leeg="Nog geen medewerkers. Neem een sollicitant aan, of voeg iemand toe."
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
    </div>
  )
}
