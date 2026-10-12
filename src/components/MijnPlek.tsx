import { Kaart, Kopje } from './ui'
import { dagnaam, datumKort } from '../lib/rooster'
import { SPITS, stoelnaam, stoelenVan, useMijnPlekken, useWerkplekken } from '../lib/spits'

/* Waar je de komende avonden staat.
 *
 * Alleen je eigen plek. De database laat niet meer los — zie het beleid
 * eigen_plek — net als bij de shifts: je ziet je eigen rooster, niet dat van
 * de rest.
 *
 * Staat er niets, dan staat er ook niets op het scherm. Een kaart met "nog
 * niet ingedeeld" zou elke dag in de weg staan voor iets wat meestal pas een
 * dag van tevoren bekend is. */

function vandaagStr() {
  return new Date().toLocaleDateString('sv-SE')
}

export function MijnPlek() {
  const mijne = useMijnPlekken(vandaagStr())
  const plekken = useWerkplekken()

  if (!mijne.data?.length || !plekken.data) return null

  const stoelen = stoelenVan(plekken.data)
  const regels = mijne.data
    .map((r) => ({
      datum: r.datum,
      stoel: stoelen.find((s) => s.werkplek.id === r.werkplek_id && s.plek === r.plek),
    }))
    .filter((r) => r.stoel)
    .slice(0, 3)

  if (regels.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Waar je staat</Kopje>
      <Kaart className="flex flex-col py-2">
        {regels.map((r) => (
          <div
            key={r.datum}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-0"
          >
            <span className="text-sm text-muted">
              {dagnaam(r.datum, true)} {datumKort(r.datum)}, {SPITS.van}–{SPITS.tot}
            </span>
            <span className="font-display text-lg">{stoelnaam(r.stoel!)}</span>
          </div>
        ))}
      </Kaart>
    </section>
  )
}
