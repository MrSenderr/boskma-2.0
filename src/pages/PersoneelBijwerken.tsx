import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Upload } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { leesWerkboek } from '../lib/xlsx-lezen'
import { useAuth } from '../lib/auth'
import {
  VELDNAAM,
  isPersoneelsbestand,
  leesPersoneel,
  useLoongegevens,
  useVerschillenOvernemen,
  vergelijk,
  type Personeelsbestand,
  type Verschil,
} from '../lib/eitjePersoneel'

/* Het personeelsbestand uit eitje naast de app leggen.

   Eitje is de baas over loon en contract — dat bestand hangt aan het
   loonbureau. Overtypen loopt scheef zodra er iets verandert, en dat zie je
   niet: in oktober 2026 stond bij vier van de twaalf mensen een verouderd
   uurloon.

   Er wordt niets vanzelf bijgewerkt. Je ziet wat er afwijkt, je vinkt aan wat
   mee mag, en pas dan gaat het de administratie in. */

function Bedrag({ veld, waarde }: { veld: Verschil['veld']; waarde: Verschil['nu'] }) {
  if (waarde === null || waarde === '') return <span className="text-muted">leeg</span>
  if (veld === 'uurloon') return <>€ {Number(waarde).toFixed(2).replace('.', ',')}</>
  if (veld === 'contracturen') return <>{Number(waarde)} uur</>
  return <>{waarde}</>
}

