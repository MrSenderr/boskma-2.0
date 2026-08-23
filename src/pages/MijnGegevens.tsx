import { useEffect, useState } from 'react'
import { Check, Clock, Lock } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useWieBenIk } from '../lib/wie'
import {
  NAAR_LOONBUREAU,
  VELDNAMEN,
  useGegevenWijzigen,
  useMijnGegevens,
  useMijnWijzigingen,
} from '../lib/mijngegevens'
import { korteDatum } from '../lib/personeel'

/* Wat een medewerker van zichzelf ziet. Alles wat hij wijzigt wordt gemeld;
   rekeningnummer en mailadres wachten op akkoord. */

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

function Veldje({
  veld,
  type,
  waarde,
  wacht,
  onBewaar,
}: {
  veld: string
  type?: string
  waarde: string
  wacht: string | null
  onBewaar: (v: string) => void
}) {
  const [tekst, setTekst] = useState(waarde)
  useEffect(() => setTekst(waarde), [waarde])
  const gewijzigd = tekst.trim() !== waarde
  const akkoordNodig = veld === 'iban' || veld === 'email'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`v-${veld}`} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
        {VELDNAMEN[veld]}
        {akkoordNodig && (
          <span className="flex items-center gap-1 text-xs font-normal">
            <Lock className="size-3" aria-hidden />
            Sander kijkt hier eerst naar
          </span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          id={`v-${veld}`}
          type={type ?? 'text'}
          className={invoer}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
        />
        {gewijzigd && (
          <Knop soort="primair" onClick={() => onBewaar(tekst.trim())}>
            <Check className="size-4" aria-hidden />
            Bewaren
          </Knop>
        )}
      </div>
      {wacht !== null && (
        <span className="flex items-center gap-1.5 text-sm text-warn">
          <Clock className="size-3.5" aria-hidden />
          Aangevraagd: {wacht}. Wacht op akkoord.
        </span>
      )}
    </div>
  )
}

export function MijnGegevens() {
  const { data: wie } = useWieBenIk()
  const { data: ik, isPending, error, refetch } = useMijnGegevens(wie?.medewerker_id)
  const { data: wijzigingen } = useMijnWijzigingen(wie?.medewerker_id)
  const wijzig = useGegevenWijzigen()
  const [melding, setMelding] = useState<string | null>(null)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const o = (ik.onboarding_data ?? {}) as Record<string, unknown>
  const waardeVan = (veld: string) =>
    veld === 'telefoonnummer'
      ? (ik.telefoonnummer ?? '')
      : veld === 'email'
        ? (ik.email ?? '')
        : String(o[veld] ?? '')

  function bewaren(veld: string, waarde: string) {
    setMelding(null)
    wijzig.mutate(
      { veld, waarde },
      {
        onSuccess: (uitkomst) => {
          if (uitkomst === 'wacht_op_akkoord')
            setMelding(`${VELDNAMEN[veld]} is aangevraagd. Sander kijkt ernaar.`)
          else if (uitkomst === 'doorgevoerd')
            setMelding(`${VELDNAMEN[veld]} is aangepast.`)
        },
        onError: (e) => setMelding(e.message),
      },
    )
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

      <Kaart className="flex flex-col gap-4 p-5">
        {ZELF.map(({ veld, type }) => {
          const open = (wijzigingen ?? []).find((w) => w.veld === veld)
          return (
            <Veldje
              key={veld}
              veld={veld}
              type={type}
              waarde={waardeVan(veld)}
              wacht={open?.goedkeuring_nodig ? (open.nieuwe_waarde ?? '') : null}
              onBewaar={(v) => bewaren(veld, v)}
            />
          )
        })}
      </Kaart>

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
        bij een verhuizing bijvoorbeeld. Je{' '}
        {NAAR_LOONBUREAU.includes('iban') ? 'rekeningnummer en je mailadres' : 'gegevens'} gaan
        pas mee zodra hij ze heeft nagekeken.
      </p>
    </div>
  )
}
