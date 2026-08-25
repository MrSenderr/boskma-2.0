import { useRef, useState } from 'react'
import { FileText, MessageSquare, Paperclip, Plus, Send, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import {
  SOORTEN,
  documentOpenen,
  soortLabel,
  useDocumentToevoegen,
  useDocumentWeggooien,
  useDocumenten,
  useVerslagDelen,
  useVerslagSchrijven,
  useVerslagWeggooien,
  useVerslagen,
  type Verslag,
} from '../lib/dossier'
import { korteDatum, type Persoon } from '../lib/personeel'

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

function Documenten({ persoon }: { persoon: Persoon }) {
  const { data } = useDocumenten(persoon.id)
  // De loonheffingsverklaring komt uit het invulformulier en staat in
  // onboarding_data. Hem hier tonen in plaats van kopiëren naar de
  // dossiertabel: dan is er één waarheid en kan het niet uit elkaar lopen.
  const verklaring = (persoon.onboarding_data as Record<string, unknown> | null)?.loonheffing_pdf
  const toevoegen = useDocumentToevoegen(persoon.id)
  const weggooien = useDocumentWeggooien()
  const invoerRef = useRef<HTMLInputElement>(null)
  const [soort, setSoort] = useState('contract')
  const [fout, setFout] = useState<string | null>(null)

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
            <Knop soort="rustig" onClick={() => documentOpenen(verklaring).catch((e) => setFout(e.message))}>
              Openen
            </Knop>
          </div>
        </Kaart>
      )}

      {(data ?? []).length > 0 && (
        <Kaart>
          {(data ?? []).map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
            >
              <FileText className="size-5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.naam}</span>
                <span className="block text-sm text-muted">
                  {soortLabel(d.soort)} — {korteDatum(d.toegevoegd_op)}
                </span>
              </span>
              <Knop soort="rustig" onClick={() => documentOpenen(d.pad).catch((e) => setFout(e.message))}>
                Openen
              </Knop>
              <button
                type="button"
                onClick={() => weggooien.mutate(d, { onError: (e) => setFout(e.message) })}
                aria-label={`${d.naam} weggooien`}
                className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-bad-soft hover:text-bad"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </Kaart>
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
          onChange={(e) => {
            const bestand = e.target.files?.[0]
            if (!bestand) return
            setFout(null)
            toevoegen.mutate(
              { bestand, soort },
              { onError: (err) => setFout(err.message) },
            )
            e.target.value = ''
          }}
        />
        <Knop soort="rustig" bezig={toevoegen.isPending} onClick={() => invoerRef.current?.click()}>
          <Paperclip className="size-4" aria-hidden />
          Bestand kiezen
        </Knop>
      </Kaart>
    </section>
  )
}

export function Dossier({ persoon }: { persoon: Persoon }) {
  const { data: verslagen } = useVerslagen(persoon.id)
  const delen = useVerslagDelen()
  const weggooien = useVerslagWeggooien()
  const [schrijven, setSchrijven] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const voornaam = persoon.voornaam ?? 'de medewerker'

  return (
    <div className="flex flex-col gap-6">
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

      <Documenten persoon={persoon} />
    </div>
  )
}
