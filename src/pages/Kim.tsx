import { useEffect, useState } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Veld } from '../components/ui'
import {
  korteDatum,
  letterVan,
  useKimBeantwoorden,
  useKimVragen,
  useKimWachtposten,
  useKimWachtpostGeregeld,
  type KimVraag,
  type KimWachtpost,
} from '../lib/kim'
import { kimMeldingenAan, kimMeldingenStatus, type Meldingstand } from '../lib/kimpush'

/* Het Kim-scherm: wat ze wil weten, en wat er openstaat.

   Antwoorden is één tik. Daarom staan de opties als knoppen en niet als een
   keuzelijst: op een telefoon in de zaak wil je niet twee keer hoeven mikken. */

function Meldingen() {
  const [stand, setStand] = useState<Meldingstand | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    kimMeldingenStatus().then(setStand)
  }, [])

  async function aanzetten() {
    setBezig(true)
    setFout(null)
    try {
      // Bewust hier, in de klik: iOS weigert de toestemmingsvraag als die niet
      // rechtstreeks uit een tik komt.
      setStand(await kimMeldingenAan())
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Aanzetten lukte niet.')
      setStand(await kimMeldingenStatus())
    } finally {
      setBezig(false)
    }
  }

  if (stand === null) return null

  const tekst: Record<Meldingstand, string> = {
    aan: 'Meldingen staan aan op dit apparaat.',
    uit: 'Je krijgt op dit apparaat nog geen meldingen van Kim.',
    geweigerd:
      'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon of browser, en kom dan terug.',
    'niet-ondersteund':
      'Dit apparaat kan geen meldingen ontvangen. Op iPhone: zet de app via Deel → Zet op beginscherm, en open hem vanaf dat icoon.',
  }

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <p className="flex items-start gap-2 text-sm">
        {stand === 'aan' ? (
          <Bell className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
        ) : (
          <BellOff className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        )}
        <span className={stand === 'aan' ? 'text-good' : 'text-muted'}>{tekst[stand]}</span>
      </p>

      {stand === 'uit' && (
        <Knop soort="rustig" className="w-fit" bezig={bezig} onClick={aanzetten}>
          <Bell className="size-4" aria-hidden />
          Kim-meldingen aan
        </Knop>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}
    </Kaart>
  )
}

function VraagKaart({ vraag }: { vraag: KimVraag }) {
  const beantwoorden = useKimBeantwoorden()
  const [eigen, setEigen] = useState('')

  const advies = vraag.advies?.toUpperCase()
  const bezig = beantwoorden.isPending

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <p className="font-semibold">{vraag.vraag}</p>
      {vraag.context && <p className="max-w-prose text-sm text-muted">{vraag.context}</p>}

      <div className="flex flex-wrap gap-2">
        {(vraag.opties ?? []).map((optie) => (
          <Knop
            key={optie}
            soort={advies && letterVan(optie) === advies ? 'primair' : 'rustig'}
            bezig={bezig}
            onClick={() => beantwoorden.mutate({ id: vraag.id, antwoord: optie })}
          >
            {optie}
          </Knop>
        ))}
      </div>

      {advies && <p className="text-sm text-muted">Kim raadt {advies} aan.</p>}

      {/* Voor als geen van de opties past. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Veld
            label="Of je eigen antwoord"
            value={eigen}
            onChange={(e) => setEigen(e.target.value)}
          />
        </div>
        <Knop
          soort="rustig"
          bezig={bezig}
          disabled={!eigen.trim()}
          onClick={() => beantwoorden.mutate({ id: vraag.id, antwoord: eigen })}
        >
          Stuur
        </Knop>
      </div>

      {beantwoorden.error && (
        <p className="text-sm text-bad">{(beantwoorden.error as Error).message}</p>
      )}
    </Kaart>
  )
}

function WachtKaart({ post }: { post: KimWachtpost }) {
  const geregeld = useKimWachtpostGeregeld()

  const regels = [`sinds ${korteDatum(post.sinds)}`]
  if (post.termijn) regels.push(`termijn ${korteDatum(post.termijn)}`)

  return (
    <Kaart className={`flex flex-col gap-2 p-4 ${post.melding ? 'border-warn' : ''}`}>
      <p className="font-semibold">
        {post.wie}: {post.wat}
      </p>
      <p className="text-sm text-muted">{regels.join(' · ')}</p>
      {post.melding && <p className="text-sm text-warn">{post.melding}</p>}

      <Knop
        soort="rustig"
        className="w-fit"
        bezig={geregeld.isPending}
        onClick={() => geregeld.mutate(post.id)}
      >
        <Check className="size-4" aria-hidden />
        Geregeld
      </Knop>

      {geregeld.error && <p className="text-sm text-bad">{(geregeld.error as Error).message}</p>}
    </Kaart>
  )
}

export function Kim() {
  const vragen = useKimVragen()
  const posten = useKimWachtposten()

  if (vragen.isPending || posten.isPending) return <Laden tekst="Kim laden…" />
  if (vragen.error) return <Mislukt tekst={vragen.error.message} opnieuw={() => vragen.refetch()} />
  if (posten.error) return <Mislukt tekst={posten.error.message} opnieuw={() => posten.refetch()} />

  const open = vragen.data.filter((v) => !v.beantwoord_op)
  const verwerkt = vragen.data.filter((v) => v.beantwoord_op)
  const opJou = posten.data.filter((w) => w.richting === 'op_jou')
  const opAnder = posten.data.filter((w) => w.richting === 'op_ander')
  const nietsTeDoen = open.length + verwerkt.length + posten.data.length === 0

  return (
    <div className="flex flex-col gap-8">
      <Meldingen />

      {nietsTeDoen ? (
        <Leeg
          titel="Kim heeft niets voor je"
          uitleg="Geen openstaande vragen en niemand die wacht. Zodra Kim iets nodig heeft krijg je een melding."
        />
      ) : (
        <>
          {open.length > 0 && (
            <section className="flex flex-col gap-3">
              <Kopje>Kim vraagt ({open.length})</Kopje>
              {open.map((v) => (
                <VraagKaart key={v.id} vraag={v} />
              ))}
            </section>
          )}

          {verwerkt.length > 0 && (
            <section className="flex flex-col gap-3">
              <Kopje>Beantwoord</Kopje>
              {verwerkt.map((v) => (
                <Kaart key={v.id} className="flex flex-col gap-1 p-4">
                  <p className="font-semibold">{v.vraag}</p>
                  <p className="text-sm text-muted">
                    Jouw antwoord: {v.antwoord}. Kim verwerkt het in haar volgende ronde.
                  </p>
                </Kaart>
              ))}
            </section>
          )}

          {opJou.length > 0 && (
            <section className="flex flex-col gap-3">
              <Kopje>Iemand wacht op jou</Kopje>
              {opJou.map((w) => (
                <WachtKaart key={w.id} post={w} />
              ))}
            </section>
          )}

          {opAnder.length > 0 && (
            <section className="flex flex-col gap-3">
              <Kopje>Jij wacht op</Kopje>
              {opAnder.map((w) => (
                <WachtKaart key={w.id} post={w} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
