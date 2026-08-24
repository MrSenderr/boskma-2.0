import { Kopje } from './ui'
import { coupureNaam, euro, type Aantallen, type Coupure, type Soort } from '../lib/kas'

/* Aantallen per munt en biljet invullen. Eén component voor het tellen, het
   wisselgeld, de beginstand, een storting en het natellen — dan werkt het
   overal hetzelfde en kan het maar op één plek fout gaan.

   Twee kolommen, want tien rijen onder elkaar is op een telefoon twee schermen
   scrollen terwijl je met je handen in het geld zit. En geen subtotaal per
   coupure: dat is ruis. Wat je wél wilt zien is de splitsing munten/briefgeld,
   en die staat onderaan. Zie docs/Modules/kas.md. */

export function CoupureInvoer({
  coupures,
  aantallen,
  zet,
  soort,
  beschikbaar,
  totaalLabel,
}: {
  coupures: Coupure[]
  aantallen: Aantallen
  zet: (a: Aantallen) => void
  /** Alleen munten of alleen biljetten tonen; leeg is allebei. */
  soort?: Soort
  /** Hoeveel er van elke coupure ligt; meer invullen kan dan niet. */
  beschikbaar?: Record<number, number>
  /** Zonder label geen totaalregel — dan maakt het scherm zijn eigen. */
  totaalLabel?: string
}) {
  const zichtbaar = coupures.filter((c) => !soort || c.soort === soort)
  const groepen: { soort: Soort; naam: string }[] = soort
    ? [{ soort, naam: soort === 'munt' ? 'Munten' : 'Biljetten' }]
    : [
        { soort: 'munt', naam: 'Munten' },
        { soort: 'biljet', naam: 'Biljetten' },
      ]

  const waarde = (s?: Soort) =>
    zichtbaar
      .filter((c) => !s || c.soort === s)
      .reduce((n, c) => n + (aantallen[c.waarde_cent] ?? 0) * c.waarde_cent, 0)

  return (
    <div className="flex flex-col gap-3">
      {groepen.map((g) => {
        const inGroep = zichtbaar.filter((c) => c.soort === g.soort)
        if (inGroep.length === 0) return null
        return (
          <div key={g.soort} className="flex flex-col gap-1.5">
            {groepen.length > 1 && <Kopje>{g.naam}</Kopje>}
            <div className="grid grid-cols-2 gap-1.5">
              {inGroep.map((c) => {
                const aantal = aantallen[c.waarde_cent] ?? 0
                const max = beschikbaar?.[c.waarde_cent]
                const teveel = max !== undefined && aantal > max
                return (
                  <label
                    key={c.waarde_cent}
                    className={`flex items-center gap-2 rounded-card border-[1.5px] bg-surface pl-3 pr-1 focus-within:border-accent ${
                      teveel ? 'border-bad' : 'border-line-strong'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{coupureNaam(c.waarde_cent)}</span>
                      {max !== undefined && (
                        <span className={`block text-xs ${teveel ? 'font-semibold text-bad' : 'text-muted'}`}>
                          {teveel ? `er zijn er ${max}` : `van ${max}`}
                        </span>
                      )}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Aantal van ${coupureNaam(c.waarde_cent)}`}
                      className="w-16 shrink-0 border-0 bg-transparent px-2 py-3 text-right text-lg font-bold tabular-nums outline-none"
                      value={aantal || ''}
                      onChange={(e) => {
                        const n = e.target.value.replace(/\D/g, '')
                        zet({ ...aantallen, [c.waarde_cent]: n === '' ? 0 : Number(n) })
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {totaalLabel && (
        <div className="rounded-card border-[1.5px] border-line-strong bg-surface p-3">
          {groepen.length > 1 && (
            <p className="mb-1 flex flex-wrap justify-between gap-x-4 text-sm text-muted">
              <span>Munten {euro(waarde('munt'))}</span>
              <span>Briefgeld {euro(waarde('biljet'))}</span>
            </p>
          )}
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted">{totaalLabel}</span>
            <span className="font-display text-2xl tabular-nums">{euro(waarde())}</span>
          </p>
        </div>
      )}
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
