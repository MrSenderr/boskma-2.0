import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Building2, Check, FileText, Pencil, Send, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import {
  CONTRACTTYPES,
  FUNCTIES,
  korteDatum,
  naamVan,
  ontbrekendeContractvelden,
  usePersoonWijzigen,
  type Persoon,
} from '../lib/personeel'
import { bijlagenStand, bijlagenVan, bouwMutatieformulier } from '../lib/mutatieformulier'
import { useTestmodus } from '../lib/instellingen'
import { supabase } from '../lib/supabase'

const VELDNAAM: Record<string, string> = {
  contracttype: 'contracttype',
  contractduur: 'bepaalde of onbepaalde tijd',
  functie: 'functie',
  ingangsdatum: 'ingangsdatum',
  einddatum: 'einddatum',
  uurloon: 'uurloon',
  proefperiode: 'proefperiode',
}

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

/** Eén regel zoals hij ook op de persoonspagina staat. */
function Rij({ label, waarde }: { label: string; waarde: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-medium ${waarde ? '' : 'text-muted'}`}>{waarde || 'niet ingevuld'}</span>
    </div>
  )
}

function jaNee(v: boolean | null | undefined) {
  if (v === null || v === undefined) return null
  return v ? 'Ja' : 'Nee'
}

function Keuze({
  label,
  waarde,
  opties,
  onKies,
}: {
  label: string
  waarde: string | null | undefined
  opties: { waarde: string; label: string }[]
  onKies: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-muted" htmlFor={`k-${label}`}>
        {label}
      </label>
      <select
        id={`k-${label}`}
        className={invoer}
        value={waarde ?? ''}
        onChange={(e) => onKies(e.target.value)}
      >
        <option value="">Kies…</option>
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Loonbureau({ persoon: p }: { persoon: Persoon }) {
  const wijzig = usePersoonWijzigen(p.id)
  const { data: testmodus } = useTestmodus()
  const client = useQueryClient()
  const [bezig, setBezig] = useState(false)
  const [uitkomst, setUitkomst] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [bevestigen, setBevestigen] = useState(false)
  const [bewerken, setBewerken] = useState(false)

  const mist = ontbrekendeContractvelden(p)
  const bijlagen = bijlagenVan(p)
  const alVerstuurd = Boolean(p.loonbureau_verstuurd_op)
  // Zolang het nog niet weg is, vul je in. Daarna is het vastgelegd en lees je
  // het — wijzigen kan, maar dan is het een handeling en geen ongelukje.
  const toonVelden = !alVerstuurd || bewerken

  async function verstuur() {
    setBezig(true)
    setFout(null)
    setUitkomst(null)
    try {
      const { data, error } = await supabase.functions.invoke('stuur-loonbureau', {
        body: {
          mutatie_html: bouwMutatieformulier(p),
          files: bijlagen,
          emp_naam: naamVan(p),
          lb_contract: Boolean(p.contract_door_loonbureau),
        },
      })
      if (error) throw new Error(error.message)
      const r = data as { ok: boolean; error?: string; testmodus?: boolean; verstuurd_naar?: string; bijlagen?: number }
      if (!r.ok) throw new Error(r.error ?? 'onbekende fout')

      await wijzig.mutateAsync({ loonbureau_verstuurd_op: new Date().toISOString() })
      client.invalidateQueries({ queryKey: ['persoon', p.id] })
      setUitkomst(
        r.testmodus
          ? `Testmodus: verstuurd naar ${r.verstuurd_naar}, niet naar het loonbureau. ${r.bijlagen ?? 0} bijlagen.`
          : `Verstuurd naar ${r.verstuurd_naar}. ${r.bijlagen ?? 0} bijlagen.`,
      )
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'onbekende fout')
    } finally {
      setBezig(false)
      setBevestigen(false)
    }
  }

  const [voorbeeld, setVoorbeeld] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Naar het loonbureau</Kopje>

      {/* ----------------------------------------------------- bevestiging --- */}
      {alVerstuurd && (
        <Kaart className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="size-4 shrink-0 text-muted" aria-hidden />
            <span>
              Verstuurd op {korteDatum(p.loonbureau_verstuurd_op)}.{' '}
              {p.loonbureau_bevestigd_op ? (
                <Pil soort="goed">Bevestigd</Pil>
              ) : (
                <span className="text-muted">Nog geen bevestiging van het loonbureau.</span>
              )}
            </span>
          </div>
          {!p.loonbureau_bevestigd_op && (
            <Knop
              soort="rustig"
              onClick={() => wijzig.mutate({ loonbureau_bevestigd_op: new Date().toISOString() })}
            >
              <Check className="size-4" aria-hidden />
              Loonbureau heeft bevestigd
            </Knop>
          )}
        </Kaart>
      )}


      {/* ------------------------------------------------- contractgegevens --- */}
      <Kaart className="flex flex-col gap-4 p-4">
        {toonVelden ? (
          <>
            <p className="text-sm text-muted">
              Dit vul jij in; de rest komt uit het invulformulier van de medewerker.
            </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Keuze
            label="Contracttype"
            waarde={p.contracttype}
            opties={CONTRACTTYPES.map((c) => ({ waarde: c, label: c }))}
            onKies={(v) => wijzig.mutate({ contracttype: v })}
          />
          <Keuze
            label="Duur"
            waarde={p.contractduur}
            opties={[
              { waarde: 'bepaalde', label: 'Bepaalde tijd' },
              { waarde: 'onbepaalde', label: 'Onbepaalde tijd' },
            ]}
            onKies={(v) => wijzig.mutate({ contractduur: v as 'bepaalde' | 'onbepaalde' })}
          />
          <Keuze
            label="Functie"
            waarde={p.functie}
            opties={FUNCTIES.map((f) => ({ waarde: f.naam, label: `${f.naam} (groep ${f.groep})` }))}
            onKies={(v) => wijzig.mutate({ functie: v })}
          />
          <Veld
            label="Uurloon bruto"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={p.uurloon ?? ''}
            onBlur={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              if (v !== p.uurloon) wijzig.mutate({ uurloon: v })
            }}
          />
          <Veld
            label="Ingangsdatum"
            type="date"
            defaultValue={p.ingangsdatum ?? ''}
            onBlur={(e) => {
              const v = e.target.value || null
              if (v !== p.ingangsdatum) wijzig.mutate({ ingangsdatum: v })
            }}
          />
          {p.contractduur === 'bepaalde' && (
            <Veld
              label="Einddatum"
              type="date"
              defaultValue={p.einddatum ?? ''}
              onBlur={(e) => {
                const v = e.target.value || null
                if (v !== p.einddatum) wijzig.mutate({ einddatum: v })
              }}
            />
          )}
          <Keuze
            label="Proefperiode"
            waarde={p.proefperiode === null || p.proefperiode === undefined ? '' : p.proefperiode ? 'ja' : 'nee'}
            opties={[
              { waarde: 'ja', label: 'Ja' },
              { waarde: 'nee', label: 'Nee' },
            ]}
            onKies={(v) => wijzig.mutate({ proefperiode: v === 'ja' })}
          />
          <Keuze
            label="Contract opstellen door loonbureau"
            waarde={
              p.contract_door_loonbureau === null || p.contract_door_loonbureau === undefined
                ? ''
                : p.contract_door_loonbureau
                  ? 'ja'
                  : 'nee'
            }
            opties={[
              { waarde: 'ja', label: 'Ja' },
              { waarde: 'nee', label: 'Nee' },
            ]}
            onKies={(v) => wijzig.mutate({ contract_door_loonbureau: v === 'ja' })}
          />
        </div>

            {alVerstuurd && (
              <div className="flex flex-col gap-2">
                <Knop soort="rustig" className="w-fit" onClick={() => setBewerken(false)}>
                  Klaar met wijzigen
                </Knop>
                <p className="text-sm text-warn">
                  Wat je hier verandert weet het loonbureau nog niet. Verstuur
                  opnieuw als het iets is dat zij moeten hebben.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <Kopje>Contractgegevens</Kopje>
            <div>
              <Rij label="Contracttype" waarde={p.contracttype} />
              <Rij
                label="Duur"
                waarde={
                  p.contractduur === 'bepaalde'
                    ? 'Bepaalde tijd'
                    : p.contractduur === 'onbepaalde'
                      ? 'Onbepaalde tijd'
                      : null
                }
              />
              <Rij label="Functie" waarde={p.functie} />
              <Rij
                label="Uurloon bruto"
                waarde={
                  p.uurloon === null || p.uurloon === undefined
                    ? null
                    : `€ ${p.uurloon.toFixed(2).replace('.', ',')}`
                }
              />
              <Rij label="Ingangsdatum" waarde={p.ingangsdatum ? korteDatum(p.ingangsdatum) : null} />
              {p.contractduur === 'bepaalde' && (
                <Rij label="Einddatum" waarde={p.einddatum ? korteDatum(p.einddatum) : null} />
              )}
              <Rij label="Proefperiode" waarde={jaNee(p.proefperiode)} />
              <Rij label="Contract door loonbureau" waarde={jaNee(p.contract_door_loonbureau)} />
            </div>
            <Knop soort="rustig" className="w-fit" onClick={() => setBewerken(true)}>
              <Pencil className="size-4" aria-hidden />
              Wijzigen
            </Knop>
          </>
        )}
      </Kaart>

      {/* ------------------------------------------------------- versturen --- */}
      <Kaart className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Wat er meegaat</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden /> Mutatieformulier
            </li>
            {bijlagenStand(p).map((b) => (
              <li
                key={b.label}
                className={`flex items-start gap-2 ${b.aanwezig ? 'text-muted' : 'text-warn'}`}
              >
                {b.aanwezig ? (
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                <span>
                  {b.label}
                  {!b.aanwezig && (
                    <span className="block">
                      {b.blijvend
                        ? 'Ontbreekt. Deze gaat dus niet mee — maak een nieuwe invullink als het loonbureau hem nodig heeft.'
                        : p.loonbureau_verstuurd_op
                          ? 'Ontbreekt. ID-kopieën worden veertien dagen na het versturen weggegooid; dat is normaal.'
                          : 'Ontbreekt. De medewerker heeft het invulformulier nog niet gedaan, of heeft geen kopie geüpload.'}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {mist.length > 0 && (
          <p className="rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
            Nog invullen: {mist.map((m) => VELDNAAM[m] ?? m).join(', ')}.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Knop soort="rustig" onClick={() => setVoorbeeld(bouwMutatieformulier(p))}>
            <FileText className="size-4" aria-hidden />
            Formulier bekijken
          </Knop>

          {bevestigen ? (
            <span className="flex flex-wrap items-center gap-2">
              <Knop soort="primair" bezig={bezig} onClick={verstuur}>
                {testmodus?.aan ? `Ja, naar ${testmodus.adres}` : 'Ja, naar het loonbureau'}
              </Knop>
              <Knop soort="rustig" onClick={() => setBevestigen(false)}>
                Toch niet
              </Knop>
            </span>
          ) : (
            <Knop
              soort={alVerstuurd ? 'rustig' : 'primair'}
              disabled={mist.length > 0}
              onClick={() => setBevestigen(true)}
            >
              <Send className="size-4" aria-hidden />
              {alVerstuurd ? 'Opnieuw versturen' : 'Versturen'}
            </Knop>
          )}
        </div>

        {fout && (
          <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
            Dit ging mis: {fout}
          </p>
        )}
        {uitkomst && (
          <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
            {uitkomst}
          </p>
        )}
      </Kaart>

      {/* ------------------------------------------------------- voorbeeld --- */}
      {voorbeeld && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60 p-2 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Voorbeeld van het mutatieformulier"
        >
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-card bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
              <span className="font-display text-base">Mutatieformulier</span>
              <button
                type="button"
                onClick={() => setVoorbeeld(null)}
                aria-label="Sluiten"
                className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <iframe
              title="Mutatieformulier"
              srcDoc={voorbeeld}
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}

    </section>
  )
}
