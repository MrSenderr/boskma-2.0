import { Kaart } from './ui'
import { coupureNaam, euro, type Aantallen, type Coupure, type Soort } from '../lib/kas'

/* Aantallen per munt en biljet invullen. Eén component voor de beginstand, een
   storting, het wisselen en het natellen — dan werkt het overal hetzelfde en kan
   het maar op één plek fout gaan. Zie docs/Modules/kas.md. */

const invoer =
  'w-24 shrink-0 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-right text-lg font-bold tabular-nums outline-none focus:border-accent'

export function CoupureInvoer({
  coupures,
  aantallen,
  zet,
  soort,
  beschikbaar,
  totaalLabel = 'Totaal',
}: {
  coupures: Coupure[]
  aantallen: Aantallen
  zet: (a: Aantallen) => void
  /** Alleen munten of alleen biljetten tonen; leeg is allebei. */
  soort?: Soort
  /** Hoeveel er van elke coupure ligt; meer invullen kan dan niet. */
  beschikbaar?: Record<number, number>
  totaalLabel?: string
}) {
  const zichtbaar = coupures.filter((c) => !soort || c.soort === soort)
  const totaal = zichtbaar.reduce((n, c) => n + (aantallen[c.waarde_cent] ?? 0) * c.waarde_cent, 0)

  return (
    <div className="flex flex-col gap-2">
      <Kaart>
        {zichtbaar.map((c) => {
          const aantal = aantallen[c.waarde_cent] ?? 0
          const max = beschikbaar?.[c.waarde_cent]
          const teveel = max !== undefined && aantal > max
          return (
            <div
              key={c.waarde_cent}
              className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <span className="w-20 shrink-0 font-display text-lg">{coupureNaam(c.waarde_cent)}</span>
              <input
                type="text"
                inputMode="numeric"
                className={`${invoer} ${teveel ? 'border-bad' : ''}`}
                aria-label={`Aantal van ${coupureNaam(c.waarde_cent)}`}
                value={aantal || ''}
                onChange={(e) => {
                  const n = e.target.value.replace(/\D/g, '')
                  zet({ ...aantallen, [c.waarde_cent]: n === '' ? 0 : Number(n) })
                }}
              />
              <span className="min-w-0 flex-1 text-right text-sm tabular-nums text-muted">
                {max !== undefined && (
                  <span className={teveel ? 'font-semibold text-bad' : ''}>
                    {teveel ? `er zijn er maar ${max}` : `${max} in de kluis`}
                  </span>
                )}
                {max === undefined && aantal > 0 && euro(aantal * c.waarde_cent)}
              </span>
            </div>
          )
        })}
      </Kaart>

      <p className="flex items-baseline justify-between gap-3 px-1">
        <span className="text-sm text-muted">{totaalLabel}</span>
        <span className="font-display text-2xl tabular-nums">{euro(totaal)}</span>
      </p>
    </div>
  )
}

/** Wat de aantallen samen waard zijn. */
export function waardeVan(coupures: Coupure[], aantallen: Aantallen, soort?: Soort) {
  return coupures
    .filter((c) => !soort || c.soort === soort)
    .reduce((n, c) => n + (aantallen[c.waarde_cent] ?? 0) * c.waarde_cent, 0)
}

/** Meer invullen dan er ligt kan niet. */
export function pastHet(aantallen: Aantallen, beschikbaar: Record<number, number>) {
  return Object.entries(aantallen).every(([w, n]) => n <= (beschikbaar[Number(w)] ?? 0))
}
