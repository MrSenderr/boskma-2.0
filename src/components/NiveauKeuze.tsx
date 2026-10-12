import { NIVEAU, NIVEAUS, useNiveauZetten, type Geschiktheid } from '../lib/spits'

/* Hoe goed iemand op een werkplek staat, in één keuzelijstje.
 *
 * Een lijstje en geen knop die rondgaat: van "onbekend" naar "nooit" zou dat
 * vier tikken zijn, en bij veertien mensen maal zes plekken tik je je dood. */

const KLEUR: Record<Geschiktheid, string> = {
  liefst: 'border-good text-good',
  kan: 'border-line-strong text-text',
  nood: 'border-warn text-warn',
  nooit: 'border-bad text-bad',
  onbekend: 'border-line text-muted',
}

export function NiveauKeuze({
  medewerkerId,
  werkplekId,
  waarde,
  naam,
}: {
  medewerkerId: string
  werkplekId: string
  waarde: Geschiktheid
  /** Voor de voorlezer: zonder dit zegt hij alleen "liefst". */
  naam: string
}) {
  const zetten = useNiveauZetten()

  return (
    <select
      aria-label={naam}
      value={waarde}
      disabled={zetten.isPending}
      onChange={(e) =>
        zetten.mutate({
          medewerker_id: medewerkerId,
          werkplek_id: werkplekId,
          niveau: e.target.value as Geschiktheid,
        })
      }
      className={`w-full rounded-[4px] border-[1.5px] bg-bg px-2 py-1.5 text-sm font-semibold outline-none transition-colors focus:border-accent disabled:opacity-50 ${KLEUR[waarde]}`}
    >
      {NIVEAUS.map((n) => (
        <option key={n} value={n}>
          {NIVEAU[n].label}
        </option>
      ))}
    </select>
  )
}
