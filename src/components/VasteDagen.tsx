import { Kaart, Kopje, Pil } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import { DAGEN, VOORKEUR, useVasteDagen, type Voorkeur } from '../lib/vasteDagen'

/* Wat de medewerker zelf heeft opgegeven op /vastedagen. Alleen lezen: de
   medewerker past het aan door het formulier opnieuw in te vullen. */

function Rij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  )
}

function Keuze({ waarde, voor }: { waarde: Voorkeur | null; voor?: string }) {
  if (!waarde) return <span className="text-sm text-muted">—</span>
  const k = VOORKEUR[waarde]
  return (
    <Pil soort={k.soort}>
      {voor ? `${voor}: ${k.label.toLowerCase()}` : k.label}
    </Pil>
  )
}

function Tekst({ label, waarde }: { label: string; waarde: string | null }) {
  if (!waarde) return null
  return (
    <Kaart className="p-4">
      <p className="mb-1 text-sm text-muted">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{waarde}</p>
    </Kaart>
  )
}

export function VasteDagen({ persoon }: { persoon: Persoon }) {
  const { data: v, isPending, error } = useVasteDagen(persoon.id)

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Voorkeur vaste dagen</Kopje>

      {isPending ? (
        <Kaart className="p-4">
          <p className="text-sm text-muted">Bezig met laden…</p>
        </Kaart>
      ) : error ? (
        <Kaart className="p-4">
          <p className="text-sm text-bad">Kon de voorkeur niet laden: {error.message}</p>
        </Kaart>
      ) : !v ? (
        <Kaart className="p-4">
          <p className="text-sm text-muted">Nog niet ingevuld op /vastedagen.</p>
        </Kaart>
      ) : (
        <>
          <Kaart>
            <Rij label="Ingevuld">
              <span className="font-medium tabular-nums">{korteDatum(v.ingevuld_op)}</span>
            </Rij>
            {v.wil_vast ? (
              <>
                <Rij label="Vaste diensten per week">
                  <span className="font-medium tabular-nums">{v.aantal_vast ?? '—'}</span>
                </Rij>
                {DAGEN.map((d) => (
                  <Rij key={d.sleutel} label={`${d.naam}, spits 17–20`}>
                    <Keuze waarde={v[d.sleutel]} />
                    {d.sleutel === 'za' && <Keuze waarde={v.za_hele_dag} voor="Hele dag" />}
                    {d.sleutel === 'zo' && <Keuze waarde={v.zo_hele_dag} voor="Hele dag" />}
                  </Rij>
                ))}
              </>
            ) : (
              <Rij label="Vaste dagen">
                <Pil soort="neutraal">Wil geen vaste dagen</Pil>
              </Rij>
            )}
          </Kaart>
          {!v.wil_vast && (
            <p className="text-sm text-muted">
              Heeft bevestigd dat hij of zij dan alleen wordt ingepland als er ruimte ontstaat
              naast de vaste plekken.
            </p>
          )}
          <Tekst label="Wat ligt er vast" waarde={v.blokkades} />
          <Tekst label="Geldt tot" waarde={v.geldig_tot} />
          <Tekst label="Opmerking" waarde={v.opmerking} />
        </>
      )}
    </section>
  )
}
