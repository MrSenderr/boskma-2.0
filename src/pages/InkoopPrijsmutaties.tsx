import { Link } from 'react-router-dom'
import { Kaart, Laden, Leeg, Mislukt } from '../components/ui'
import { euro, getal } from '../lib/inkoop'
import { procent, usePrijsmutaties, verdeel, type Prijsmutatie } from '../lib/prijzen'

/* Welke artikelen duurder werden, op volgorde van wat het je kost.

   Niet op percentage: een artikel dat 40% duurder wordt maar dat je zelden
   koopt staat lager dan frites die een dubbeltje stijgen. */

const RIJ = 'grid grid-cols-[1fr_auto] md:grid-cols-[1fr_6rem_6rem_4rem_7rem] items-baseline gap-x-3 gap-y-1'

function Actie() {
  return (
    <span className="rounded-[3px] bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn">
      actieprijs
    </span>
  )
}

function Rij({ m }: { m: Prijsmutatie }) {
  const op = getal(m.impact) > 0
  const pct = procent(m)
  const kleur = op ? 'text-bad' : 'text-good'

  return (
    <Link
      to={`/inkoop/prijzen/${m.leverancier_id}/${encodeURIComponent(m.artikelnr)}`}
      className={`${RIJ} border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2`}
    >
      <span>
        {m.omschrijving}
        <span className="block text-xs text-muted">
          {[m.merk, m.artikelnr].filter(Boolean).join(' · ')}
        </span>
      </span>

      <span className={`text-right font-semibold tabular-nums md:order-last ${kleur}`}>
        {op ? '+' : ''}
        {euro(m.impact)}
      </span>

      <span className="hidden text-right tabular-nums text-muted md:block">
        {euro(m.eerste)}
        {m.eerste_was_actie && (
          <span className="block">
            <Actie />
          </span>
        )}
      </span>

      <span className="hidden text-right tabular-nums md:block">
        {euro(m.laatste)}
        {m.laatste_was_actie && (
          <span className="block">
            <Actie />
            {m.normale_prijs && (
              <span className="block text-xs text-muted">gewoon {euro(m.normale_prijs)}</span>
            )}
          </span>
        )}
      </span>

      <span className={`hidden text-right tabular-nums md:block ${kleur}`}>
        {pct > 0 ? '+' : ''}
        {pct.toFixed(0)}%
      </span>

      {/* Op de telefoon is er geen ruimte voor kolommen, dus hier het verhaal
          in één regel: van wat naar wat, en hoe vaak je het kocht.

          Of een van die twee prijzen een actieprijs was staat erbij, want dat
          verandert de betekenis volledig: dan heeft de leverancier niets
          verhoogd en is de actie gewoon afgelopen. */}
      <span className="col-span-full text-sm text-muted md:hidden">
        {euro(m.eerste)}
        {m.eerste_was_actie && ' (actie)'} → {euro(m.laatste)}
        {m.laatste_was_actie && ' (actie)'} ({pct > 0 ? '+' : ''}
        {pct.toFixed(0)}%) · {m.keer_gekocht}× gekocht
      </span>
    </Link>
  )
}

function Kop() {
  return (
    <div
      className={`${RIJ} hidden border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid`}
    >
      <span>Artikel</span>
      <span className="text-right">Eerst</span>
      <span className="text-right">Nu</span>
      <span className="text-right">Verschil</span>
      <span className="text-right">Kost je</span>
    </div>
  )
}

function Cijfer({ waarde, bij, kleur }: { waarde: string; bij: string; kleur?: string }) {
  return (
    <Kaart className="p-4">
      <p className={`font-display text-2xl tabular-nums ${kleur ?? ''}`}>{waarde}</p>
      <p className="mt-1 text-sm text-muted">{bij}</p>
    </Kaart>
  )
}

export function InkoopPrijsmutaties() {
  const { data: mutaties, isPending, error, refetch } = usePrijsmutaties()

  if (isPending) return <Laden tekst="Prijzen vergelijken…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const { omhoog, omlaag, saldo } = verdeel(mutaties)

  if (mutaties.length === 0) {
    return (
      <Leeg
        titel="Nog geen prijswijzigingen"
        uitleg="Hier komt te staan wat duurder en goedkoper werd, zodra een artikel twee keer op een factuur heeft gestaan."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cijfer waarde={String(omhoog.length)} bij="duurder geworden" kleur="text-bad" />
        <Cijfer waarde={String(omlaag.length)} bij="goedkoper geworden" kleur="text-good" />
        <Cijfer
          waarde={`${saldo > 0 ? '+' : ''}${euro(saldo)}`}
          bij="saldo over de hele periode"
          kleur={saldo > 0 ? 'text-bad' : 'text-good'}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Duurder geworden</h2>
        <Kaart className="flex flex-col py-2">
          <Kop />
          {omhoog.map((m) => (
            <Rij key={`${m.leverancier_id}-${m.artikelnr}`} m={m} />
          ))}
          <p className="border-t border-line px-4 pt-2 text-sm text-muted">
            Op volgorde van wat het je kost: prijsverschil maal afgenomen aantal. Een artikel dat
            40% duurder wordt maar dat je zelden koopt staat dus lager dan frites die een dubbeltje
            stijgen.
          </p>
        </Kaart>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Goedkoper geworden</h2>
        <Kaart className="flex flex-col py-2">
          <Kop />
          {omlaag.map((m) => (
            <Rij key={`${m.leverancier_id}-${m.artikelnr}`} m={m} />
          ))}
          <p className="border-t border-line px-4 pt-2 text-sm text-muted">
            Vaak acties die net liepen. Let op: als die aflopen gaat de prijs weer omhoog — dat is
            de stijging die je niet ziet aankomen.
          </p>
        </Kaart>
      </section>
    </div>
  )
}
