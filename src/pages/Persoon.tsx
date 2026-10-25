import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { Invullink } from '../components/Invullink'
import { Loonbureau } from '../components/Loonbureau'
import { UitDienst } from '../components/UitDienst'
import { Dossier } from '../components/Dossier'
import { IngevuldeGegevens } from '../components/IngevuldeGegevens'
import { VasteDagen } from '../components/VasteDagen'
import { Werkplekken } from '../components/Werkplekken'
import { Contracten } from '../components/Contracten'
import { Voorstellen } from '../components/Voorstellen'
import { Ondertekenen } from '../components/Ondertekenen'
import { Breed } from '../lib/breedte'
import {
  aannemen,
  afwijzen,
  korteDatum,
  leeftijd,
  naamVan,
  terugNaarSollicitant,
  toestandVan,
  usePersoon,
  usePersoonWijzigen,
  type Persoon as PersoonType,
} from '../lib/personeel'

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
  const [afwijzenBevestigen, setAfwijzenBevestigen] = useState(false)

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const toestand = toestandVan(p)
  /* De meewerkend eigenaar doet mee in het rooster en in de spits, maar heeft
     geen invullink, geen loonbureau en geen onboarding. Die blokken zouden op
     zijn kaart eeuwig blijven staan als iets dat nog moet. */
  const eigenaar = p.is_eigenaar
  // Alles is rond: de gegevens zijn binnen en het loonbureau heeft ze gehad.
  // Vanaf dan zijn de invullink en het loonbureaublok naslag, geen werk.
  const lopend =
    p.fase === 'medewerker' && Boolean(p.loonbureau_verstuurd_op) && !p.uit_dienst_op

  // Niets te melden is ook een antwoord, maar dan hoeft er geen kaart te staan.
  const watMoet =
    toestand.sleutel === 'aangenomen'
      ? 'Deze medewerker heeft de invullink nog niet gehad — hieronder maak je hem aan.'
      : toestand.sleutel === 'compleet'
        ? 'De gegevens zijn binnen. Vul hieronder de contractgegevens aan en verstuur naar het loonbureau.'
        : null
  const ingevuld = p.onboarding_data ?? null

  return (
    <div className="flex flex-col gap-8">
      {/* Deze pagina werkt met twee kolommen en heeft daar ruimte voor nodig. */}
      <Breed />
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

      {p.fase === 'medewerker' && watMoet && (
        <section className="flex flex-col gap-3">
          <Kopje>Wat er nu moet</Kopje>
          <Kaart className="p-4">
            <p className="text-sm">{watMoet}</p>
          </Kaart>
        </section>
      )}

      {eigenaar && (
        <Kaart className="p-4">
          <p className="text-sm">
            Meewerkend eigenaar. Telt mee in het rooster en in de indeling van de spits, maar niet in
            de onboarding, het loonbureau of de vergelijking met eitje.
          </p>
        </Kaart>
      )}

      {/* Twee kolommen op een breed scherm, en onder elkaar op een telefoon.
          Links de werklijn: hoe het contract ervoor staat en wat er met deze
          persoon loopt. Rechts het naslagwerk: wat vastligt en af en toe
          nagekeken wordt. Zo zie je in één oogopslag hoe iemand ervoor staat,
          in plaats van te moeten scrollen om te onthouden wat erboven stond. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Zolang er nog iets moet, staat het bovenaan. Is alles rond, dan is
              dit archief en gaat het dagelijkse werk voor. */}
          {!lopend && !eigenaar && p.fase === 'medewerker' && !p.uit_dienst_op && (
            <>
              <Invullink persoon={p} />
              <Loonbureau persoon={p} />
            </>
          )}

          {p.fase === 'medewerker' && <Contracten persoon={p} />}
          {p.fase === 'medewerker' && !p.uit_dienst_op && <Voorstellen persoon={p} />}
          {p.fase === 'medewerker' && <Ondertekenen persoon={p} />}

          {lopend && (
            <>
              <Loonbureau persoon={p} />
              <Invullink persoon={p} />
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          {p.fase === 'medewerker' && !p.uit_dienst_op && <Werkplekken persoon={p} />}
          {p.fase === 'medewerker' && !p.uit_dienst_op && !eigenaar && <VasteDagen persoon={p} />}

          <section className="flex flex-col gap-3">
            <Kopje>Van de sollicitatie</Kopje>
            <Kaart>
              <Rij
                label="Geboortedatum"
                waarde={
                  leeftijd(p.geboortedatum) === null
                    ? korteDatum(p.geboortedatum)
                    : `${korteDatum(p.geboortedatum)} — ${leeftijd(p.geboortedatum)} jaar`
                }
              />
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

          {/* Bij een medewerker altijd, ook als er nog niets is ingevuld: anders
              is er geen plek om het alsnog te doen. */}
          {(ingevuld || p.fase === 'medewerker') && !eigenaar && <IngevuldeGegevens persoon={p} />}

          <Tijdlijn p={p} />

          {p.fase === 'medewerker' && !eigenaar && <UitDienst persoon={p} />}
        </div>
      </div>

      {/* Over de volle breedte: het dossier is zijn eigen onderwerp, met
          verslagen en documenten die ruimte nodig hebben. */}
      {p.fase === 'medewerker' && (
        <section className="flex flex-col gap-4">
          <h3 className="font-display text-xl">Dossier</h3>
          <Dossier persoon={p} />
        </section>
      )}

      {/* Zelden nodig, dus niet bovenaan in de weg. */}
      {p.fase === 'medewerker' && !eigenaar && (!p.aangenomen_op || !p.onboarding_verstuurd_op) && (
        <section className="flex flex-col gap-2">
          <Knop
            soort="rustig"
            onClick={() => wijzig.mutate(terugNaarSollicitant())}
            className="w-fit"
          >
            Toch terug naar sollicitant
          </Knop>
          <p className="text-sm text-muted">
            Aangenomen terwijl het toch niet doorging? Hiermee gaat deze persoon
            terug naar de sollicitanten. Wat er is ingevuld blijft staan.
          </p>
        </section>
      )}
    </div>
  )
}
