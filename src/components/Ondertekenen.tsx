import { useState } from 'react'
import { Check, FileSignature, Send } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { Krabbel } from './Krabbel'
import { DocumentLink } from './DocumentLink'
import { korteDatum, type Persoon } from '../lib/personeel'
import { useDocumenten } from '../lib/dossier'
import {
  STANDNAAM,
  codeKort,
  ouderNodig,
  standVan,
  useOndertekeningAfmaken,
  useOndertekeningIntrekken,
  useOndertekeningStarten,
  useOndertekeningVersturen,
  useOndertekeningen,
  useWerkgeverTekent,
  type Ondertekening,
} from '../lib/ondertekenen'

/* Digitaal tekenen, aan Sanders kant.
 *
 * Vier stappen, en elke stap is één knop: klaarzetten bij een contract in het
 * dossier, naar de medewerker sturen, meetekenen als hij heeft getekend, en
 * afmaken. Dat laatste maakt de getekende PDF en stuurt hem meteen naar het
 * loonbureau — dezelfde weg als bij een gescand contract.
 *
 * De volgorde ligt vast: de medewerker tekent, Sander tekent mee. Een contract
 * dat alleen de werkgever heeft getekend is geen contract maar een aanbod, en
 * de database houdt die volgorde ook tegen.
 *
 * Papier blijft kunnen. Printen, tekenen, scannen en uploaden als getekend
 * contract loopt hier langsheen en werkt zoals het werkte. */

const STAND_KLEUR = {
  klaargezet: 'neutraal',
  bij_medewerker: 'letop',
  jouw_beurt: 'letop',
  afmaken: 'letop',
  klaar: 'goed',
  ingetrokken: 'neutraal',
} as const

function Meetekenen({ o, persoon }: { o: Ondertekening; persoon: Persoon }) {
  const teken = useWerkgeverTekent(persoon.id)
  const [naam, setNaam] = useState('Sander Boskma')
  const [krabbel, setKrabbel] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      {/* Wie wanneer heeft getekend staat hierboven al in de tijdlijn; hier
          alleen wat er nu moet gebeuren. */}
      <p className="text-sm text-muted">Nu jij.</p>
      {fout && <p className="text-sm text-bad">{fout}</p>}
      <Veld label="Je naam voluit" value={naam} onChange={(e) => setNaam(e.target.value)} />
      <Krabbel waarde={krabbel} onVeranderd={setKrabbel} label="Je handtekening (hoeft niet)" />
      <Knop
        bezig={teken.isPending}
        disabled={naam.trim().length < 2}
        className="w-fit"
        onClick={() =>
          teken.mutate({ id: o.id, naam, krabbel }, { onError: (e) => setFout(e.message) })
        }
      >
        <Check className="size-4" aria-hidden />
        Meetekenen
      </Knop>
    </div>
  )
}

