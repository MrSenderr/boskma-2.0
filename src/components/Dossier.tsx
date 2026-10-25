import { useRef, useState } from 'react'
import { Archive, FileText, MessageSquare, Paperclip, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import {
  SOORTEN,
  leesbareGrootte,
  soortLabel,
  splitsDocumenten,
  useDocumentLatenVervallen,
  useDocumentTerughalen,
  useDocumentToevoegen,
  useDocumenten,
  useVerslagDelen,
  useVerslagSchrijven,
  useVerslagWeggooien,
  useVerslagen,
  type Document,
  type Verslag,
} from '../lib/dossier'
import { korteDatum, type Persoon } from '../lib/personeel'
import { DocumentLink } from './DocumentLink'
import { AARDNAAM, useVoorstellen } from '../lib/contractvoorstellen'
import { useVoorstelAfronden, voorstelVoorContract } from '../lib/afronden'
import { lopendContract, useContracten } from '../lib/contracten'
import {
  uitkomstTekst,
  useGetekendAfgetekend,
  useGetekendVersturen,
} from '../lib/getekendContract'
import { useLoonbureauAdres } from '../lib/instellingen'

/* Het dossier zoals Sander het ziet. Zie
   docs/modules/personeel/personeelsmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

export function staatVan(v: Verslag): { soort: 'goed' | 'letop' | 'fout' | 'neutraal'; label: string } {
  if (!v.gedeeld_op) return { soort: 'neutraal', label: 'Privé' }
  if (v.reactie === 'akkoord') return { soort: 'goed', label: 'Akkoord' }
  if (v.reactie === 'niet_akkoord') return { soort: 'fout', label: 'Niet akkoord' }
  if (v.gelezen_op) return { soort: 'neutraal', label: 'Gelezen' }
  return { soort: 'letop', label: 'Gedeeld, nog niet gelezen' }
}

function vandaag() {
  return new Date().toLocaleDateString('sv-SE')
}

function Schrijven({ persoon, sluiten }: { persoon: Persoon; sluiten: () => void }) {
  const schrijven = useVerslagSchrijven(persoon.id)
  const [titel, setTitel] = useState('')
  const [tekst, setTekst] = useState('')
  const [datum, setDatum] = useState(vandaag())
  const [delen, setDelen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const voornaam = persoon.voornaam ?? 'de medewerker'
  const kan = titel.trim().length > 0 && tekst.trim().length > 0

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Veld
        label="Waar ging het over"
        placeholder="Functioneringsgesprek"
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
      />
      <Veld
        label="Datum van het gesprek"
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="verslag-tekst" className="text-sm font-semibold text-muted">
          Het verslag
        </label>
        <textarea
          id="verslag-tekst"
          rows={8}
          className={invoer}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder="Wat is er besproken en wat is er afgesproken?"
        />
      </div>

      <label className="flex items-start gap-3 rounded-[4px] bg-surface-2 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-[#003A41]"
          checked={delen}
          onChange={(e) => setDelen(e.target.checked)}
        />
        <span>
          Meteen delen met {voornaam}
          <span className="mt-0.5 block text-muted">
            Zonder vinkje blijft het verslag privé en kun je het later alsnog delen.
            Wat gedeeld is, blijft staan.
          </span>
        </span>
      </label>

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Knop
          soort="primair"
          bezig={schrijven.isPending}
          disabled={!kan}
          onClick={() =>
            schrijven.mutate(
              { titel, tekst, gesprek_op: datum, delen },
              { onSuccess: sluiten, onError: (e) => setFout(e.message) },
            )
          }
        >
          Bewaren
        </Knop>
        <Knop soort="rustig" onClick={sluiten}>
          Annuleren
        </Knop>
      </div>
    </Kaart>
  )
}

/* Eén document in de lijst.
 *
 * De naam krijgt een ondergrens in breedte. Zonder die grens duwen de knoppen
 * hem in een smalle kolom samen tot "Personee…" terwijl de regel eronder per
 * woord afbreekt; dan is er veel inkt en weinig informatie. Met de grens wijken
 * de knoppen naar de volgende regel, en dat leest wél.
 *
 * Een formulier hoort niet tússen de naam en de knoppen maar eronder, over de
 * volle breedte. Daar is `blok` voor; `onder` blijft voor losse regeltjes onder
 * de naam, zoals de stand bij het loonbureau. */
function Regel({
  doc,
  vervallen,
  actie,
  onder,
  blok,
}: {
  doc: Document
  vervallen?: boolean
  actie: React.ReactNode
  /** Een extra regel onder de naam, zoals de stand bij het loonbureau. */
  onder?: React.ReactNode
  /** Een blok over de volle breedte onder de regel, zoals een formulier. */
  blok?: React.ReactNode
}) {
  const grootte = leesbareGrootte(doc.bytes)
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileText
          className={`size-5 shrink-0 ${vervallen ? 'text-muted/60' : 'text-muted'}`}
          aria-hidden
        />
        <span className="min-w-[11rem] flex-1">
          <span
            className={`block truncate font-medium ${vervallen ? 'text-muted line-through' : ''}`}
          >
            {doc.naam}
          </span>
          <span className="block text-sm text-muted">
            {soortLabel(doc.soort)} — {korteDatum(doc.toegevoegd_op)}
            {grootte ? ` — ${grootte}` : ''}
            {vervallen && doc.vervallen_op ? ` — vervallen op ${korteDatum(doc.vervallen_op)}` : ''}
          </span>
          {doc.notitie && <span className="block text-sm text-muted">{doc.notitie}</span>}
          {onder}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          <DocumentLink pad={doc.pad}>Openen</DocumentLink>
          {actie}
        </span>
      </div>
      {blok}
    </div>
  )
}

