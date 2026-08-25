import { useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { korteDatum, naamVan } from '../lib/personeel'
import { useAlleTaken } from '../lib/vandaag'

/* De taken die Sander aan iemand persoonlijk gaf, over iedereen heen. Op de
   pagina van één medewerker staat hetzelfde, maar dan moet je per persoon
   kijken. */

const PERIODES = [
  { waarde: 30, label: '30 dagen' },
  { waarde: 90, label: '3 maanden' },
  { waarde: 365, label: 'Een jaar' },
]

export function LogboekPersoonlijk() {
  const [dagen, setDagen] = useState(30)
  const [alleenOpen, setAlleenOpen] = useState(false)
  const { data, isPending, error, refetch } = useAlleTaken(dagen)

  if (isPending) return <Laden tekst="Taken laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const vandaag = new Date().toLocaleDateString('sv-SE')
  const zichtbaar = alleenOpen ? data.filter((t) => !t.gedaan_op) : data
  const openstaand = data.filter((t) => !t.gedaan_op).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <button
            key={p.waarde}
            type="button"
            onClick={() => setDagen(p.waarde)}
            className={`min-h-11 rounded-[4px] px-4 py-2.5 text-sm font-semibold transition-colors ${
              dagen === p.waarde ? 'bg-brand text-on-brand' : 'border border-line-strong hover:bg-surface-2'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Kaart className="flex-1 px-4 py-3">
          <p className="text-sm text-muted">Gegeven</p>
          <p className="font-display text-2xl tabular-nums">{data.length}</p>
        </Kaart>
        <Kaart className={`flex-1 px-4 py-3 ${openstaand > 0 ? 'border-warn' : ''}`}>
          <p className="text-sm text-muted">Nog open</p>
          <p className={`font-display text-2xl tabular-nums ${openstaand > 0 ? 'text-warn' : ''}`}>
            {openstaand}
          </p>
        </Kaart>
      </div>

      {openstaand > 0 && (
        <button
          type="button"
          onClick={() => setAlleenOpen((v) => !v)}
          className={`flex min-h-11 w-fit items-center gap-2 rounded-[4px] px-4 py-2.5 text-sm font-semibold ${
            alleenOpen ? 'bg-warn text-[#00272C]' : 'border border-line-strong hover:bg-surface-2'
          }`}
        >
          {alleenOpen ? 'Toon alles' : 'Alleen wat openstaat'}
        </button>
      )}

      {zichtbaar.length === 0 ? (
        <Leeg
          titel="Geen taken"
          uitleg="Zodra je iemand een losse klus geeft, staat hij hier — met of hij hem heeft afgevinkt."
        />
      ) : (
        <>
          <Kopje>
            {zichtbaar.length} {zichtbaar.length === 1 ? 'taak' : 'taken'}
          </Kopje>
          <Kaart>
            {zichtbaar.map((t) => {
              const gedaan = Boolean(t.gedaan_op)
              const laat = !gedaan && t.datum < vandaag
              return (
                <div
                  key={t.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 ${
                    laat ? 'bg-warn-soft' : ''
                  }`}
                >
                  {gedaan ? (
                    <Check className="size-4 shrink-0 text-good" aria-hidden />
                  ) : (
                    <Clock className={`size-4 shrink-0 ${laat ? 'text-warn' : 'text-muted'}`} aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block ${gedaan ? 'text-muted line-through' : 'font-medium'}`}>
                      {t.tekst}
                    </span>
                    <span className="block text-sm text-muted">
                      {naamVan({
                        voornaam: t.sollicitaties?.voornaam ?? null,
                        achternaam: t.sollicitaties?.achternaam ?? null,
                      } as Parameters<typeof naamVan>[0])}
                      {t.toelichting ? ` · ${t.toelichting}` : ''}
                    </span>
                  </span>
                  {gedaan ? (
                    <span className="text-sm text-muted">afgevinkt {korteDatum(t.gedaan_op)}</span>
                  ) : laat ? (
                    <Pil soort="letop">was voor {korteDatum(t.datum)}</Pil>
                  ) : (
                    <span className="text-sm text-muted">voor {korteDatum(t.datum)}</span>
                  )}
                </div>
              )
            })}
          </Kaart>
        </>
      )}
    </div>
  )
}
