import { Link } from 'react-router-dom'
import { Kaart, Laden, Leeg, Mislukt } from '../components/ui'
import { euro, getal } from '../lib/inkoop'
import { procent, usePrijsmutaties, verdeel, type Prijsmutatie } from '../lib/prijzen'
import { Breed } from '../lib/breedte'

/* Wat duurder werd en wat goedkoper werd, naast elkaar.

   Op volgorde van wat het je kost, niet van percentage: een artikel dat 40%
   duurder wordt maar dat je zelden koopt staat lager dan frites die een
   dubbeltje stijgen.

   De twee lijsten stonden onder elkaar, met een brede tabel per regel:
   leverancier, eerst, nu, procent, hoe vaak gekocht, en wat het kost. Naast
   elkaar is de halve breedte, en daar passen die zeven kolommen niet in. Dus
   twee regels per artikel in plaats van zeven kolommen — dezelfde cijfers,
   alleen achter elkaar gelezen in plaats van onder elkaar. Wat je met één blik
   wilt zien staat rechts en vet: wat het je kost. */

function Rij({ m, toonLeverancier }: { m: Prijsmutatie; toonLeverancier: boolean }) {
  const op = getal(m.impact) > 0
  const pct = procent(m)
  const kleur = op ? 'text-bad' : 'text-good'

  return (
    <Link
      to={`/inkoop/prijzen/${m.leverancier_id}/${encodeURIComponent(m.artikelnr)}`}
      className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2"
    >
      {/* Niet afkappen: een naam die je moet raden kun je net zo goed
          weglaten. Liever een regel die omloopt. */}
      <span className="min-w-0 font-medium">{m.omschrijving}</span>
      <span className={`text-right font-semibold tabular-nums ${kleur}`}>
        {op ? '+' : ''}
        {euro(m.impact)}
      </span>

      {/* Van wie je het koopt en hoe vaak. Allebei veranderen ze wat een
          stijging betekent: dezelfde vijftig cent is iets anders bij één keer
          per jaar dan bij elke week. */}
      <span className="col-span-2 min-w-0 text-sm text-muted sm:col-span-1">
        {[m.merk, toonLeverancier ? m.leveranciernaam : null, `${m.keer_gekocht}× gekocht`]
          .filter(Boolean)
          .join(' · ')}
      </span>

      {/* Of een van beide prijzen een actieprijs was hoort erbij, want dat
          verandert de betekenis volledig: dan heeft de leverancier niets
          verhoogd en is de actie gewoon afgelopen. */}
      <span className="col-span-2 text-sm tabular-nums text-muted sm:col-span-1 sm:text-right">
        {euro(m.eerste)}
        {m.eerste_was_actie && ' (actie)'} → {euro(m.laatste)}
        {m.laatste_was_actie && ' (actie)'}{' '}
        <span className={kleur}>
          {pct > 0 ? '+' : ''}
          {pct.toFixed(0)}%
        </span>
      </span>
    </Link>
  )
}

function Kolom({
  titel,
  mutaties,
  uitleg,
  toonLeverancier,
}: {
  titel: string
  mutaties: Prijsmutatie[]
  uitleg: string
  toonLeverancier: boolean
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg">{titel}</h2>
        <span className="text-sm text-muted">{mutaties.length} artikelen</span>
      </div>
      <Kaart className="flex flex-col py-2">
        {mutaties.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Niets.</p>
        ) : (
          mutaties.map((m) => (
            <Rij
              key={`${m.leverancier_id}-${m.artikelnr}`}
              m={m}
              toonLeverancier={toonLeverancier}
            />
          ))
        )}
        <p className="border-t border-line px-4 pt-2 text-sm text-muted">{uitleg}</p>
      </Kaart>
    </section>
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

  if (mutaties.length === 0) {
    return (
      <Leeg
        titel="Nog geen prijswijzigingen"
        uitleg="Hier komt te staan wat duurder en goedkoper werd, zodra een artikel twee keer op een factuur heeft gestaan."
      />
    )
  }

  const { omhoog, omlaag, saldo } = verdeel(mutaties)
  const toonLeverancier = new Set(mutaties.map((m) => m.leverancier_id)).size > 1

  return (
    <div className="flex flex-col gap-6">
      <Breed />
      <div className="grid gap-3 sm:grid-cols-3">
        <Cijfer waarde={String(omhoog.length)} bij="duurder geworden" kleur="text-bad" />
        <Cijfer waarde={String(omlaag.length)} bij="goedkoper geworden" kleur="text-good" />
        <Cijfer
          waarde={`${saldo > 0 ? '+' : ''}${euro(saldo)}`}
          bij="saldo over de hele periode"
          kleur={saldo > 0 ? 'text-bad' : 'text-good'}
        />
      </div>

      {/* items-start, anders rekt de kortste kolom mee met de langste en staat
          er onderaan een halve kaart leeg. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Kolom
          titel="Duurder geworden"
          mutaties={omhoog}
          uitleg="Op volgorde van wat het je kost: prijsverschil maal afgenomen aantal."
          toonLeverancier={toonLeverancier}
        />
        <Kolom
          titel="Goedkoper geworden"
          mutaties={omlaag}
          uitleg="Vaak acties die net liepen. Let op: als die aflopen gaat de prijs weer omhoog — dat is de stijging die je niet ziet aankomen."
          toonLeverancier={toonLeverancier}
        />
      </div>
    </div>
  )
}
