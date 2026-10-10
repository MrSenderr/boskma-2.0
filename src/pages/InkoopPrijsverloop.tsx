import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Kaart, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { aantalTekst, dagEnDatum, euro, getal, volledigeDatum } from '../lib/inkoop'
import { GRAFIEK, grafiek, normalePrijs, usePrijsverloop, type Meting } from '../lib/prijzen'

/* Het prijsverloop van één artikel: elke keer dat je het kocht, met de prijs
   die je toen betaalde.

   De gestippelde lijn is de gewone prijs. Een actiepunt hangt daar met een
   streepje aan vast, zodat je in één oogopslag ziet hoeveel korting je die
   keer kreeg — en hoe ver de prijs terugspringt als de actie afloopt.

   Acties zijn herkenbaar aan hun vórm, niet aan een kleur: in de lichte stand
   zijn --warn en --accent precies dezelfde kleur, dus daar zou het verschil
   wegvallen. Een actieprijs is een dichte stip, een gewone prijs een open. */

function Lijn({ metingen, gewoon }: { metingen: Meting[]; gewoon: number | null }) {
  const g = grafiek(metingen, gewoon)
  const { breedte: B, hoogte: H, rand: P } = GRAFIEK

  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="block h-auto w-full" role="img"
      aria-label={`Prijsverloop van ${euro(g.laagste)} tot ${euro(g.hoogste)} over ${metingen.length} leveringen`}>
      {g.normaalY !== null && (
        <>
          <line
            x1={P} y1={g.normaalY} x2={B - P} y2={g.normaalY}
            stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4"
          />
          {g.punten.map((p) =>
            p.meting.actie ? (
              <line
                key={`actie-${p.meting.id}`}
                x1={p.x} y1={p.y} x2={p.x} y2={g.normaalY ?? p.y}
                stroke="var(--muted)" strokeWidth={1} opacity={0.5}
              />
            ) : null,
          )}
        </>
      )}

      <path d={g.lijn} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {g.punten.map((p) => (
        <circle
          key={p.meting.id}
          cx={p.x} cy={p.y} r={p.meting.actie ? 5 : 3.5}
          fill={p.meting.actie ? 'var(--accent)' : 'var(--surface)'}
          stroke="var(--accent)"
          strokeWidth={2}
        >
          <title>
            {dagEnDatum(p.meting.factuurdatum)} · {euro(p.meting.prijs)}
            {p.meting.actie ? ' · actieprijs' : ''}
          </title>
        </circle>
      ))}

      <text x={P} y={14} fontSize={11} fill="var(--muted)">{euro(g.hoogste)}</text>
      <text x={P} y={H - 6} fontSize={11} fill="var(--muted)">{euro(g.laagste)}</text>
    </svg>
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

export function InkoopPrijsverloop() {
  const { levId, artikelnr } = useParams()
  const { data: metingen, isPending, error, refetch } = usePrijsverloop(
    Number(levId),
    artikelnr ?? '',
  )

  if (isPending) return <Laden tekst="Prijzen ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (!metingen || metingen.length === 0) {
    return (
      <Leeg
        titel="Dit artikel is niet gekocht"
        uitleg="Er staat geen enkele factuurregel voor dit artikelnummer."
        actie={
          <Link to="/inkoop/prijzen" className="text-sm font-semibold underline">
            Terug naar de prijsmutaties
          </Link>
        }
      />
    )
  }

  const laatste = metingen[metingen.length - 1]
  const prijzen = metingen.map((m) => getal(m.prijs))
  const eerste = prijzen[0]
  const nu = prijzen[prijzen.length - 1]
  const gewoon = normalePrijs(metingen)
  const verschil = nu - eerste
  const totaalAantal = metingen.reduce((s, m) => s + getal(m.aantal), 0)
  const totaalBedrag = metingen.reduce((s, m) => s + getal(m.bedrag), 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/inkoop/prijzen"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Alle prijsmutaties
        </Link>

        <h2 className="mt-2 font-display text-xl">{laatste.artikelnaam}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>
            {[laatste.merk, laatste.artikelinhoud, `artikelnummer ${laatste.artikelnr}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {!laatste.op_bestellijst && <Pil soort="letop">staat niet op je bestellijst</Pil>}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cijfer waarde={euro(nu)} bij={laatste.actie ? 'prijs nu — met korting' : 'prijs nu'} />
        <Cijfer
          waarde={`${verschil > 0 ? '+' : ''}${euro(verschil)}`}
          bij={`sinds ${dagEnDatum(metingen[0].factuurdatum)}`}
          kleur={verschil > 0 ? 'text-bad' : verschil < 0 ? 'text-good' : undefined}
        />
        {gewoon === null ? (
          <Cijfer waarde={`${euro(Math.min(...prijzen))} – ${euro(Math.max(...prijzen))}`} bij="laagst en hoogst betaald" />
        ) : (
          <Cijfer waarde={euro(gewoon)} bij="gewone prijs, buiten acties om" />
        )}
      </div>

      <Kaart className="px-1 py-3">
        <Lijn metingen={metingen} gewoon={gewoon} />
        {/* Het bijschrift hoort buiten de tekening: in de grafiek botste het
            met het laatste punt, precies de prijs waar je naar kijkt. */}
        <p className="flex flex-wrap gap-x-4 gap-y-1 px-3 pt-2 text-sm text-muted">
          {gewoon !== null && <span>- - - gewone prijs {euro(gewoon)}</span>}
          {metingen.some((m) => m.actie) && <span>● actieprijs</span>}
        </p>
      </Kaart>

      <Kaart className="flex flex-col py-2">
        <div className="grid grid-cols-[1fr_4rem_5rem_5rem] items-baseline gap-x-3 border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Factuur</span>
          <span className="text-right">Aantal</span>
          <span className="text-right">Prijs</span>
          <span className="text-right">Bedrag</span>
        </div>

        {metingen.map((m) => (
          <div
            key={m.id}
            className="grid grid-cols-[1fr_4rem_5rem_5rem] items-baseline gap-x-3 border-b border-line px-4 py-2 last:border-0"
          >
            <span>
              {dagEnDatum(m.factuurdatum)}
              <span className="block text-xs text-muted">
                {m.factuurnummer}
                {m.actie && <span className="font-semibold text-warn"> · actieprijs</span>}
              </span>
            </span>
            <span className="text-right tabular-nums text-muted">{aantalTekst(m.aantal)}</span>
            <span className="text-right tabular-nums">{euro(m.prijs)}</span>
            <span className="text-right tabular-nums text-muted">{euro(m.bedrag)}</span>
          </div>
        ))}

        <p className="px-4 pt-2 text-sm text-muted">
          {aantalTekst(totaalAantal)}× afgenomen in {metingen.length} leveringen, samen{' '}
          {euro(totaalBedrag)} — van {volledigeDatum(metingen[0].factuurdatum)} tot{' '}
          {volledigeDatum(laatste.factuurdatum)}.
        </p>
      </Kaart>
    </div>
  )
}
