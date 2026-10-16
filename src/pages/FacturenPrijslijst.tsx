import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt, Pil, Veld } from '../components/ui'
import { useToast } from '../components/Toast'
import { GetalVeld } from '../components/GetalVeld'
import {
  euro,
  perGroep,
  useProductOpslaan,
  useProductWeg,
  useProducten,
  volgordeVoorGroep,
  type Btw,
  type Product,
} from '../lib/verkoop'

/* De prijslijst. Prijzen zijn inclusief btw, net als op de kaart — zo ken je ze
   en zo typ je ze in. De btw haalt de app er zelf uit.

   Eén regel per product, en de knoppen pas als je er een aantikt. Met veertien
   producten werd een kaart per stuk, met overal dezelfde drie knoppen eronder,
   tweeëneenhalf scherm scrollen door iets wat je alleen maar wil doorkijken. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Bewerken({
  product,
  alles,
  onKlaar,
  melden,
}: {
  product: Partial<Product>
  /** De hele lijst, om te weten welke groepen er al zijn en waar ze staan. */
  alles: Product[]
  onKlaar: () => void
  melden: (t: string) => void
}) {
  const [c, setC] = useState<Partial<Product>>({ btw_tarief: 9, eenheid: 'stuk', ...product })
  const opslaan = useProductOpslaan()
  const groepen = [...new Set(alles.map((p) => p.groep?.trim()).filter(Boolean))] as string[]

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Veld label="Naam" value={c.naam ?? ''} onChange={(e) => setC({ ...c, naam: e.target.value })} />
      <Veld
        label="Omschrijving"
        value={c.omschrijving ?? ''}
        onChange={(e) => setC({ ...c, omschrijving: e.target.value })}
      />
      <Veld
        label="Groep"
        list="prijslijst-groepen"
        placeholder="bijvoorbeeld Pistolets"
        value={c.groep ?? ''}
        onChange={(e) => setC({ ...c, groep: e.target.value })}
      />
      {/* Kiezen uit wat er al is, of een nieuwe typen. Een lijstje met alleen
          bestaande groepen zou je dwingen eerst ergens anders een groep aan te
          maken. */}
      <datalist id="prijslijst-groepen">
        {groepen.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="grid grid-cols-3 gap-2">
        <GetalVeld
          label="Prijs incl."
          waarde={c.prijs_incl}
          placeholder="0,00"
          onWijzig={(n) => setC({ ...c, prijs_incl: n ?? 0 })}
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
            const groep = (c.groep ?? '').trim() || null
            const klaar = { ...c, groep, volgorde: volgordeVoorGroep(alles, groep) }
            opslaan.mutate(klaar as Partial<Product> & { naam: string; prijs_incl: number }, {
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

function Regel({
  p,
  open,
  onTik,
  onWijzig,
  onAanUit,
  onWeg,
}: {
  p: Product
  open: boolean
  onTik: () => void
  onWijzig: () => void
  onAanUit: () => void
  onWeg: () => void
}) {
  return (
    <div className={`border-b border-line last:border-0 ${p.actief ? '' : 'opacity-60'}`}>
      <button
        type="button"
        onClick={onTik}
        aria-expanded={open}
        data-touch
        className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
      >
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 font-semibold">{p.naam}</span>

        {/* Negen procent is de regel; alles daarbuiten wil je zien zonder te
            hoeven openklappen. Net als "uit". */}
        {p.btw_tarief !== 9 && <Pil soort="letop">{p.btw_tarief}% btw</Pil>}
        {!p.actief && <Pil soort="neutraal">Uit</Pil>}

        <span className="shrink-0 tabular-nums">
          {euro(Number(p.prijs_incl))}
          <span className="text-sm text-muted"> / {p.eenheid}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3 pl-11">
          {p.omschrijving && <p className="text-sm text-muted">{p.omschrijving}</p>}
          <p className="text-sm text-muted">{p.btw_tarief}% btw</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" className="text-muted underline" onClick={onWijzig}>
              wijzigen
            </button>
            <button type="button" className="text-muted underline" onClick={onAanUit}>
              {p.actief ? 'uitzetten' : 'weer aanzetten'}
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-bad underline"
              onClick={onWeg}
            >
              <Trash2 className="size-3.5" aria-hidden />
              weghalen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function FacturenPrijslijst() {
  const { data, isPending, error, refetch } = useProducten()
  const opslaan = useProductOpslaan()
  const weg = useProductWeg()
  const { toon, toast } = useToast()
  const [bewerkt, setBewerkt] = useState<Partial<Product> | null>(null)
  // Eén tegelijk open: anders is de lijst na vijf tikken weer net zo lang als
  // hij was.
  const [open, setOpen] = useState<number | null>(null)

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

      <p className="max-w-prose text-sm text-muted">
        Prijzen inclusief btw, net als op de kaart. Wat hier staat kun je met één tik op een factuur
        zetten. Tik een product aan om het te wijzigen.
      </p>

      {bewerkt ? (
        <Bewerken product={bewerkt} alles={data} onKlaar={() => setBewerkt(null)} melden={toon} />
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

      {perGroep(data).map((groep) => (
        <section key={groep.groep} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-display text-lg">{groep.groep}</h2>
            <span className="text-sm text-muted">{groep.producten.length}</span>
          </div>
          <Kaart className="flex flex-col py-1">
            {groep.producten.map((p) => (
              <Regel
                key={p.id}
                p={p}
                open={open === p.id}
                onTik={() => setOpen(open === p.id ? null : p.id)}
                onWijzig={() => {
                  setBewerkt(p)
                  setOpen(null)
                }}
                onAanUit={() => opslaan.mutate({ ...p, actief: !p.actief }, { onError: fout })}
                onWeg={() => weg.mutate(p.id, { onError: fout })}
              />
            ))}
          </Kaart>
        </section>
      ))}

      {toast}
    </div>
  )
}
