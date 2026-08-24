import { useEffect, useState } from 'react'
import { Camera, Check, MessageSquareWarning } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import { toonNaam } from '../lib/personeel'
import { fotoUrl, soortLabel, useMeldingAfhandelen, useOpenMeldingen, type Melding } from '../lib/meldingen'

/* Wat er uit de zaak gemeld is. Staat op Vandaag en blijft daar tot Sander het
   aftikt — hij kan het wegtikken, maar het verdwijnt niet vanzelf. Zie
   docs/Modules/meldingen.md. */

function Foto({ pad }: { pad: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let nog = true
    fotoUrl(pad)
      .then((u) => nog && setUrl(u))
      .catch(() => nog && setUrl(null))
    return () => {
      nog = false
    }
  }, [pad])
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="w-fit">
      <img src={url} alt="Foto bij deze melding" className="max-h-48 rounded-[4px] border border-line" />
    </a>
  )
}

function Regel({ melding: m }: { melding: Melding }) {
  const afhandelen = useMeldingAfhandelen()
  const [reactie, setReactie] = useState('')
  const [antwoorden, setAntwoorden] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  return (
    <Kaart className={`flex flex-col gap-3 p-4 ${m.soort === 'stuk' ? 'border-bad' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareWarning className="size-4 shrink-0 text-muted" aria-hidden />
        <Pil soort={m.soort === 'stuk' ? 'fout' : m.soort === 'voorraad' ? 'letop' : 'neutraal'}>
          {soortLabel(m.soort)}
        </Pil>
        {m.apparaat_naam && <span className="font-semibold">{m.apparaat_naam}</span>}
        <span className="text-sm text-muted">
          {toonNaam(m.door_naam)} ·{' '}
          {new Date(m.gemeld_op).toLocaleString('nl-NL', {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      <p className="whitespace-pre-wrap">{m.tekst}</p>

      {m.foto_pad && (
        <>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Camera className="size-4 shrink-0" aria-hidden />
            Foto erbij
          </p>
          <Foto pad={m.foto_pad} />
        </>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}

      {antwoorden ? (
        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
            autoFocus
            placeholder="Wat je erover kwijt wilt (de melder ziet dit)"
            aria-label="Reactie op deze melding"
            value={reactie}
            onChange={(e) => setReactie(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Knop
              soort="primair"
              bezig={afhandelen.isPending}
              onClick={() =>
                afhandelen.mutate({ id: m.id, reactie }, { onError: (e) => setFout(e.message) })
              }
            >
              <Check className="size-4" aria-hidden />
              Afhandelen
            </Knop>
            <Knop soort="rustig" onClick={() => setAntwoorden(false)}>
              Terug
            </Knop>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Knop
            soort="primair"
            bezig={afhandelen.isPending}
            onClick={() =>
              afhandelen.mutate({ id: m.id, reactie: null }, { onError: (e) => setFout(e.message) })
            }
          >
            <Check className="size-4" aria-hidden />
            Gezien
          </Knop>
          <Knop soort="rustig" onClick={() => setAntwoorden(true)}>
            Gezien, met een bericht terug
          </Knop>
        </div>
      )}
    </Kaart>
  )
}

export function Meldingen() {
  const { data, isPending } = useOpenMeldingen()
  if (isPending || !data || data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Kopje>Gemeld uit de zaak</Kopje>
        <span className="text-sm text-muted">{data.length}</span>
      </div>
      {data.map((m) => (
        <Regel key={m.id} melding={m} />
      ))}
    </section>
  )
}
