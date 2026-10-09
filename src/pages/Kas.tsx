import { useEffect, useRef, useState } from 'react'
import { Eraser, Lock, Unlock } from 'lucide-react'
import { Kaart, Knop, Kopje } from '../components/ui'
import {
  COUPURES,
  LEEG,
  aantal,
  bedrag,
  coupureNaam,
  ergensTeveel,
  euro,
  inLade,
  bewaarTelling,
  isVanVandaag,
  kluisregels,
  leesTelling,
  teveelNaarKluis,
  tijdstip,
  totalen,
  vandaagInWoorden,
  wisTelling,
  type Aantallen,
  type Soort,
} from '../lib/kas'

/* Kas tellen: je telt, je geeft aan wat er naar de kluis gaat, en je neemt de
   bedragen over in de kassa.

   Ben je klaar, dan zet je de telling vast. Daarna staan de velden dicht, zodat
   er bij de kassa niets meer verschuift, en staat bovenaan het lijstje dat je
   daar nodig hebt.

   Enter en Tab springen naar de volgende coupure in dezelfde kolom, niet naar
   het veld ernaast: je telt eerst alle biljetten, daarna pas wat eruit gaat. */

const INVOER =
  'w-full rounded-[4px] border-[1.5px] bg-bg px-2 py-3 text-center text-lg tabular-nums outline-none focus:border-accent'

/* Een vastgezet veld blijft leesbaar, maar laat met een rustige rand zien dat
   er niets meer te typen valt. */
const DICHT = 'border-line bg-surface-2'

/* Twee kolommen zijn op een telefoon niet onmisbaar, dus die vallen weg; de
   twee invoervelden en wat er in de lade blijft houd je altijd. */
const RIJ = 'grid grid-cols-[3.25rem_1fr_1fr_5rem] md:grid-cols-[4.5rem_1fr_6.5rem_1fr_6.5rem_6.5rem] items-center gap-2'

function Kop() {
  return (
    <div className={`${RIJ} border-b border-line px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted`}>
      <span>Coupure</span>
      <span className="text-center">Geteld</span>
      <span className="hidden text-right md:block">Bedrag</span>
      <span className="text-center">Naar kluis</span>
      <span className="hidden text-right md:block">Kluis bedrag</span>
      <span className="text-right">In lade</span>
    </div>
  )
}

function Subtotaal({ label, geteld, kluis }: { label: string; geteld: Aantallen; kluis: Aantallen }) {
  const t = totalen(geteld, kluis, label === 'Biljetten' ? 'biljet' : 'munt')
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-y border-line bg-surface-2 px-3 py-2 text-sm">
      <span className="font-semibold">Subtotaal {label.toLowerCase()}</span>
      <span className="tabular-nums text-muted">
        geteld <span className="font-semibold text-text">{euro(t.geteld)}</span> · kluis{' '}
        <span className="font-semibold text-text">{euro(t.kluis)}</span> · lade{' '}
        <span className="font-semibold text-text">{euro(t.lade)}</span>
      </span>
    </div>
  )
}