export function Documenten({ persoon }: { persoon: Persoon }) {
  const { data } = useDocumenten(persoon.id)
  // De loonheffingsverklaring komt uit het invulformulier en staat in
  // onboarding_data. Hem hier tonen in plaats van kopiëren naar de
  // dossiertabel: dan is er één waarheid en kan het niet uit elkaar lopen.
  const verklaring = (persoon.onboarding_data as Record<string, unknown> | null)?.loonheffing_pdf
  const { actueel, vervallen } = splitsDocumenten(data)
  const toevoegen = useDocumentToevoegen(persoon.id)
  const { data: voorstellen } = useVoorstellen(persoon.id)
  const { data: contracten } = useContracten(persoon.id)
  const afronden = useVoorstelAfronden(persoon.id)
  const voorstel = voorstelVoorContract(voorstellen ?? [])
  const latenVervallen = useDocumentLatenVervallen()
  const terughalen = useDocumentTerughalen()
  const versturen = useGetekendVersturen()
  const invoerRef = useRef<HTMLInputElement>(null)
  const [soort, setSoort] = useState('contract')
  /* Een net geüpload getekend contract waarvan nog niet gezegd is bij welk
     voorstel het hoort. */
  const [koppelen, setKoppelen] = useState<number | null>(null)
  /* Bij welk document je bezig bent met "al verstuurd", en op welke dag. */
  const [afgetekend, setAfgetekend] = useState<number | null>(null)
  const [datum, setDatum] = useState(vandaag())
  const aftekenen = useGetekendAfgetekend()
  const { data: loonbureauAdres } = useLoonbureauAdres()
  const [toonVervallen, setToonVervallen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  // Stelt het loonbureau het contract op, dan gaat de getekende versie terug.
  /* Twee verschillende vragen, die tot 25 oktober 2026 aan dezelfde vlag
     hingen.
     
     "Verwacht het loonbureau dit terug?" — alleen als zij het contract hebben
     opgesteld. Daar hangt het rode seintje aan en de telling op het
     startscherm.
     
     "Mag ik het versturen?" — altijd. Een getekend arbeidscontract is voor de
     loonadministratie van belang, wie het ook heeft getypt. Dat die twee aan
     één vlag hingen betekende dat je bij Evi Dudink een getekend contract kon
     uploaden en daarna helemaal niets kreeg: geen knop, geen melding, geen
     uitleg waarom niet. */
  const verwachtTerug = Boolean(persoon.contract_door_loonbureau)

  function stuur(documentId: number, naUpload = false) {
    setFout(null)
    setMelding(null)
    versturen.mutate(documentId, {
      onSuccess: (r) => setMelding(uitkomstTekst(r)),
      onError: (e) =>
        setFout(
          naUpload
            ? `Geüpload, maar naar het loonbureau sturen lukte niet: ${e.message}. Probeer het hieronder opnieuw.`
            : e.message,
        ),
    })
  }

  function afgetekendRegel(d: Document) {
    if (afgetekend !== d.id) return null
    return (
      /* Een eigen blok onder de regel, met de vraag boven het veld. In een
         smalle kolom zakken de knoppen onder de datum in plaats van ernaast te
         worden geperst. */
      <div className="flex flex-col gap-3 rounded-[4px] bg-surface-2 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted">
            Wanneer heb je hem verstuurd?
          </span>
          <input
            type="date"
            value={datum}
            max={vandaag()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatum(e.target.value)}
            className="w-full max-w-[12rem] rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-2">
        <Knop
          bezig={aftekenen.isPending}
          onClick={() =>
            aftekenen.mutate(
              { documentId: d.id, op: datum, adres: loonbureauAdres ?? 'info@lbwf.nl' },
              {
                onSuccess: () => {
                  setAfgetekend(null)
                  setMelding('Genoteerd als al verstuurd. De app heeft niets gemaild.')
                },
                onError: (e) => setFout(e.message),
              },
            )
          }
        >
          Vastleggen
        </Knop>
        <Knop soort="rustig" onClick={() => setAfgetekend(null)}>
          Toch niet
        </Knop>
        </div>
      </div>
    )
  }

  function loonbureauRegel(d: Document) {
    if (d.soort !== 'contract_getekend') return null
    if (d.naar_loonbureau_op) {
      return (
        <span className="mt-1 block">
          <Pil soort="goed">Naar loonbureau {korteDatum(d.naar_loonbureau_op)}</Pil>
        </span>
      )
    }
    return (
      <span className="mt-1 flex flex-wrap items-center gap-2">
        {/* Rood alleen als ze het terugverwachten; anders is het geen verzuim
            maar een keuze die je zelf hebt gemaakt. */}
        <Pil soort={verwachtTerug ? 'fout' : 'neutraal'}>
          {verwachtTerug ? 'Nog niet naar loonbureau' : 'Niet naar het loonbureau gestuurd'}
        </Pil>
        {d.naar_loonbureau_fout && <span className="text-sm text-bad">{d.naar_loonbureau_fout}</span>}
      </span>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Documenten</Kopje>

      {typeof verklaring === 'string' && verklaring.length > 0 && (
        <Kaart>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <FileText className="size-5 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">Loonheffingsverklaring</span>
              <span className="block text-sm text-muted">
                Ondertekend bij het invulformulier
                {persoon.onboarding_ingevuld_op ? ` op ${korteDatum(persoon.onboarding_ingevuld_op)}` : ''}
              </span>
            </span>
            <DocumentLink pad={verklaring}>Openen</DocumentLink>
          </div>
        </Kaart>
      )}

      {actueel.length > 0 && (
        <Kaart>
          {actueel.map((d) => (
            <Regel
              key={d.id}
              doc={d}
              onder={loonbureauRegel(d)}
              blok={afgetekendRegel(d)}
              actie={
                <>
                {d.soort === 'contract_getekend' && !d.naar_loonbureau_op && (
                  <>
                    <Knop soort="primair" bezig={versturen.isPending} onClick={() => stuur(d.id)}>
                      <Send className="size-4" aria-hidden />
                      Naar loonbureau
                    </Knop>
                    {/* Heb je hem zelf al gemaild, dan hoeft de app hem niet
                        nog een keer te sturen — dan krijgt het loonbureau
                        hetzelfde contract twee keer. */}
                    {afgetekend !== d.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setAfgetekend(d.id)
                          setDatum(vandaag())
                          setFout(null)
                          setMelding(null)
                        }}
                        className="text-sm text-muted underline hover:text-text"
                      >
                        al verstuurd
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    latenVervallen.mutate({ doc: d }, { onError: (e) => setFout(e.message) })
                  }
                  aria-label={`${d.naam} laten vervallen`}
                  title="Laten vervallen — het bestand blijft bewaard"
                  className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2"
                >
                  <Archive className="size-4" aria-hidden />
                </button>
                </>
              }
            />
          ))}
        </Kaart>
      )}

      {melding && (
        <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">{melding}</p>
      )}

      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      <Kaart className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-[10rem] flex-col gap-1.5">
          <label htmlFor="doc-soort" className="text-sm font-semibold text-muted">
            Wat voor document
          </label>
          <select
            id="doc-soort"
            className={invoer}
            value={soort}
            onChange={(e) => setSoort(e.target.value)}
          >
            {SOORTEN.map((s) => (
              <option key={s.waarde} value={s.waarde}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={invoerRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const bestand = e.target.files?.[0]
            if (!bestand) return
            setFout(null)
            setMelding(null)
            toevoegen.mutate(
              { bestand, soort },
              {
                onError: (err) => setFout(err.message),
                // Een getekend contract dat het loonbureau opstelde gaat
                // meteen terug; daar hoef je niet nog eens aan te denken.
                onSuccess: (id) => {
                  /* Alleen vanzelf versturen als ze het terugverwachten. Een
                     contract dat jij zelf opstelde hoort niet buiten je om de
                     deur uit te gaan. */
                  if (soort === 'contract_getekend' && verwachtTerug) stuur(id, true)
                  /* Een getekend contract dat op papier binnenkomt hoort net zo
                     goed in de contractgeschiedenis als een dat in de app is
                     getekend. Anders blijft de app rekenen met het contract dat
                     eronder lag, en dat merk je pas bij de volgende
                     aanzegtermijn. */
                  if (soort === 'contract_getekend' && voorstel) setKoppelen(id)
                },
              },
            )
            e.target.value = ''
          }}
        />
        <Knop soort="rustig" bezig={toevoegen.isPending} onClick={() => invoerRef.current?.click()}>
          <Paperclip className="size-4" aria-hidden />
          Bestand kiezen
        </Knop>

        {koppelen !== null && voorstel && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p>
              Hoort dit getekende contract bij het voorstel van{' '}
              {korteDatum(voorstel.opgesteld_op)} ({AARDNAAM[voorstel.aard]})? Dan zet ik het
              afgesprokene meteen in de contractgeschiedenis.
            </p>
            <div className="flex flex-wrap gap-2">
              <Knop
                bezig={afronden.isPending}
                onClick={() =>
                  afronden.mutate(
                    {
                      voorstel,
                      lopend: lopendContract(contracten ?? []),
                      documentId: koppelen,
                    },
                    {
                      onSuccess: (a) => {
                        setKoppelen(null)
                        setMelding(
                          a.wat === 'nieuw'
                            ? 'Het nieuwe contract staat in de geschiedenis.'
                            : a.wat === 'bijwerken'
                              ? 'De vaste uren staan bij het lopende contract.'
                              : a.reden,
                        )
                      },
                      onError: (e) => setFout(e.message),
                    },
                  )
                }
              >
                Ja, leg het vast
              </Knop>
              <Knop soort="rustig" onClick={() => setKoppelen(null)}>
                Nee, laat maar
              </Knop>
            </div>
          </div>
        )}
      </Kaart>

      {vervallen.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            data-touch
            onClick={() => setToonVervallen((aan) => !aan)}
            className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-muted hover:text-fg"
          >
            <Archive className="size-4" aria-hidden />
            {toonVervallen ? 'Vervallen documenten verbergen' : `Vervallen documenten (${vervallen.length})`}
          </button>

          {toonVervallen && (
            <Kaart>
              {vervallen.map((d) => (
                <Regel
                  key={d.id}
                  doc={d}
                  vervallen
                  actie={
                    <button
                      type="button"
                      onClick={() => terughalen.mutate(d, { onError: (e) => setFout(e.message) })}
                      aria-label={`${d.naam} terughalen`}
                      title="Weer als actueel aanmerken"
                      className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                    </button>
                  }
                />
              ))}
            </Kaart>
          )}
        </div>
      )}
    </section>
  )
}

/* Gespreksverslagen en documenten zijn tot 25 oktober 2026 samen als "Dossier"
   onder de pagina gehangen. Dat las als een aanhangsel: een band over de volle
   breedte onder twee kolommen, waar je al voorbij was gescrold.
   
   Het zijn ook twee verschillende dingen. Een verslag schríjf je, meestal
   meteen na een gesprek — dat hoort bij het werk. Documenten zóek je op. Ze
   staan nu elk in de kolom waar ze bij horen, en het woord "Dossier" is
   daarmee overbodig geworden: de twee kopjes zeggen het zelf. */
export function Gespreksverslagen({ persoon }: { persoon: Persoon }) {
  const { data: verslagen } = useVerslagen(persoon.id)
  const delen = useVerslagDelen()
  const weggooien = useVerslagWeggooien()
  const [schrijven, setSchrijven] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const voornaam = persoon.voornaam ?? 'de medewerker'

  return (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Kopje>Gespreksverslagen</Kopje>
          {!schrijven && (
            <Knop soort="rustig" onClick={() => setSchrijven(true)}>
              <Plus className="size-4" aria-hidden />
              Verslag schrijven
            </Knop>
          )}
        </div>

        {schrijven && <Schrijven persoon={persoon} sluiten={() => setSchrijven(false)} />}

        {fout && (
          <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
        )}

        {(verslagen ?? []).length === 0 && !schrijven && (
          <Kaart className="p-5">
            <p className="text-sm text-muted">
              Nog geen verslagen. Handig na een functioneringsgesprek of een
              afspraak die je wilt vastleggen.
            </p>
          </Kaart>
        )}

        {(verslagen ?? []).map((v) => {
          const staat = staatVan(v)
          return (
            <Kaart key={v.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <MessageSquare className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="font-display text-lg">{v.titel}</span>
                <Pil soort={staat.soort}>{staat.label}</Pil>
              </div>
              <p className="text-sm text-muted">Gesprek op {korteDatum(v.gesprek_op)}</p>
              <p className="whitespace-pre-wrap">{v.tekst}</p>

              {v.reactie === 'niet_akkoord' && (
                <div className="rounded-[4px] border border-bad bg-bad-soft p-3">
                  <p className="text-sm font-semibold text-bad">
                    {voornaam} is het er niet mee eens
                  </p>
                  {v.opmerking && <p className="mt-1 whitespace-pre-wrap text-sm">{v.opmerking}</p>}
                </div>
              )}
              {v.reactie === 'akkoord' && v.opmerking && (
                <p className="whitespace-pre-wrap rounded-[4px] bg-surface-2 p-3 text-sm">
                  {v.opmerking}
                </p>
              )}

              {v.gedeeld_op ? (
                <p className="text-sm text-muted">
                  Gedeeld op {korteDatum(v.gedeeld_op)}
                  {v.gelezen_op ? ` — gelezen op ${korteDatum(v.gelezen_op)}` : ' — nog niet geopend'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Knop
                    soort="primair"
                    bezig={delen.isPending}
                    onClick={() => delen.mutate(v.id, { onError: (e) => setFout(e.message) })}
                  >
                    <Send className="size-4" aria-hidden />
                    Delen met {voornaam}
                  </Knop>
                  <Knop
                    soort="gevaar"
                    onClick={() => weggooien.mutate(v.id, { onError: (e) => setFout(e.message) })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Weggooien
                  </Knop>
                </div>
              )}
            </Kaart>
          )
        })}
      </section>
  )
}