export function PersoneelBijwerken() {
  const { email } = useAuth()
  const personen = useLoongegevens()
  const overnemen = useVerschillenOvernemen()
  const kiezer = useRef<HTMLInputElement>(null)

  const [bestand, setBestand] = useState<Personeelsbestand | null>(null)
  const [bestandsnaam, setBestandsnaam] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [uit, setUit] = useState<Set<string>>(new Set())
  const [klaar, setKlaar] = useState(0)

  const vergelijking = useMemo(
    () => (bestand && personen.data ? vergelijk(bestand.regels, personen.data, email) : null),
    [bestand, personen.data, email],
  )

  const kenmerk = (v: Verschil) => `${v.persoonId}|${v.veld}`
  const gekozen = (vergelijking?.verschillen ?? []).filter((v) => !uit.has(kenmerk(v)))

  async function neemAan(gekozenBestand: File | undefined) {
    if (!gekozenBestand) return
    setFout(null)
    setBestand(null)
    setKlaar(0)
    setUit(new Set())
    setBezig(true)
    try {
      const werkboek = await leesWerkboek(await gekozenBestand.arrayBuffer())
      if (!isPersoneelsbestand(werkboek)) {
        throw new Error(
          'Dit lijkt geen personeelsbestand. Shifts en uren horen bij Rooster → Importeren.',
        )
      }
      const gelezen = leesPersoneel(werkboek)
      if (gelezen.regels.length === 0) throw new Error('In dit bestand staat niemand.')
      setBestand(gelezen)
      setBestandsnaam(gekozenBestand.name)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Dit bestand kon ik niet lezen.')
    } finally {
      setBezig(false)
    }
  }

  if (personen.isPending) return <Laden tekst="Personeel ophalen…" />
  if (personen.error)
    return <Mislukt tekst={personen.error.message} opnieuw={() => personen.refetch()} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/personeel"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Personeel
        </Link>
        <Kopje>Bijwerken uit eitje</Kopje>
      </div>

      <Kaart className="flex flex-col gap-3 p-5">
        <div>
          <p className="font-display text-lg">Personeelsbestand erin</p>
          <p className="mt-1 text-sm text-muted">
            Exporteer in eitje het <strong className="font-semibold text-text">Personeelsbestand</strong>{' '}
            en zet het hier neer. Eitje is de baas over loon en contract — dat hangt aan het
            loonbureau — dus wat daar staat is leidend. Er wordt niets vanzelf gewijzigd: je ziet
            eerst wat afwijkt.
          </p>
        </div>
        <input
          ref={kiezer}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => void neemAan(e.target.files?.[0] ?? undefined)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Knop soort="rustig" bezig={bezig} onClick={() => kiezer.current?.click()}>
            <Upload className="size-4" aria-hidden />
            Bestand kiezen
          </Knop>
          {bestandsnaam && <span className="text-sm text-muted">{bestandsnaam}</span>}
        </div>
        {fout && <p className="text-sm text-bad">{fout}</p>}
      </Kaart>

      {klaar > 0 && (
        <Kaart className="flex items-start gap-2 border-good p-4">
          <Check className="mt-0.5 size-5 shrink-0 text-good" aria-hidden />
          <p>
            {klaar === 1 ? 'Eén wijziging' : `${klaar} wijzigingen`} overgenomen. Je ziet ze terug
            op de persoonskaart.
          </p>
        </Kaart>
      )}

      {vergelijking && (
        <>
          {vergelijking.verschillen.length === 0 ? (
            <Kaart className="p-5">
              <p className="font-display text-lg">Alles komt overeen</p>
              <p className="mt-1 text-sm text-muted">
                {bestand?.regels.length} mensen in het bestand, geen verschillen met de app.
              </p>
            </Kaart>
          ) : (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="font-display text-lg">
                  {vergelijking.verschillen.length === 1
                    ? 'Eén verschil'
                    : `${vergelijking.verschillen.length} verschillen`}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Vink uit wat je niet wilt overnemen. De rest gaat zoals het in eitje staat.
                </p>
              </div>

              <Kaart className="flex flex-col py-2">
                {vergelijking.verschillen.map((v) => {
                  const sleutel = kenmerk(v)
                  const aan = !uit.has(sleutel)
                  return (
                    <label
                      key={sleutel}
                      className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={aan}
                        onChange={() =>
                          setUit((s) => {
                            const n = new Set(s)
                            if (aan) n.add(sleutel)
                            else n.delete(sleutel)
                            return n
                          })
                        }
                        className="mt-1 size-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{v.naam}</span>
                        <span className="block text-sm text-muted">
                          {VELDNAAM[v.veld]}: <Bedrag veld={v.veld} waarde={v.nu} /> wordt{' '}
                          <strong className="font-semibold text-text">
                            <Bedrag veld={v.veld} waarde={v.wordt} />
                          </strong>
                        </span>
                      </span>
                    </label>
                  )
                })}
              </Kaart>

              <div className="flex flex-wrap items-center gap-3">
                <Knop
                  bezig={overnemen.isPending}
                  disabled={gekozen.length === 0}
                  onClick={async () => {
                    await overnemen.mutateAsync(gekozen)
                    setKlaar(gekozen.length)
                    setBestand(null)
                    setBestandsnaam('')
                  }}
                >
                  {gekozen.length === 1 ? 'Eén wijziging overnemen' : `${gekozen.length} overnemen`}
                </Knop>
                {overnemen.error && (
                  <span className="text-sm text-bad">{overnemen.error.message}</span>
                )}
              </div>
            </section>
          )}

          {(vergelijking.onbekend.length > 0 || vergelijking.ontbreekt.length > 0) && (
            <Kaart className="flex flex-col gap-2 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
                Nog even nakijken
              </p>
              {vergelijking.onbekend.length > 0 && (
                <p className="text-sm text-muted">
                  In het bestand maar niet in de app:{' '}
                  {vergelijking.onbekend.map((r) => `${r.voornaam} ${r.achternaam}`).join(', ')}.
                  Die kun je bij Personeel toevoegen.
                </p>
              )}
              {vergelijking.ontbreekt.length > 0 && (
                <p className="text-sm text-muted">
                  In de app maar niet in het bestand:{' '}
                  {vergelijking.ontbreekt
                    .map((p) => [p.voornaam, p.achternaam].filter(Boolean).join(' '))
                    .join(', ')}
                  . Meestal betekent dat uit dienst, of dat ze buiten de geëxporteerde periode
                  vielen.
                </p>
              )}
            </Kaart>
          )}
        </>
      )}
    </div>
  )
}
