import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileText, Send } from 'lucide-react'
import { Kaart, Knop, Kopje } from './ui'
import {
  euro,
  haalPdf,
  herinneringstekst,
  standaardMailtekst,
  useVersturen,
  useVolgendNummer,
  verwachteVervaldatum,
  type Klant,
  type Verkoopfactuur,
} from '../lib/verkoop'
import { useTestmodus } from '../lib/instellingen'

/* Het bevestigingsscherm voor het versturen.
 *
 * Niets gaat de deur uit zonder dat je hebt gezien wat eruit gaat: naar wie,
 * met welke tekst en met welke pdf. Wat hier in het tekstvak staat is ook
 * letterlijk wat de klant leest. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

export function Versturen({
  factuur,
  klant,
  melden,
  onKlaar,
  herinnering = false,
}: {
  factuur: Verkoopfactuur
  klant: Klant | undefined
  melden: (t: string) => void
  onKlaar: () => void
  /** Dezelfde factuur nog een keer, met een andere aanhef. */
  herinnering?: boolean
}) {
  const { data: testmodus } = useTestmodus()
  const versturen = useVersturen()
  const [open, setOpen] = useState(herinnering)
  const [proef, setProef] = useState(false)
  const [pdfBezig, setPdfBezig] = useState(false)

  /* Het nummer en de vervaldatum krijgt de factuur pas bij het versturen. In
     het voorbeeld moet wel staan wat de klant straks leest, dus rekenen we ze
     hier uit: het eerstvolgende nummer, en vandaag plus de betaaltermijn. */
  const { data: volgend } = useVolgendNummer()
  const nummerTekst = proef
    ? `TEST-${factuur.nummer ?? factuur.id}`
    : String(factuur.nummer ?? volgend ?? '…')
  const alsVerstuurd = {
    ...factuur,
    vervaldatum:
      factuur.vervaldatum ?? (klant ? verwachteVervaldatum(klant.betaaltermijn_dagen) : null),
  }

  const [tekst, setTekst] = useState('')
  const opgesteld = useRef(false)
  useEffect(() => {
    // Eén keer opstellen, en daarna niet meer overschrijven: wat jij erin typt
    // moet blijven staan.
    if (opgesteld.current || !klant || (!volgend && !factuur.nummer)) return
    opgesteld.current = true
    setTekst(
      herinnering
        ? herinneringstekst(klant, factuur)
        : standaardMailtekst(klant, alsVerstuurd, nummerTekst),
    )
  }, [klant, volgend, herinnering, factuur, alsVerstuurd, nummerTekst])

  const testAan = testmodus?.aan === true
  const gaatNaar = proef || testAan ? (testmodus?.adres ?? 'je testadres') : klant?.factuur_email

  if (!klant?.factuur_email) {
    return (
      <p className="text-sm text-bad">
        Deze klant heeft geen factuuradres. Vul dat eerst in bij Klanten.
      </p>
    )
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" onClick={() => setOpen(true)}>
          <Send className="size-4" aria-hidden />
          Versturen
        </Knop>
        <Knop
          soort="rustig"
          onClick={() => {
            setProef(true)
            setOpen(true)
          }}
        >
          Test naar mezelf
        </Knop>
      </div>
    )
  }

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Kopje>
        {herinnering ? 'Herinnering sturen' : proef ? 'Testfactuur versturen' : 'Factuur versturen'}
      </Kopje>

      {(proef || testAan) && (
        <p className="flex items-start gap-2 rounded-[4px] border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {proef
            ? `Dit is een proef. Alles gaat naar ${gaatNaar}, de factuur krijgt geen nummer en blijft een concept.`
            : `Testmodus staat aan. Alles gaat naar ${gaatNaar} en er wordt geen nummer uitgedeeld.`}
        </p>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="text-muted">Aan: </span>
          <span className="font-medium">{gaatNaar}</span>
          {!proef && !testAan && klant.cc_email && (
            <span className="text-muted"> · kopie naar {klant.cc_email}</span>
          )}
        </p>
        <p>
          <span className="text-muted">Onderwerp: </span>
          <span className="font-medium">
            {proef || testAan ? '[TEST] ' : ''}
            {herinnering ? 'Herinnering: factuur' : 'Factuur'} {nummerTekst} — Snackerie
            &apos;t Zonnetje
          </span>
        </p>
        <p>
          <span className="text-muted">Bedrag: </span>
          <span className="font-medium tabular-nums">{euro(Number(factuur.totaal_incl))}</span>
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Mailtekst</span>
        <textarea
          className={`${invoer} min-h-48`}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
        />
      </label>

      <Knop
        soort="rustig"
        className="w-fit"
        bezig={pdfBezig}
        onClick={async () => {
          setPdfBezig(true)
          try {
            const blob = await haalPdf(factuur.id, proef ? 'test' : 'concept')
            window.open(URL.createObjectURL(blob), '_blank')
          } catch (e) {
            melden(e instanceof Error ? e.message : 'De pdf maken lukte niet.')
          } finally {
            setPdfBezig(false)
          }
        }}
      >
        <FileText className="size-4" aria-hidden />
        Bekijk de bijlage
      </Knop>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Knop
          soort="primair"
          bezig={versturen.isPending}
          onClick={() =>
            versturen.mutate(
              { id: factuur.id, tekst, test: proef, herinnering },
              {
                onSuccess: (uit) => {
                  melden(
                    uit.test
                      ? `Testfactuur verstuurd naar ${uit.verstuurd_naar}. Er is geen nummer uitgedeeld.`
                      : `Factuur ${uit.nummer} verstuurd naar ${uit.verstuurd_naar}.`,
                  )
                  onKlaar()
                },
                onError: (e) => melden(e instanceof Error ? e.message : 'Versturen lukte niet.'),
              },
            )
          }
        >
          <Send className="size-4" aria-hidden />
          {proef ? 'Ja, stuur de test' : 'Ja, versturen'}
        </Knop>
        <Knop soort="rustig" onClick={() => { setOpen(false); setProef(false) }}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}
