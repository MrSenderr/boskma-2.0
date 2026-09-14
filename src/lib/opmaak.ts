/* Opmaak van datums en getallen voor de schermen.
 *
 * Staat los omdat zowel de weerreeks als de apparatuur het nodig heeft, en een
 * koeling niets met het weer te maken heeft. */

/** Hoeveel dagen geleden is deze datum? 0 = vandaag. */
export function dagenGeleden(datum: string): number {
  const toen = new Date(`${datum}T00:00:00`)
  const nu = new Date()
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate())
  return Math.round((vandaag.getTime() - toen.getTime()) / 86_400_000)
}

/** "gisteren" leest prettiger dan "13 september" zolang het kortgeleden is. */
export function dagnaam(datum: string): string {
  const d = dagenGeleden(datum)
  if (d === 0) return 'vandaag'
  if (d === 1) return 'gisteren'
  if (d === 2) return 'eergisteren'
  return new Date(`${datum}T00:00:00`).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Nederlandse notatie met eenheid. Een ontbrekende waarde wordt een streepje,
 *  zodat een kolom cijfers uitgelijnd blijft. */
export function getal(waarde: number | null | undefined, eenheid: string, decimalen = 1): string {
  if (waarde === null || waarde === undefined) return '—'
  return `${waarde.toLocaleString('nl-NL', {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  })} ${eenheid}`
}
