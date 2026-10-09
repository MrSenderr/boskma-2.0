import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { useToast } from '../components/Toast'
import { useKlantOpslaan, useKlanten, type Klant } from '../lib/verkoop'

/* Je klanten. Alleen naam en factuuradres zijn verplicht; de rest vul je aan
   wanneer je het weet. Zonder adres kan de factuur niet aan de factuureisen
   voldoen, dus dat staat erbij als het ontbreekt. */

const VELDEN: { sleutel: keyof Klant; label: string; type?: string }[] = [
  { sleutel: 'naam', label: 'Naam' },
  { sleutel: 'contactpersoon', label: 'Contactpersoon' },
  { sleutel: 'factuur_email', label: 'Factuur-e-mail', type: 'email' },
  { sleutel: 'cc_email', label: 'Kopie naar', type: 'email' },
  { sleutel: 'adres', label: 'Adres' },
  { sleutel: 'postcode', label: 'Postcode' },
  { sleutel: 'plaats', label: 'Plaats' },
  { sleutel: 'kvk', label: 'KvK' },
  { sleutel: 'btw_nummer', label: 'Btw-nummer' },
]

function Bewerken({
  klant,
  onKlaar,
  melden,
}: {
  klant: Partial<Klant>
  onKlaar: () => void
  melden: (t: string) => void
}) {
  const [concept, setConcept] = useState<Partial<Klant>>(klant)
  const opslaan = useKlantOpslaan()

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {VELDEN.map(({ sleutel, label, type }) => (
          <Veld
            key={sleutel}
            label={label}
            type={type ?? 'text'}
            value={(concept[sleutel] as string) ?? ''}
            onChange={(e) => setConcept({ ...concept, [sleutel]: e.target.value })}
          />
        ))}
        <Veld
          label="Betaaltermijn in dagen"
          type="number"
          min="1"
          value={concept.betaaltermijn_dagen ?? 14}
          onChange={(e) => setConcept({ ...concept, betaaltermijn_dagen: Number(e.target.value) })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Knop
          soort="primair"
          bezig={opslaan.isPending}
          onClick={() => {
            if (!(concept.naam ?? '').trim()) return melden('Een klant heeft in elk geval een naam nodig.')
            if (!(concept.factuur_email ?? '').trim())
              return melden('Zonder factuuradres kun je hem niets sturen.')
            opslaan.mutate(concept as Partial<Klant> & { naam: string }, {
              onSuccess: onKlaar,
              onError: (e) => melden(e instanceof Error ? e.message : 'Opslaan lukte niet.'),
            })
          }}
        >
          Bewaren
        </Knop>
        <Knop soort="rustig" onClick={onKlaar}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}

export function FacturenKlanten() {
  const { data, isPending, error, refetch } = useKlanten()
  const { toon, toast } = useToast()
  const [bewerkt, setBewerkt] = useState<Partial<Klant> | null>(null)

  if (isPending) return <Laden tekst="Klanten ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/facturen/uitgaand"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug
      </Link>

      <Kopje>Klanten</Kopje>

      {bewerkt ? (
        <Bewerken klant={bewerkt} onKlaar={() => setBewerkt(null)} melden={toon} />
      ) : (
        <Knop soort="rustig" className="w-fit" onClick={() => setBewerkt({ betaaltermijn_dagen: 14 })}>
          <Plus className="size-4" aria-hidden />
          Klant toevoegen
        </Knop>
      )}

      {data.map((k) => (
        <Kaart key={k.id} className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{k.naam}</span>
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => setBewerkt(k)}
            >
              wijzigen
            </button>
          </div>
          <p className="text-sm text-muted">
            {k.factuur_email ?? 'geen factuuradres'}
            {k.contactpersoon && ` · ${k.contactpersoon}`}
            {` · betaaltermijn ${k.betaaltermijn_dagen} dagen`}
          </p>
          {!k.adres && (
            <p className="text-sm text-warn">
              Geen adres. Dat moet wettelijk op de factuur staan.
            </p>
          )}
        </Kaart>
      ))}

      {toast}
    </div>
  )
}