function Regel({ o, persoon }: { o: Ondertekening; persoon: Persoon }) {
  const versturen = useOndertekeningVersturen(persoon.id)
  const afmaken = useOndertekeningAfmaken(persoon.id)
  const intrekken = useOndertekeningIntrekken(persoon.id)
  const [melding, setMelding] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const stand = standVan(o)

  return (
    <div className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{o.origineel_naam}</span>
          <Pil soort={STAND_KLEUR[stand]}>{STANDNAAM[stand]}</Pil>
        </span>
        <span className="text-sm text-muted">{korteDatum(o.gestart_op)}</span>
      </div>

      {/* De tijdlijn: alleen wat er is. */}
      {o.verstuurd_op && (
        <p className="mt-0.5 text-sm text-muted">
          Verstuurd {korteDatum(o.verstuurd_op)}
          {o.geopend_op ? ` · gezien ${korteDatum(o.geopend_op)}` : ' · nog niet gezien'}
        </p>
      )}
      {o.medewerker_op && (
        <p className="mt-0.5 text-sm">
          {o.medewerker_naam} getekend op {korteDatum(o.medewerker_op)}
          {o.medewerker_krabbel ? ' (met handtekening)' : ' (met naam)'}
        </p>
      )}
      {o.ouder_naam && (
        <p className="mt-0.5 text-sm">
          {o.ouder_naam}
          {o.ouder_relatie ? ` (${o.ouder_relatie})` : ''} meegetekend op {korteDatum(o.ouder_op)}
        </p>
      )}
      {o.werkgever_op && (
        <p className="mt-0.5 text-sm">
          {o.werkgever_naam} getekend op {korteDatum(o.werkgever_op)}
        </p>
      )}
      {o.ingetrokken_op && (
        <p className="mt-0.5 text-sm text-muted">
          Ingetrokken op {korteDatum(o.ingetrokken_op)}
          {o.ingetrokken_reden ? ` — ${o.ingetrokken_reden}` : ''}
        </p>
      )}

      <p className="mt-1 break-all text-sm text-muted">
        Controlecode: <span className="font-mono">{codeKort(o.origineel_sha256)}</span>
      </p>

      {melding && <p className="mt-2 text-sm text-muted">{melding}</p>}
      {fout && <p className="mt-2 text-sm text-bad">{fout}</p>}

      {stand === 'jouw_beurt' && <Meetekenen o={o} persoon={persoon} />}

      {!o.ingetrokken_op && !o.afgerond_op && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {stand === 'klaargezet' && (
            <Knop
              bezig={versturen.isPending}
              onClick={() =>
                versturen.mutate(o, {
                  onSuccess: (uit) =>
                    setMelding(
                      uit.testmodus
                        ? `Testmodus staat aan: de mail ging naar ${uit.verstuurd_naar}.`
                        : 'Verstuurd. Hij krijgt een mail en, als hij meldingen aan heeft, een melding op zijn telefoon.',
                    ),
                  onError: (e) => setFout(e.message),
                })
              }
            >
              <Send className="size-4" aria-hidden />
              Naar de medewerker
            </Knop>
          )}
          {stand === 'afmaken' && (
            <Knop
              bezig={afmaken.isPending}
              onClick={() =>
                afmaken.mutate(o, {
                  onSuccess: (uit) => {
                    setFout(uit.verstuurFout)
                    setMelding(
                      uit.verstuurFout
                        ? 'Het getekende contract staat in het dossier. Het versturen naar het loonbureau lukte niet; dat kun je daar alsnog doen.'
                        : uit.verstuurd?.testmodus
                          ? `Getekend. Testmodus staat aan: de mail ging naar ${uit.verstuurd.verstuurd_naar}, niet naar het loonbureau.`
                          : 'Getekend contract gemaakt en naar het loonbureau gestuurd.',
                    )
                  },
                  onError: (e) => setFout(e.message),
                })
              }
            >
              <Check className="size-4" aria-hidden />
              Afmaken en naar het loonbureau
            </Knop>
          )}
          <button
            type="button"
            className="text-sm text-muted underline hover:text-text"
            onClick={() => intrekken.mutate({ id: o.id })}
          >
            intrekken
          </button>
        </div>
      )}

      {o.afgerond_op && (
        <p className="mt-1 text-sm text-muted">
          Het getekende contract staat bij de documenten hierboven.
        </p>
      )}
    </div>
  )
}

export function Ondertekenen({ persoon }: { persoon: Persoon }) {
  const { data: ondertekeningen } = useOndertekeningen(persoon.id)
  const { data: documenten } = useDocumenten(persoon.id)
  const starten = useOndertekeningStarten(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  if (!ondertekeningen || !documenten) return null

  /* Contracten die klaarstaan om getekend te worden: nog geldig, en er loopt
     nog geen ondertekening voor. */
  const bezet = new Set(
    ondertekeningen.filter((o) => !o.ingetrokken_op).map((o) => o.document_id),
  )
  const teTekenen = documenten.filter(
    (d) => d.soort === 'contract' && !d.vervallen_op && !bezet.has(d.id),
  )

  if (ondertekeningen.length === 0 && teTekenen.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Tekenen</Kopje>

      {fout && <p className="text-sm text-bad">{fout}</p>}

      {ondertekeningen.length > 0 && (
        <Kaart className="flex flex-col py-2">
          {ondertekeningen.map((o) => (
            <Regel key={o.id} o={o} persoon={persoon} />
          ))}
        </Kaart>
      )}

      {teTekenen.map((d) => (
        <Kaart key={d.id} className="flex flex-col gap-3 p-4">
          <p className="flex flex-wrap items-center gap-2">
            <FileSignature className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="font-semibold">{d.naam}</span>
            <span className="text-sm text-muted">staat klaar maar is nog niet getekend</span>
          </p>
          <DocumentLink pad={d.pad}>Openen</DocumentLink>
          <div className="flex flex-wrap items-center gap-2">
            <Knop
              soort="rustig"
              bezig={starten.isPending}
              onClick={() =>
                starten.mutate(
                  { persoon, document: { id: d.id, naam: d.naam, sha256: d.sha256 } },
                  { onError: (e) => setFout(e.message) },
                )
              }
            >
              Laten tekenen
            </Knop>
            {ouderNodig(persoon) && (
              <span className="text-sm text-muted">
                Nog geen 18 — er komt een vak bij voor een ouder of verzorger.
              </span>
            )}
          </div>
        </Kaart>
      ))}
    </section>
  )
}
