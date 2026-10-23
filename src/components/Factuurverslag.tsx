import { Kaart, Kopje, Pil } from './ui'
import { dagEnDatum, euro, fijnEuro } from '../lib/inkoop'
import {
  SOORTNAAM,
  SOORTUITLEG,
  perSoort,
  prijseffect,
  useFactuurverslag,
  type Bevinding,
  type Soort,
} from '../lib/factuurverslag'

/* Wat opvalt aan deze factuur.
 *
 * Staat bovenaan, boven de regels: tachtig regels doorlezen doet niemand, en
 * wat ertussen zit dat geld kost wil je zien zonder te zoeken.
 *
 * Valt er niets op, dan staat hier niets. Een kaart met "geen bijzonderheden"
 * zou elke week in de weg staan. */

const KLEUR: Record<Soort, 'goed' | 'letop' | 'fout' | 'neutraal'> = {
  duurder: 'fout',
  goedkoper: 'goed',
  actie_afgelopen: 'neutraal',
  nu_op_actie: 'goed',
  nieuw: 'neutraal',
  gemist: 'letop',
}

function Regel({ b }: { b: Bevinding }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-line px-4 py-2.5 last:border-0">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{b.naam}</span>
        {b.effect !== null && b.effect !== 0 && (
          <span className="tabular-nums">
            {b.effect > 0 ? '+' : '−'} {euro(Math.abs(b.effect))}
          </span>
        )}
        {b.soort === 'nieuw' && b.prijs !== null && (
          <span className="tabular-nums text-muted">{fijnEuro(b.prijs)}</span>
        )}
      </span>

      {b.vorigePrijs !== null && b.prijs !== null && (
        <span className="text-sm text-muted tabular-nums">
          {fijnEuro(b.vorigePrijs)} → {fijnEuro(b.prijs)}
          {b.procent !== null && (
            <>
              {' '}
              ({b.procent > 0 ? '+' : ''}
              {b.procent.toLocaleString('nl-NL')}%)
            </>
          )}
        </span>
      )}

      {b.soort === 'gemist' && (
        <span className="text-sm text-muted">
          Stond op {b.keerEerder} van de vorige {b.vanFacturen} facturen, laatst{' '}
          {dagEnDatum(b.laatstOp)}.
        </span>
      )}
    </li>
  )
}

export function Factuurverslag({
  documentId,
  leverancierId,
  datum,
}: {
  documentId: number
  leverancierId: number
  datum: string | null
}) {
  const { data } = useFactuurverslag(documentId, leverancierId, datum)
  if (!data || data.bevindingen.length === 0) return null

  const effect = prijseffect(data)

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Wat opvalt</Kopje>

      {effect !== 0 && (
        <p className="text-sm text-muted">
          Door prijsverschillen valt deze factuur{' '}
          <strong className="font-semibold text-text">{euro(Math.abs(effect))}</strong>{' '}
          {effect > 0 ? 'hoger' : 'lager'} uit dan met de prijzen van de vorige keer. Acties tellen
          daar niet in mee.
        </p>
      )}

      {perSoort(data).map((groep) => (
        <Kaart key={groep.soort} className="flex flex-col py-2">
          <div className="flex flex-col gap-0.5 px-4 pb-2 pt-1">
            <span className="flex flex-wrap items-center gap-2">
              <Pil soort={KLEUR[groep.soort]}>{SOORTNAAM[groep.soort]}</Pil>
              <span className="text-sm text-muted">{groep.bevindingen.length}</span>
            </span>
            <span className="text-sm text-muted">{SOORTUITLEG[groep.soort]}</span>
          </div>
          <ul className="flex flex-col border-t border-line">
            {groep.bevindingen.map((b) => (
              <Regel key={`${groep.soort}-${b.artikelnr}`} b={b} />
            ))}
          </ul>
        </Kaart>
      ))}
    </section>
  )
}
