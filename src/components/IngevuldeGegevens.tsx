import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Pencil } from 'lucide-react'
import { Kaart, Knop, Kopje, Veld } from './ui'
import { useIngevuldWijzigen, type Persoon } from '../lib/personeel'
import { NAAR_LOONBUREAU } from '../lib/mijngegevens'

/* Wat de medewerker via de link invult — en wat Sander kan rechtzetten.

   Dat laatste is nodig omdat de mensen uit de oude app nooit een invulformulier
   hebben gehad: hun gegevens komen uit de overzetting en verouderen gewoon mee.
   Zonder deze knop kon niemand daar nog bij.

   BSN en IBAN staan afgeschermd en zijn pas te wijzigen als je ze zichtbaar
   maakt. Ze zijn nodig, maar hoeven niet open en bloot op je scherm te staan. */

type Soort = 'tekst' | 'jaNee' | 'geslacht'

const INGEVULD: { sleutel: string; label: string; soort?: Soort; gevoelig?: boolean }[] = [
  { sleutel: 'straat', label: 'Straat' },
  { sleutel: 'huisnummer', label: 'Huisnummer' },
  { sleutel: 'toevoeging', label: 'Toevoeging' },
  { sleutel: 'postcode', label: 'Postcode' },
  { sleutel: 'woonplaats', label: 'Woonplaats' },
  { sleutel: 'geslacht', label: 'Geslacht', soort: 'geslacht' },
  { sleutel: 'geboorteplaats', label: 'Geboorteplaats' },
  { sleutel: 'bsn', label: 'BSN', gevoelig: true },
  { sleutel: 'iban', label: 'IBAN', gevoelig: true },
  { sleutel: 'noodcontact_naam', label: 'Noodcontact' },
  { sleutel: 'noodcontact_tel', label: 'Noodcontact telefoon' },
  { sleutel: 'loonheffingskorting', label: 'Loonheffingskorting', soort: 'jaNee' },
  { sleutel: 'tshirt_maat', label: 'T-shirtmaat' },
]

const GESLACHTEN = [
  { waarde: '', label: 'Niet ingevuld' },
  { waarde: 'M', label: 'Man' },
  { waarde: 'V', label: 'Vrouw' },
  { waarde: 'O', label: 'Overig' },
]

const keuzeStijl =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function toonWaarde(waarde: unknown): string {
  if (waarde === true) return 'Ja'
  if (waarde === false) return 'Nee'
  const tekst = String(waarde ?? '').trim()
  return tekst || 'niet ingevuld'
}

function Rij({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-medium ${waarde === 'niet ingevuld' ? 'text-muted' : ''}`}>
        {waarde}
      </span>
    </div>
  )
}

export function IngevuldeGegevens({ persoon: p }: { persoon: Persoon }) {
  const ingevuld = (p.onboarding_data ?? {}) as Record<string, unknown>
  const wijzig = useIngevuldWijzigen(p.id, ingevuld)
  const [toonGevoelig, setToonGevoelig] = useState(false)
  const [bewerken, setBewerken] = useState(false)
  const [gewijzigd, setGewijzigd] = useState<string[]>([])

  function bewaar(sleutel: string, waarde: unknown) {
    if (waarde === (ingevuld[sleutel] ?? '')) return
    wijzig.mutate({ veld: sleutel, waarde })
    setGewijzigd((eerder) => (eerder.includes(sleutel) ? eerder : [...eerder, sleutel]))
  }

  // Verhuist iemand nadat het dossier de deur uit is, dan weet het loonbureau
  // dat niet vanzelf.
  const loonbureauMoetHetWeten =
    Boolean(p.loonbureau_verstuurd_op) && gewijzigd.some((s) => NAAR_LOONBUREAU.includes(s))

  return (
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

      {bewerken ? (
        <Kaart className="flex flex-col gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {INGEVULD.map(({ sleutel, label, soort, gevoelig }) => {
              if (gevoelig && !toonGevoelig) {
                return (
                  <div key={sleutel} className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-muted">{label}</span>
                    <p className="py-2.5 text-sm text-muted">
                      ••••••••  — zet ze eerst zichtbaar om ze te wijzigen
                    </p>
                  </div>
                )
              }

              if (soort === 'jaNee' || soort === 'geslacht') {
                const opties =
                  soort === 'geslacht'
                    ? GESLACHTEN
                    : [
                        { waarde: '', label: 'Niet ingevuld' },
                        { waarde: 'ja', label: 'Ja' },
                        { waarde: 'nee', label: 'Nee' },
                      ]
                const nu =
                  soort === 'geslacht'
                    ? String(ingevuld[sleutel] ?? '')
                    : ingevuld[sleutel] === true
                      ? 'ja'
                      : ingevuld[sleutel] === false
                        ? 'nee'
                        : ''
                return (
                  <div key={sleutel} className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-muted" htmlFor={`g-${sleutel}`}>
                      {label}
                    </label>
                    <select
                      id={`g-${sleutel}`}
                      className={keuzeStijl}
                      value={nu}
                      onChange={(e) => {
                        const v = e.target.value
                        wijzig.mutate({
                          veld: sleutel,
                          waarde:
                            soort === 'geslacht' ? v || null : v === '' ? null : v === 'ja',
                        })
                        setGewijzigd((eerder) =>
                          eerder.includes(sleutel) ? eerder : [...eerder, sleutel],
                        )
                      }}
                    >
                      {opties.map((o) => (
                        <option key={o.waarde} value={o.waarde}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              return (
                <Veld
                  key={sleutel}
                  label={label}
                  defaultValue={String(ingevuld[sleutel] ?? '')}
                  onBlur={(e) => bewaar(sleutel, e.target.value.trim())}
                />
              )
            })}
          </div>

          {loonbureauMoetHetWeten && (
            <p className="flex items-start gap-2 text-sm text-warn">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Dit is een gegeven dat het loonbureau ook heeft. Geef de wijziging
              daar door, of stuur het mutatieformulier opnieuw.
            </p>
          )}

          <Knop soort="rustig" className="w-fit" onClick={() => setBewerken(false)}>
            Klaar met wijzigen
          </Knop>
        </Kaart>
      ) : (
        <>
          <Kaart>
            {INGEVULD.map(({ sleutel, label, gevoelig }) => (
              <Rij
                key={sleutel}
                label={label}
                waarde={
                  gevoelig && !toonGevoelig && ingevuld[sleutel]
                    ? '••••••••'
                    : toonWaarde(ingevuld[sleutel])
                }
              />
            ))}
          </Kaart>
          <Knop soort="rustig" className="w-fit" onClick={() => setBewerken(true)}>
            <Pencil className="size-4" aria-hidden />
            Wijzigen
          </Knop>
        </>
      )}
    </section>
  )
}