function TotaalKaart({
  label,
  waarde,
  nadruk,
  children,
}: {
  label: string
  waarde: number
  nadruk?: boolean
  children?: React.ReactNode
}) {
  return (
    <Kaart className={`p-4 ${nadruk ? 'border-accent' : ''}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{euro(waarde)}</p>
      {children}
    </Kaart>
  )
}

export function Kas() {
  // Wat er nog op dit toestel stond: je telt in kantoor en maakt bij de kassa
  // je telefoon weer open.
  const [bewaard] = useState(() => leesTelling())
  const [geteld, setGeteld] = useState<Aantallen>(() => bewaard?.geteld ?? LEEG)
  const [kluis, setKluis] = useState<Aantallen>(() => bewaard?.kluis ?? LEEG)
  const [bewaardOp, setBewaardOp] = useState(() => bewaard?.bewaardOp ?? '')
  const [vastgezetOp, setVastgezetOp] = useState(() => bewaard?.vastgezetOp ?? '')
  const [opengemaaktOp, setOpengemaaktOp] = useState(() => bewaard?.opengemaaktOp ?? '')
  const [kanBewaren, setKanBewaren] = useState(true)
  const [wissenBevestigen, setWissenBevestigen] = useState(false)
  const [openmakenBevestigen, setOpenmakenBevestigen] = useState(false)

  const geteldVelden = useRef<(HTMLInputElement | null)[]>([])
  const kluisVelden = useRef<(HTMLInputElement | null)[]>([])

  const t = totalen(geteld, kluis)
  const fout = ergensTeveel(geteld, kluis)
  const leeg = t.geteld === 0 && t.kluis === 0
  const vanEerder = Boolean(bewaardOp) && !isVanVandaag(bewaardOp)
  const vast = Boolean(vastgezetOp)
  const regels = kluisregels(kluis)

  /* Na elke wijziging opslaan. Een lege telling hoeft niet bewaard: dan hoort
     het scherm bij de volgende keer gewoon leeg te zijn.

     Niet bij het openen van het scherm: dan zou een telling van gisteren
     meteen het stempel van vandaag krijgen en verdween de waarschuwing
     voordat je hem gelezen had. */
  const eersteKeer = useRef(true)
  useEffect(() => {
    if (eersteKeer.current) {
      eersteKeer.current = false
      return
    }
    if (leeg) return
    const gelukt = bewaarTelling({
      geteld,
      kluis,
      vastgezetOp: vastgezetOp || undefined,
      opengemaaktOp: opengemaaktOp || undefined,
    })
    setKanBewaren(gelukt)
    if (gelukt) setBewaardOp(new Date().toISOString())
  }, [geteld, kluis, leeg, vastgezetOp, opengemaaktOp])

  function zet(welke: 'geteld' | 'kluis', centen: number, waarde: string) {
    // Vast is vast. De velden staan al dicht; dit is het slot op de deur.
    if (vast) return
    // Alleen hele getallen vanaf nul; een lege invoer is gewoon nul.
    const n = waarde === '' ? 0 : Math.max(0, Math.floor(Number(waarde)))
    const bijwerken = (a: Aantallen) => ({ ...a, [centen]: Number.isFinite(n) ? n : 0 })
    if (welke === 'geteld') setGeteld(bijwerken)
    else setKluis(bijwerken)
  }

  /** Enter en Tab gaan naar de volgende coupure in dezelfde kolom. */
  function naarVolgende(
    e: React.KeyboardEvent<HTMLInputElement>,
    velden: React.RefObject<(HTMLInputElement | null)[]>,
    i: number,
  ) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    const doel = velden.current[i + (e.shiftKey ? -1 : 1)]
    // Voorbij het laatste veld laten we Tab gewoon zijn werk doen.
    if (!doel) return
    e.preventDefault()
    doel.focus()
    doel.select()
  }

  function vastzetten() {
    setVastgezetOp(new Date().toISOString())
  }

  /* Openmaken mag, maar het blijft erbij staan: anders is vastzetten een knop
     zonder betekenis. */
  function openmaken() {
    setVastgezetOp('')
    setOpengemaaktOp(new Date().toISOString())
    setOpenmakenBevestigen(false)
  }

  function wis() {
    setGeteld(LEEG)
    setKluis(LEEG)
    setBewaardOp('')
    setVastgezetOp('')
    setOpengemaaktOp('')
    wisTelling()
    setWissenBevestigen(false)
    geteldVelden.current[0]?.focus()
  }

  /* Zolang je telt kijk je naar wat er in de lade blijft. Staat de telling
     vast, dan is dit het lijstje voor de kassa: daar voer je de afstorting in,
     dus die staat bovenaan en de rest eronder. Scheelt scrollen met de kassa
     voor je neus. */
  const totalenBlok = (
    <div className="grid gap-3 sm:grid-cols-3">
      <TotaalKaart label="Totaal geteld" waarde={t.geteld} />
      <TotaalKaart label="Naar kluis" waarde={t.kluis} />
      <TotaalKaart label="Blijft in lade" waarde={t.lade} nadruk />
    </div>
  )

  const kassalijst = (
    <div className="flex flex-col gap-3">
      <TotaalKaart label="Naar kluis" waarde={t.kluis} nadruk>
        {regels.length === 0 ? (
          <p className="mt-2 text-sm">Er gaat niets naar de kluis.</p>
        ) : (
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
            {regels.map((r) => (
              <span key={r.centen}>
                <span className="font-semibold">{r.stuks} ×</span> {coupureNaam(r.centen)}
              </span>
            ))}
          </p>
        )}
      </TotaalKaart>

      <div className="grid gap-3 sm:grid-cols-2">
        <TotaalKaart label="Totaal geteld" waarde={t.geteld} />
        <TotaalKaart label="Blijft in lade" waarde={t.lade} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Kopje>Kas tellen</Kopje>
        <p className="mt-1 text-sm text-muted">{vandaagInWoorden()}</p>

        {vanEerder && (
          <p className="mt-2 text-sm text-warn">
            Dit is een telling van eerder, bewaard om {tijdstip(bewaardOp)}. Begin een nieuwe
            als je opnieuw gaat tellen.
          </p>
        )}
        {vast && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <Lock className="size-3.5" aria-hidden />
            Vastgezet om {tijdstip(vastgezetOp)} — hier kun je niets meer in typen.
          </p>
        )}
        {!vast && opengemaaktOp && (
          <p className="mt-1 text-sm text-warn">
            Deze telling is na het vastzetten weer opengemaakt om {tijdstip(opengemaaktOp)}.
          </p>
        )}
        {!vast && !vanEerder && bewaardOp && (
          <p className="mt-1 text-sm text-muted">Bewaard om {tijdstip(bewaardOp)}.</p>
        )}
        {!kanBewaren && (
          <p className="mt-2 text-sm text-bad">
            Dit apparaat bewaart de telling niet. Loop je weg, dan is hij weg — neem de
            bedragen over voordat je het scherm sluit.
          </p>
        )}
      </div>

      {vast && kassalijst}

      <Kaart className="flex flex-col py-2">
        <Kop />

        {COUPURES.map((c, i) => {
          const soort: Soort = c.soort
          const vorige = COUPURES[i - 1]
          const grens = vorige && vorige.soort !== soort
          const teveel = teveelNaarKluis(geteld, kluis, c.centen)

          return (
            <div key={c.centen}>
              {grens && <Subtotaal label="Biljetten" geteld={geteld} kluis={kluis} />}

              <div className={`${RIJ} px-3 py-1.5`}>
                <span className="font-semibold tabular-nums">{coupureNaam(c.centen)}</span>

                <input
                  ref={(el) => {
                    geteldVelden.current[i] = el
                  }}
                  aria-label={`Aantal geteld van ${coupureNaam(c.centen)}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  readOnly={vast}
                  className={`${INVOER} ${vast ? DICHT : 'border-line-strong'}`}
                  value={aantal(geteld, c.centen) || ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => zet('geteld', c.centen, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => naarVolgende(e, geteldVelden, i)}
                />

                <span className="hidden text-right tabular-nums text-muted md:block">
                  {euro(bedrag(geteld, c.centen))}
                </span>

                <input
                  ref={(el) => {
                    kluisVelden.current[i] = el
                  }}
                  aria-label={`Naar kluis van ${coupureNaam(c.centen)}`}
                  aria-invalid={teveel || undefined}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  readOnly={vast}
                  className={`${INVOER} ${
                    vast ? DICHT : teveel ? 'border-bad bg-bad-soft text-bad' : 'border-line-strong'
                  }`}
                  value={aantal(kluis, c.centen) || ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => zet('kluis', c.centen, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => naarVolgende(e, kluisVelden, i)}
                />

                <span className="hidden text-right tabular-nums text-muted md:block">
                  {euro(bedrag(kluis, c.centen))}
                </span>

                <span
                  className={`text-right tabular-nums ${teveel ? 'text-bad' : 'font-medium'}`}
                >
                  {euro(inLade(geteld, kluis, c.centen))}
                </span>
              </div>

              {teveel && (
                <p className="px-3 pb-1 text-sm text-bad">
                  Je kunt niet {aantal(kluis, c.centen)} × {coupureNaam(c.centen)} naar de kluis
                  doen; je hebt er {aantal(geteld, c.centen)} geteld.
                </p>
              )}
            </div>
          )
        })}

        <Subtotaal label="Munten" geteld={geteld} kluis={kluis} />
      </Kaart>

      {!vast && totalenBlok}

      {fout && (
        <p className="text-sm text-bad">
          Er gaat ergens meer naar de kluis dan je geteld hebt. De totalen kloppen pas als dat
          is opgelost.
        </p>
      )}

      {/* ------------------------------------------------------- vastzetten --- */}
      <div className="flex flex-wrap items-center gap-2">
        {wissenBevestigen ? (
          <>
            <span className="text-sm">
              {vast && isVanVandaag(vastgezetOp)
                ? 'Er staat al een vastgezette telling van vandaag. Die raak je kwijt. Toch een nieuwe beginnen?'
                : 'Alles terug op nul?'}
            </span>
            <Knop soort="gevaar" onClick={wis}>
              Ja, nieuwe telling
            </Knop>
            <Knop soort="rustig" onClick={() => setWissenBevestigen(false)}>
              Nee, laat staan
            </Knop>
          </>
        ) : openmakenBevestigen ? (
          <>
            <span className="text-sm">
              Weer openmaken? Er komt bij te staan dat dat gebeurd is.
            </span>
            <Knop onClick={openmaken}>Ja, openmaken</Knop>
            <Knop soort="rustig" onClick={() => setOpenmakenBevestigen(false)}>
              Nee, laat vast
            </Knop>
          </>
        ) : (
          <>
            {vast ? (
              <Knop soort="rustig" onClick={() => setOpenmakenBevestigen(true)}>
                <Unlock className="size-4" aria-hidden />
                Openmaken
              </Knop>
            ) : (
              <Knop onClick={vastzetten} disabled={leeg || fout}>
                <Lock className="size-4" aria-hidden />
                Vastzetten
              </Knop>
            )}
            <Knop soort="rustig" onClick={() => setWissenBevestigen(true)}>
              <Eraser className="size-4" aria-hidden />
              Nieuwe telling
            </Knop>
          </>
        )}
      </div>
    </div>
  )
}
