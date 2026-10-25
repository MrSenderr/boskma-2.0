import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Kaart, Knop, Kopje } from './ui'
import { meldingenAan, meldingenStatus, meldingenUit, type Meldingstand } from '../lib/meldingen'

/* Meldingen aan- en uitzetten op dit apparaat.
 *
 * Waarom dit bestaat: een contractvoorstel heeft een datum waarop het antwoord
 * binnen moet zijn. Een mail kan een week blijven liggen; een melding op de
 * telefoon niet. Maar het moet wel zijn eigen keuze zijn, en per apparaat —
 * daarom een schakelaar hier en geen vraag die opduikt.
 *
 * De mail blijft altijd gaan. Dit is de tik op de schouder, niet het bericht. */

const TEKST: Record<Meldingstand, string> = {
  aan: 'Meldingen staan aan op dit apparaat.',
  uit: 'Je krijgt op dit apparaat nog geen meldingen.',
  geweigerd:
    'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon of browser, en kom dan terug.',
  'niet-ondersteund':
    'Dit apparaat kan geen meldingen ontvangen. Op iPhone: zet de app via Deel → Zet op beginscherm, en open hem vanaf dat icoon.',
}

export function MeldingSchakelaar() {
  const [stand, setStand] = useState<Meldingstand | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    meldingenStatus().then(setStand)
  }, [])

  // Bewust in de klik: iOS weigert de toestemmingsvraag als die niet
  // rechtstreeks uit een tik van de gebruiker komt.
  async function zet(aan: boolean) {
    setBezig(true)
    setFout(null)
    try {
      setStand(aan ? await meldingenAan() : await meldingenUit())
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Dat lukte niet.')
      setStand(await meldingenStatus())
    } finally {
      setBezig(false)
    }
  }

  if (stand === null) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Meldingen</Kopje>
      <Kaart className="flex flex-col gap-3 p-4">
        <p className="flex items-start gap-2">
          <Bell className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <span>{TEKST[stand]}</span>
        </p>
        {fout && <p className="text-sm text-bad">{fout}</p>}
        {stand === 'uit' && (
          <>
            <Knop className="w-fit" bezig={bezig} onClick={() => zet(true)}>
              Meldingen aanzetten
            </Knop>
            <p className="text-sm text-muted">
              Je krijgt dan een melding als er iets is waar je iets mee moet, zoals een voorstel
              over je contract. Je krijgt het altijd ook per mail.
            </p>
          </>
        )}
        {stand === 'aan' && (
          <button
            type="button"
            className="w-fit text-sm text-muted underline hover:text-text"
            disabled={bezig}
            onClick={() => zet(false)}
          >
            meldingen uitzetten
          </button>
        )}
      </Kaart>
    </section>
  )
}
