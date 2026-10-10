import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Plus } from 'lucide-react'
import { Kaart, Knop, Laden, Leeg, Mislukt, Veld } from '../components/ui'
import { euro } from '../lib/inkoop'
import { useNieuweSamenstelling, useSamenstellingen } from '../lib/samenstellingen'
import type { Berekend } from '../lib/foodcost'

/* Wat kost een portie, en wat vraag je ervoor.

   De kolom die telt is foodcost: de kostprijs gedeeld door je verkoopprijs
   zonder btw. Staat die boven je doel, dan verdien je er te weinig aan — en
   dat is precies wat je wilt zien als de inkoop duurder wordt. */

function procent(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(0)}%`
}

const RIJ = 'grid grid-cols-[1fr_auto] md:grid-cols-[1fr_6rem_6rem_5rem_6rem] items-baseline gap-x-3 gap-y-1'

function Rij({ s }: { s: Berekend }) {
  const stuk = s.fouten.length > 0 || s.kostprijs === null

  return (
    <Link
      to={`/inkoop/producten/${s.id}`}
      className={`${RIJ} border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2`}
    >
      <span>
        {s.naam}
        <span className="block text-xs text-muted">
          {[s.groep, s.gebruiktIn.length > 0 && `zit in ${s.gebruiktIn.map((g) => g.naam).join(', ')}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>

      <span className="text-right tabular-nums md:order-none md:hidden">
        {s.verkoopprijs === null ? '—' : euro(s.verkoopprijs)}
      </span>

      <span className="hidden text-right tabular-nums md:block">
        {s.kostprijs === null ? <span className="text-muted">—</span> : euro(s.kostprijs)}
      </span>
      <span className="hidden text-right tabular-nums md:block">
        {s.verkoopprijs === null ? <span className="text-muted">—</span> : euro(s.verkoopprijs)}
      </span>
      <span
        className={`hidden text-right tabular-nums md:block ${s.teDuur ? 'font-semibold text-bad' : ''}`}
      >
        {procent(s.percentage)}
      </span>
      <span className="hidden text-right tabular-nums text-muted md:block">
        {s.advies === null ? '—' : euro(s.advies)}
      </span>

      <span className="col-span-full text-sm text-muted md:hidden">
        {s.kostprijs === null
          ? 'kostprijs onbekend'
          : `${euro(s.kostprijs)} kostprijs · ${procent(s.percentage)} foodcost${
              s.advies === null ? '' : ` · advies ${euro(s.advies)}`
            }`}
      </span>

      {stuk && (
        <span className="col-span-full flex items-start gap-1.5 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {s.fouten.length > 0 ? s.fouten.join('; ') : 'Nog geen ingrediënten'}
        </span>
      )}
    </Link>
  )
}

function Kop() {
  return (
    <div
      className={`${RIJ} hidden border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid`}
    >
      <span>Product</span>
      <span className="text-right">Kostprijs</span>
      <span className="text-right">Verkoop</span>
      <span className="text-right">Foodcost</span>
      <span className="text-right">Advies</span>
    </div>
  )
}

export function InkoopSamenstellingen() {
  const { alles, doelen, isPending, error, refetch } = useSamenstellingen()
  const nieuw = useNieuweSamenstelling()
  const [naam, setNaam] = useState('')
  const [groep, setGroep] = useState('')
  const [open, setOpen] = useState(false)

  if (isPending) return <Laden tekst="Kostprijzen uitrekenen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={refetch} />

  const teDuur = alles.filter((s) => s.teDuur)
  const groepen = [...new Set(alles.map((s) => s.groep).filter(Boolean))] as string[]

  async function maak() {
    if (!naam.trim()) return
    await nieuw.mutateAsync({ naam: naam.trim(), groep: groep.trim() || null })
    setNaam('')
    setGroep('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Foodcost is je kostprijs gedeeld door de verkoopprijs zonder btw. Je algemene doel staat op{' '}
        {(doelen.algemeen * 100).toFixed(0)}%; per groep en per product kan daarvan afgeweken
        worden. <strong className="font-semibold text-text">Advies</strong> is wat je zou moeten
        vragen om dat doel te halen.
      </p>

      {teDuur.length > 0 && (
        <p className="text-sm text-bad">
          {teDuur.length === 1 ? 'Eén product zit' : `${teDuur.length} producten zitten`} boven het
          doel: {teDuur.map((s) => s.naam).join(', ')}.
        </p>
      )}

      {alles.length === 0 ? (
        <Leeg
          titel="Nog geen producten"
          uitleg="Zet hier een gerecht neer met wat erin gaat, dan rekent de app uit wat een portie je kost."
          actie={<Knop onClick={() => setOpen(true)}>Eerste product maken</Knop>}
        />
      ) : (
        <Kaart className="flex flex-col py-2">
          <Kop />
          {alles.map((s) => (
            <Rij key={s.id} s={s} />
          ))}
        </Kaart>
      )}

      {open || alles.length === 0 ? (
        <Kaart className="flex flex-col gap-3 p-4">
          <p className="font-display text-lg">Nieuw product</p>
          <Veld
            label="Naam"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Classic burger"
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Groep</span>
            <input
              list="inkoop-groepen"
              value={groep}
              onChange={(e) => setGroep(e.target.value)}
              placeholder="Burgers"
              className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 outline-none focus:border-accent"
            />
            <datalist id="inkoop-groepen">
              {groepen.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <span className="text-sm text-muted">
              Bepaalt welk foodcost-doel geldt als je er geen eigen instelt.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Knop onClick={maak} bezig={nieuw.isPending} disabled={!naam.trim()}>
              Maken
            </Knop>
            {alles.length > 0 && (
              <Knop soort="rustig" onClick={() => setOpen(false)}>
                Laat maar
              </Knop>
            )}
          </div>
          {nieuw.error && <p className="text-sm text-bad">{nieuw.error.message}</p>}
        </Kaart>
      ) : (
        <div>
          <Knop soort="rustig" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Product toevoegen
          </Knop>
        </div>
      )}
    </div>
  )
}
