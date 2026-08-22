import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { Invullink } from '../components/Invullink'
import { Loonbureau } from '../components/Loonbureau'
import {
  aannemen,
  afwijzen,
  korteDatum,
  naamVan,
  terugNaarSollicitant,
  toestandVan,
  usePersoon,
  usePersoonWijzigen,
  type Persoon as PersoonType,
} from '../lib/personeel'

/* Wat de medewerker via de link invult. BSN en IBAN staan er bewust afgeschermd
   in: ze zijn nodig, maar hoeven niet open en bloot op je scherm te staan. */
const INGEVULD: { sleutel: string; label: string; gevoelig?: boolean }[] = [
  { sleutel: 'straat', label: 'Straat' },
  { sleutel: 'huisnummer', label: 'Huisnummer' },
  { sleutel: 'postcode', label: 'Postcode' },
  { sleutel: 'woonplaats', label: 'Woonplaats' },
  { sleutel: 'bsn', label: 'BSN', gevoelig: true },
  { sleutel: 'iban', label: 'IBAN', gevoelig: true },
  { sleutel: 'noodcontact_naam', label: 'Noodcontact' },
  { sleutel: 'noodcontact_tel', label: 'Noodcontact telefoon' },
  { sleutel: 'loonheffingskorting', label: 'Loonheffingskorting' },
  { sleutel: 'tshirt_maat', label: 'T-shirtmaat' },
]

function Rij({ label, waarde }: { label: string; waarde: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-medium tabular-nums">{waarde}</span>
    </div>
  )
}

function toonWaarde(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nee'
  return String(v)
}

function Tijdlijn({ p }: { p: PersoonType }) {
  const punten = [
    { label: 'Gesolliciteerd', datum: p.aangemeld_op },
    { label: 'Aangenomen', datum: p.aangenomen_op },
    { label: 'Invullink verstuurd', datum: p.onboarding_verstuurd_op },
    { label: 'Gegevens ingevuld', datum: p.onboarding_ingevuld_op },
    { label: 'Naar loonbureau', datum: p.loonbureau_verstuurd_op },
    { label: 'Bevestigd door loonbureau', datum: p.loonbureau_bevestigd_op },
    { label: 'Uit dienst', datum: p.uit_dienst_op },
  ].filter((punt) => punt.datum)

  if (punten.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Verloop</Kopje>
      <Kaart>
        {punten.map((punt) => (
          <Rij key={punt.label} label={punt.label} waarde={korteDatum(punt.datum)} />
        ))}
      </Kaart>
    </section>
  )
}

export function Persoon() {
  const { id } = useParams()
  const { data: p, isPending, error, refetch } = usePersoon(id)
  const wijzig = usePersoonWijzigen(id ?? '')
  const [toonGevoelig, setToonGevoelig] = useState(false)
  const [afwijzenBevestigen, setAfwijzenBevestigen] = useState(false)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const toestand = toestandVan(p)
  const ingevuld = p.onboarding_data ?? null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/personeel"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar de lijst
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl">{naamVan(p)}</h2>
          <Pil soort={toestand.soort}>{toestand.label}</Pil>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {p.fase === 'sollicitant' ? 'Sollicitant' : 'Medewerker'}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------- acties --- */}
      {p.fase === 'sollicitant' && p.status !== 'afgewezen' && (
        <section className="flex flex-col gap-3">
          <Kopje>Wat doe je met deze sollicitant</Kopje>
          <div className="flex flex-wrap gap-2">
            <Knop
              soort="primair"
              bezig={wijzig.isPending}
              onClick={() => wijzig.mutate(aannemen())}
            >
              Aannemen
            </Knop>
            {p.status !== 'eerste_contact' && (
              <Knop soort="rustig" onClick={() => wijzig.mutate({ status: 'eerste_contact' })}>
                Contact gehad
              </Knop>
            )}
            {p.status !== 'gesprek' && (
              <Knop soort="rustig" onClick={() => wijzig.mutate({ status: 'gesprek' })}>
                Gesprek
              </Knop>
            )}
            {afwijzenBevestigen ? (
              <span className="flex flex-wrap items-center gap-2">
                <Knop
                  soort="gevaar"
                  onClick={() => {
                    wijzig.mutate(afwijzen())
                    setAfwijzenBevestigen(false)
                  }}
                >
                  Ja, afwijzen
                </Knop>
                <Knop soort="rustig" onClick={() => setAfwijzenBevestigen(false)}>
                  Toch niet
                </Knop>
              </span>
            ) : (
              <Knop soort="gevaar" onClick={() => setAfwijzenBevestigen(true)}>
                Afwijzen
              </Knop>
            )}
          </div>
          <p className="text-sm text-muted">
            Aannemen verplaatst deze persoon naar de medewerkers. Alles wat hier al
            staat, blijft staan — er wordt niets overgetypt.
          </p>
        </section>
      )}

      {p.fase === 'medewerker' && (
        <section className="flex flex-col gap-3">
          <Kopje>Wat er nu moet</Kopje>
          <Kaart className="p-4">
            <p className="text-sm">
              {toestand.sleutel === 'aangenomen'
                ? 'Deze medewerker heeft de invullink nog niet gehad — hieronder maak je hem aan.'
                : toestand.sleutel === 'compleet'
                  ? 'De gegevens zijn binnen. Vul hieronder de contractgegevens aan en verstuur naar het loonbureau.'
                  : 'Er wacht op dit moment niets op jou.'}
            </p>
          </Kaart>
          {!p.aangenomen_op || !p.onboarding_verstuurd_op ? (
            <Knop
              soort="rustig"
              onClick={() => wijzig.mutate(terugNaarSollicitant())}
              className="w-fit"
            >
              Toch terug naar sollicitant
            </Knop>
          ) : null}
        </section>
      )}

      {p.fase === 'medewerker' && !p.uit_dienst_op && <Invullink persoon={p} />}

      {p.fase === 'medewerker' && !p.uit_dienst_op && <Loonbureau persoon={p} />}

      {/* ---------------------------------------------------- sollicitatie --- */}
      <section className="flex flex-col gap-3">
        <Kopje>Van de sollicitatie</Kopje>
        <Kaart>
          <Rij label="Geboortedatum" waarde={korteDatum(p.geboortedatum)} />
          <Rij label="Telefoon" waarde={toonWaarde(p.telefoonnummer)} />
          <Rij label="E-mail" waarde={toonWaarde(p.email)} />
        </Kaart>
        {p.motivatie && (
          <Kaart className="p-4">
            <p className="mb-1 text-sm text-muted">Motivatie</p>
            <p className="whitespace-pre-wrap text-sm">{p.motivatie}</p>
          </Kaart>
        )}
      </section>

      {/* ------------------------------------------------- ingevulde gegevens --- */}
      {ingevuld && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Kopje>Zelf ingevuld</Kopje>
            <button
              type="button"
              onClick={() => setToonGevoelig((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
            >
              {toonGevoelig ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {toonGevoelig ? 'BSN en IBAN verbergen' : 'BSN en IBAN tonen'}
            </button>
          </div>
          <Kaart>
            {INGEVULD.map(({ sleutel, label, gevoelig }) => {
              const waarde = ingevuld[sleutel]
              if (waarde === undefined) return null
              return (
                <Rij
                  key={sleutel}
                  label={label}
                  waarde={gevoelig && !toonGevoelig ? '••••••••' : toonWaarde(waarde)}
                />
              )
            })}
          </Kaart>
        </section>
      )}

      <Tijdlijn p={p} />
    </div>
  )
}
