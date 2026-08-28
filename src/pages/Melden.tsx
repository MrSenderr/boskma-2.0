import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, Check, MessageSquareWarning, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Pil } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { toonNaam } from '../lib/personeel'
import { useApparaten } from '../lib/apparaten'
import { SOORTEN, soortLabel, useMelden, useOpenMeldingen, type Soort } from '../lib/meldingen'

/* Melden vanuit de zaak. Zie docs/Modules/meldingen.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function wanneer(datum: string) {
  const d = new Date(datum)
  const vandaag = new Date().toLocaleDateString('sv-SE')
  const dag = d.toLocaleDateString('sv-SE')
  const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  if (dag === vandaag) return `vandaag ${tijd}`
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }) + ` ${tijd}`
}

export function Melden() {
  const [zoek] = useSearchParams()
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { data: apparaten } = useApparaten()
  const { data: open, isPending } = useOpenMeldingen()
  const melden = useMelden()

  // Vanaf de temperatuurronde komt het apparaat mee; dan staat de soort meteen
  // op 'stuk' en hoeft niemand uit te leggen wélke koeling het was.
  const apparaatId = zoek.get('apparaat') ? Number(zoek.get('apparaat')) : null
  const apparaat = (apparaten ?? []).find((a) => a.id === apparaatId) ?? null

  const [soort, setSoort] = useState<Soort | null>(apparaat ? 'stuk' : null)
  const [tekst, setTekst] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const kiezer = useRef<HTMLInputElement>(null)
  const [gelukt, setGelukt] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  function versturen() {
    if (!soort || !tekst.trim()) return
    setFout(null)
    melden.mutate(
      {
        soort,
        tekst,
        apparaatId: apparaat?.id ?? null,
        apparaatNaam: apparaat?.naam ?? null,
        foto,
        medewerkerId: wie?.medewerker_id ?? null,
        doorNaam: wie?.naam || email || 'onbekend',
      },
      {
        onSuccess: () => {
          setGelukt(true)
          setSoort(null)
          setTekst('')
          setFoto(null)
        },
        onError: (e) => setFout(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Kopje>Melden</Kopje>
        <p className="mt-1 text-sm text-muted">
          Iets stuk, iets bijna op, of iets anders dat Sander moet weten.
        </p>
      </div>

      {gelukt && (
        <p className="flex items-start gap-2 rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          Doorgegeven. Het staat hieronder bij wat er openstaat, en Sander heeft
          er bericht van gekregen.
        </p>
      )}
      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">{fout}</p>
      )}

      {apparaat && (
        <Kaart className="flex items-center gap-2 p-3 text-sm">
          <MessageSquareWarning className="size-4 shrink-0 text-muted" aria-hidden />
          Dit gaat over <span className="font-semibold">{apparaat.naam}</span>.
        </Kaart>
      )}

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SOORTEN.map((s) => (
            <button
              key={s.waarde}
              type="button"
              onClick={() => {
                setSoort(s.waarde)
                setGelukt(false)
              }}
              aria-pressed={soort === s.waarde}
              className={`min-h-14 rounded-card border-2 px-4 py-3 text-left font-semibold transition-colors ${
                soort === s.waarde ? `${s.klasse} bg-surface-2` : 'border-line text-text hover:bg-surface-2'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {soort && (
          <Kaart className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="melding" className="text-sm font-semibold text-muted">
                Wat is er aan de hand?
              </label>
              <textarea
                id="melding"
                rows={4}
                className={invoer}
                autoFocus
                placeholder={
                  soort === 'voorraad'
                    ? 'Pindakaas nog één emmer'
                    : soort === 'stuk'
                      ? 'Frituur trekt slecht, olie wordt niet heet genoeg'
                      : ''
                }
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
              />
            </div>

            <input
              ref={kiezer}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
            {foto ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Camera className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{foto.name}</span>
                <button
                  type="button"
                  onClick={() => setFoto(null)}
                  aria-label="Foto weghalen"
                  className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </p>
            ) : (
              <Knop soort="rustig" className="w-fit" onClick={() => kiezer.current?.click()}>
                <Camera className="size-4" aria-hidden />
                Foto erbij (mag leeg)
              </Knop>
            )}

            <Knop soort="primair" bezig={melden.isPending} disabled={!tekst.trim()} onClick={versturen}>
              Doorgeven
            </Knop>
          </Kaart>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Kopje>Wat er openstaat</Kopje>
        {isPending ? (
          <Laden />
        ) : (open ?? []).length === 0 ? (
          <Kaart className="p-4">
            <p className="text-sm text-muted">Er staat niets open.</p>
          </Kaart>
        ) : (
          <Kaart>
            {(open ?? []).map((m) => (
              <div key={m.id} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Pil soort={m.soort === 'stuk' ? 'fout' : m.soort === 'voorraad' ? 'letop' : 'neutraal'}>
                    {soortLabel(m.soort)}
                  </Pil>
                  {m.apparaat_naam && <span className="font-semibold">{m.apparaat_naam}</span>}
                </span>
                <span className="whitespace-pre-wrap">{m.tekst}</span>
                <span className="text-sm text-muted">
                  {toonNaam(m.door_naam)} · {wanneer(m.gemeld_op)}
                </span>
              </div>
            ))}
          </Kaart>
        )}
        <p className="max-w-prose text-sm text-muted">
          Iedereen ziet hetzelfde lijstje. Staat jouw punt er al bij, dan hoef je
          het niet nog een keer te melden.
        </p>
      </section>
    </div>
  )
}
