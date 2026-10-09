import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { useToast } from '../components/Toast'
import { euro, useProductOpslaan, useProductWeg, useProducten, type Btw, type Product } from '../lib/verkoop'

/* De prijslijst. Prijzen zijn inclusief btw, net als op de kaart — zo ken je ze
   en zo typ je ze in. De btw haalt de app er zelf uit. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Bewerken({
  product,
  onKlaar,
  melden,
}: {
  product: Partial<Product>
  onKlaar: () => void
  melden: (t: string) => void
}) {
  const [c, setC] = useState<Partial<Product>>({ btw_tarief: 9, eenheid: 'stuk', ...product })
  const opslaan = useProductOpslaan()

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Veld label="Naam" value={c.naam ?? ''} onChange={(e) => setC({ ...c, naam: e.target.value })} />
      <Veld
        label="Omschrijving"
        value={c.omschrijving ?? ''}
        onChange={(e) => setC({ ...c, omschrijving: e.target.value })}
      />
      <div className="grid grid-cols-3 gap-2">
        <Veld
          label="Prijs incl."
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={c.prijs_incl ?? ''}
          onChange={(e) => setC({ ...c, prijs_incl: Number(e.target.value) })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Btw</span>
          <select
            className={invoer}
            value={c.btw_tarief}
            onChange={(e) => setC({ ...c, btw_tarief: Number(e.target.value) as Btw })}
          >
            <option value={9}>9%</option>
            <option value={21}>21%</option>
            <option value={0}>0%</option>
          </select>
        </label>
        <Veld
          label="Eenheid"
          value={c.eenheid ?? 'stuk'}
          onChange={(e) => setC({ ...c, eenheid: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Knop
          soort="primair"
          bezig={opslaan.isPending}
          onClick={() => {
            if (!(c.naam ?? '').trim()) return melden('Geef het product een naam.')
            if (!c.prijs_incl || c.prijs_incl <= 0) return melden('Vul een prijs in.')
            opslaan.mutate(c as Partial<Product> & { naam: string; prijs_incl: number }, {
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

export function FacturenPrijslijst() {
  const { data, isPending, error, refetch } = useProducten()
  const opslaan = useProductOpslaan()
  const weg = useProductWeg()
  const { toon, toast } = useToast()
  const [bewerkt, setBewerkt] = useState<Partial<Product> | null>(null)

  if (isPending) return <Laden tekst="Prijslijst ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const fout = (e: unknown) => toon(e instanceof Error ? e.message : 'Dat lukte niet.')

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/facturen/uitgaand"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug
      </Link>

      <div>
        <Kopje>Prijslijst</Kopje>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Prijzen inclusief btw, net als op de kaart. Wat hier staat kun je met één tik op een
          factuur zetten.
        </p>
      </div>

      {bewerkt ? (
        <Bewerken product={bewerkt} onKlaar={() => setBewerkt(null)} melden={toon} />
      ) : (
        <Knop soort="rustig" className="w-fit" onClick={() => setBewerkt({})}>
          <Plus className="size-4" aria-hidden />
          Product toevoegen
        </Knop>
      )}

      {data.length === 0 && !bewerkt && (
        <Kaart className="p-6 text-sm text-muted">
          Nog niets in de prijslijst. Je kunt ook zonder: op een factuur typ je een losse regel.
        </Kaart>
      )}

      {data.map((p) => (
        <Kaart key={p.id} className={`flex flex-col gap-2 p-4 ${p.actief ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{p.naam}</span>
            <span className="tabular-nums">
              {euro(Number(p.prijs_incl))} <span className="text-sm text-muted">/ {p.eenheid}</span>
            </span>
          </div>
          {p.omschrijving && <p className="text-sm text-muted">{p.omschrijving}</p>}
          <p className="text-sm text-muted">{p.btw_tarief}% btw</p>

          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" className="text-muted underline" onClick={() => setBewerkt(p)}>
              wijzigen
            </button>
            <button
              type="button"
              className="text-muted underline"
              onClick={() =>
                opslaan.mutate({ ...p, actief: !p.actief }, { onError: fout })
              }
            >
              {p.actief ? 'uitzetten' : 'weer aanzetten'}
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-bad underline"
              onClick={() => weg.mutate(p.id, { onError: fout })}
            >
              <Trash2 className="size-3.5" aria-hidden />
              weghalen
            </button>
          </div>
        </Kaart>
      ))}

      {toast}
    </div>
  )
}
