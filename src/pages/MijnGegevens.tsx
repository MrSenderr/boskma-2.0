import { useState } from 'react'
import { Clock, Lock, Pencil } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useWieBenIk } from '../lib/wie'
import {
  VELDNAMEN,
  useGegevenWijzigen,
  useMijnGegevens,
  useMijnWijzigingen,
} from '../lib/mijngegevens'
import { korteDatum } from '../lib/personeel'

/* Wat een medewerker van zichzelf ziet. Standaard gewoon lezen; pas als je op
   wijzigen klikt worden het invulvelden. Zie
   docs/modules/personeel/personeelsmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const ZELF: { veld: string; type?: string }[] = [
  { veld: 'telefoonnummer', type: 'tel' },
  { veld: 'straat' },
  { veld: 'huisnummer' },
  { veld: 'postcode' },
  { veld: 'woonplaats' },
  { veld: 'noodcontact_naam' },
  { veld: 'noodcontact_tel', type: 'tel' },
  { veld: 'tshirt_maat' },
  { veld: 'iban' },
  { veld: 'email', type: 'email' },
]

const WACHT_OP_AKKOORD = ['iban', 'email']

export function MijnGegevens() {
  const { data: wie } = useWieBenIk()
  const { data: ik, isPending, error, refetch } = useMijnGegevens(wie?.medewerker_id)
  const { data: wijzigingen } = useMijnWijzigingen(wie?.medewerker_id)
  const wijzig = useGegevenWijzigen()
  const [bewerken, setBewerken] = useState(false)
  const [concept, setConcept] = useState<Record<string, string>>({})
  const [melding, setMelding] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const o = (ik.onboarding_data ?? {}) as Record<string, unknown>
  const waardeVan = (veld: string) =>
    veld === 'telefoonnummer'
      ? (ik.telefoonnummer ?? '')
      : veld === 'email'
        ? (ik.email ?? '')
        : String(o[veld] ?? '')

  function beginBewerken() {
    const start: Record<string, string> = {}
    ZELF.forEach(({ veld }) => (start[veld] = waardeVan(veld)))
    setConcept(start)
    setMelding(null)
    setBewerken(true)
  }

  async function bewaren() {
    const veranderd = ZELF.filter(({ veld }) => (concept[veld] ?? '').trim() !== waardeVan(veld))
    if (veranderd.length === 0) {
      setBewerken(false)
      return
    }
    setBezig(true)
    const aangepast: string[] = []
    const aangevraagd: string[] = []
    try {
      // Per veld, want rekeningnummer en mailadres gaan een andere kant op dan
      // de rest.
      for (const { veld } of veranderd) {
        const uitkomst = await wijzig.mutateAsync({ veld, waarde: concept[veld] ?? '' })
        if (uitkomst === 'wacht_op_akkoord') aangevraagd.push(VELDNAMEN[veld])
        else if (uitkomst === 'doorgevoerd') aangepast.push(VELDNAMEN[veld])
      }
      const stukken: string[] = []
      if (aangepast.length) stukken.push(`${aangepast.join(', ')} aangepast`)
      if (aangevraagd.length)
        stukken.push(`${aangevraagd.join(', ')} aangevraagd — Sander kijkt ernaar`)
      setMelding(stukken.join('. ') + '.')
      setBewerken(false)
    } catch (e) {
      setMelding(e instanceof Error ? e.message : 'Er ging iets mis.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Kopje>Mijn gegevens</Kopje>
        <p className="mt-1 font-display text-2xl">
          {[ik.voornaam, ik.achternaam].filter(Boolean).join(' ')}
        </p>
      </div>

      {melding && (
        <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
          {melding}
        </p>
      )}

      <Kaart className="flex flex-col">
        {ZELF.map(({ veld, type }) => {
          const open = (wijzigingen ?? []).find((w) => w.veld === veld && w.goedkeuring_nodig)
          const slot = WACHT_OP_AKKOORD.includes(veld)
          const waarde = waardeVan(veld)

          return (
            <div key={veld} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {VELDNAMEN[veld]}
                  {slot && (
                    <span className="flex items-center gap-1 text-xs">
                      <Lock className="size-3" aria-hidden />
                      Sander kijkt hier eerst naar
                    </span>
                  )}
                </span>
                {!bewerken && (
                  <span className={`font-medium ${waarde ? '' : 'text-muted'}`}>
                    {waarde || 'niet ingevuld'}
                  </span>
                )}
              </div>

              {bewerken && (
                <input
                  aria-label={VELDNAMEN[veld]}
                  type={type ?? 'text'}
                  className={`${invoer} mt-1.5`}
                  value={concept[veld] ?? ''}
                  onChange={(e) => setConcept({ ...concept, [veld]: e.target.value })}
                />
              )}

              {open && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-warn">
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  Aangevraagd: {open.nieuwe_waarde}. Wacht op akkoord.
                </p>
              )}
            </div>
          )
        })}
      </Kaart>

      <div className="flex flex-wrap gap-2">
        {bewerken ? (
          <>
            <Knop soort="primair" bezig={bezig} onClick={bewaren}>
              Bewaren
            </Knop>
            <Knop soort="rustig" onClick={() => setBewerken(false)}>
              Annuleren
            </Knop>
          </>
        ) : (
          <Knop soort="rustig" onClick={beginBewerken}>
            <Pencil className="size-4" aria-hidden />
            Wijzigen
          </Knop>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <Kopje>Vastgelegd, niet zelf te wijzigen</Kopje>
        <Kaart className="flex flex-col gap-2 p-5 text-sm">
          <p className="flex justify-between gap-4">
            <span className="text-muted">Geboortedatum</span>
            <span className="font-medium">{korteDatum(ik.geboortedatum)}</span>
          </p>
          {ik.functie && (
            <p className="flex justify-between gap-4">
              <span className="text-muted">Functie</span>
              <span className="font-medium">{ik.functie}</span>
            </p>
          )}
          {ik.ingangsdatum && (
            <p className="flex justify-between gap-4">
              <span className="text-muted">In dienst sinds</span>
              <span className="font-medium">{korteDatum(ik.ingangsdatum)}</span>
            </p>
          )}
          <p className="mt-1 text-muted">
            Klopt hier iets niet? Zeg het tegen Sander, dan past hij het aan.
          </p>
        </Kaart>
      </section>

      <p className="max-w-prose text-sm text-muted">
        Wat je hier wijzigt geeft Sander door aan het loonbureau als dat nodig is —
        bij een verhuizing bijvoorbeeld. Je rekeningnummer en je mailadres gaan pas
        mee zodra hij ze heeft nagekeken.
      </p>
    </div>
  )
}
