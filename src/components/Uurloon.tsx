import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Veld } from './ui'
import { caoUurloon, euro, onderCao } from '../lib/cao'
import { vandaagIso } from '../lib/datums'

/* Het uurloon invullen, met de cao ernaast.
 *
 * Het bedrag staat er al in zodra de app de geboortedatum kent. Dat scheelt
 * opzoeken, maar het belangrijkste is dat de verkeerde trede niet meer per
 * ongeluk blijft staan: het jeugdloon springt op een verjaardag, en een
 * contract dat volgende maand ingaat hoort het bedrag van dán te krijgen.
 *
 * Het veld volgt de cao zolang jij er niet aan hebt gezeten. Verzet je de
 * ingangsdatum over een verjaardag heen, dan verspringt het bedrag mee. Tik je
 * zelf iets in, dan houdt het op met volgen — dan is het jouw keuze, en die
 * hoort de app niet te overschrijven. Een bestaand contract telt als een keuze
 * die al gemaakt is en wordt dus nooit overschreven.
 *
 * Te laag mag, maar niet ongemerkt. Boven de cao betalen doet Boskma bij
 * iedereen boven de achttien; eronder is een melding en geen slot, want er
 * zijn gevallen waarin afwijken terecht is. */

/* Uit de database komt een bedrag als tekst terug ("5.2500"), uit het veld als
   getal. Allebei moeten ze hier binnen kunnen. */
function getal(w: number | string | null | undefined): number | null {
  if (w === null || w === undefined || w === '') return null
  const n = Number(w)
  return Number.isFinite(n) ? n : null
}

export function Uurloonveld({
  label = 'Uurloon bruto',
  waarde,
  onVeranderd,
  geboortedatum,
  opDatum,
  onKlaar,
}: {
  label?: string
  waarde: number | string | null | undefined
  onVeranderd: (bedrag: number | null) => void
  geboortedatum: string | null | undefined
  /** De dag waarop het loon ingaat. Leeg betekent vandaag. */
  opDatum?: string | null
  /* Als het bewaren niet bij elke toetsaanslag hoort te gebeuren maar pas als
     je het veld verlaat — zoals op de kaart van de medewerker, waar elke
     wijziging meteen de database in gaat. */
  onKlaar?: (bedrag: number | null) => void
}) {
  const dag = opDatum || vandaagIso()
  const bedrag = getal(waarde)
  const cao = caoUurloon(geboortedatum, dag)
  const telaag = onderCao(bedrag, geboortedatum, dag)

  /* Een bedrag dat er al stond is een keuze die al gemaakt is. Alleen een leeg
     veld laat zich vullen. */
  const aangeraakt = useRef(bedrag !== null)

  useEffect(() => {
    if (aangeraakt.current || !cao) return
    onVeranderd(cao.bedrag)
    // onVeranderd verandert elke render; het bedrag is wat ertoe doet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cao?.bedrag])

  return (
    <div className="flex flex-col gap-1.5">
      <Veld
        label={label}
        type="number"
        step="0.01"
        inputMode="decimal"
        value={bedrag === null ? '' : String(bedrag)}
        onChange={(e) => {
          aangeraakt.current = true
          onVeranderd(e.target.value === '' ? null : Number(e.target.value))
        }}
        onBlur={onKlaar ? () => onKlaar(bedrag) : undefined}
      />
      {telaag ? (
        <p className="flex items-start gap-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Onder de cao. Bij {telaag.leeftijd} jaar hoort {euro(telaag.bedrag)} per uur.
          </span>
        </p>
      ) : (
        cao && (
          <p className="text-sm text-muted">
            Cao bij {cao.leeftijd} jaar: {euro(cao.bedrag)} per uur.
          </p>
        )
      )}
    </div>
  )
}
