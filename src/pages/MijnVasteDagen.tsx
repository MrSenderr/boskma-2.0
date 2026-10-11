import { useEffect, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt } from '../components/ui'
import { useWieBenIk } from '../lib/wie'
import { korteDatum } from '../lib/personeel'
import {
  DAGEN,
  VOORKEUR,
  useMijnVasteDagen,
  useVasteDagenOpslaan,
  type Voorkeur,
} from '../lib/vasteDagen'

/* Mijn vaste dagen: dezelfde vragen als het formulier op /vastedagen, maar dan
   voor wie is ingelogd.

   Wat je eerder opgaf staat vooraf ingevuld. Opslaan maakt een nieuwe regel in
   plaats van de oude te wijzigen, zodat er niets verdwijnt: Sander kan zien
   wat je eerder wilde en wanneer dat veranderde. */

const KEUZES: Voorkeur[] = ['graag', 'kan', 'liever_niet', 'nee']

type Antwoorden = Partial<Record<'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo' | 'za_hele_dag' | 'zo_hele_dag', Voorkeur>>

function Keuzeknoppen({
  naam,
  waarde,
  zet,
}: {
  naam: string
  waarde: Voorkeur | undefined
  zet: (v: Voorkeur) => void
}) {
  return (
    <div role="radiogroup" aria-label={naam} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {KEUZES.map((k) => {
        const aan = waarde === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={aan}
            data-touch
            onClick={() => zet(k)}
            className={`rounded-[4px] border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors ${
              aan
                ? 'border-brand bg-brand text-on-brand'
                : 'border-line-strong text-text hover:bg-surface-2'
            }`}
          >
            {VOORKEUR[k].label}
          </button>
        )
      })}
    </div>
  )
}

function Vraag({ titel, uitleg, children }: { titel: string; uitleg?: string; children: React.ReactNode }) {
  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-semibold">{titel}</p>
        {uitleg && <p className="mt-0.5 text-sm text-muted">{uitleg}</p>}
      </div>
      {children}
    </Kaart>
  )
}

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

export function MijnVasteDagen() {
  const { data: wie } = useWieBenIk()
  const persoonId = wie?.medewerker_id ?? null
  const { data: eerder, isPending, error, refetch } = useMijnVasteDagen(persoonId)
  const opslaan = useVasteDagenOpslaan()

  const [wilVast, setWilVast] = useState<boolean | null>(null)
  const [akkoord, setAkkoord] = useState(false)
  const [antwoorden, setAntwoorden] = useState<Antwoorden>({})
  const [aantal, setAantal] = useState<number | null>(null)
  const [blokkades, setBlokkades] = useState('')
  const [geldig, setGeldig] = useState('')
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState('')
  const [klaar, setKlaar] = useState(false)

  // Wat je eerder opgaf vooraf invullen, zodat je alleen hoeft aan te passen
  // wat er anders is geworden.
  useEffect(() => {
    if (!eerder) return
    setWilVast(eerder.wil_vast)
    setAkkoord(eerder.akkoord_geen_vast)
    setAntwoorden({
      di: eerder.di ?? undefined,
      wo: eerder.wo ?? undefined,
      do: eerder.do ?? undefined,
      vr: eerder.vr ?? undefined,
      za: eerder.za ?? undefined,
      zo: eerder.zo ?? undefined,
      za_hele_dag: eerder.za_hele_dag ?? undefined,
      zo_hele_dag: eerder.zo_hele_dag ?? undefined,
    })
    setAantal(eerder.aantal_vast)
    setBlokkades(eerder.blokkades ?? '')
    setGeldig(eerder.geldig_tot ?? '')
    setOpmerking(eerder.opmerking ?? '')
  }, [eerder])

  if (isPending) return <Laden tekst="Je voorkeur ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  if (!persoonId) {
    return (
      <div className="flex flex-col gap-4">
        <Kopje>Mijn vaste dagen</Kopje>
        <Kaart className="p-4">
          <p className="text-sm text-muted">
            Dit scherm is er voor medewerkers. Klopt dat niet, laat het Sander even weten.
          </p>
        </Kaart>
      </div>
    )
  }

  const alleDagenIngevuld =
    DAGEN.every((d) => antwoorden[d.sleutel]) && antwoorden.za_hele_dag && antwoorden.zo_hele_dag

  async function bewaar() {
    setFout('')
    if (wilVast === null) return setFout('Geef eerst aan of je vaste dagen wilt.')
    if (wilVast && !alleDagenIngevuld) return setFout('Vul bij elke dag een keuze in.')
    if (wilVast && aantal === null) return setFout('Kies hoeveel vaste diensten je per week wilt.')
    if (!wilVast && !akkoord) return setFout('Vink aan dat je begrijpt wat geen vaste dagen betekent.')

    try {
      await opslaan.mutateAsync({
        persoon_id: persoonId as string,
        naam: wie?.naam?.trim() || 'Onbekend',
        wil_vast: wilVast,
        akkoord_geen_vast: wilVast ? false : akkoord,
        di: wilVast ? (antwoorden.di ?? null) : null,
        wo: wilVast ? (antwoorden.wo ?? null) : null,
        do: wilVast ? (antwoorden.do ?? null) : null,
        vr: wilVast ? (antwoorden.vr ?? null) : null,
        za: wilVast ? (antwoorden.za ?? null) : null,
        zo: wilVast ? (antwoorden.zo ?? null) : null,
        za_hele_dag: wilVast ? (antwoorden.za_hele_dag ?? null) : null,
        zo_hele_dag: wilVast ? (antwoorden.zo_hele_dag ?? null) : null,
        aantal_vast: wilVast ? aantal : null,
        blokkades: blokkades.trim() || null,
        geldig_tot: geldig.trim() || null,
        opmerking: opmerking.trim() || null,
      })
      setKlaar(true)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Opslaan is niet gelukt')
    }
  }

  function zet(sleutel: keyof Antwoorden, waarde: Voorkeur) {
    setAntwoorden((a) => ({ ...a, [sleutel]: waarde }))
    setKlaar(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Kopje>Mijn vaste dagen</Kopje>
        <p className="mt-1 text-sm text-muted">
          We willen zoveel mogelijk met vaste dagen werken in de avondspits. Geef per dag aan hoe
          het jou uitkomt. Het kost je twee minuten.
        </p>
        {eerder && (
          <p className="mt-2 text-sm text-muted">
            Je vulde dit eerder in op {korteDatum(eerder.ingevuld_op)}. Hieronder staat wat je toen
            opgaf; pas aan wat er anders is geworden.
          </p>
        )}
      </div>

      <Vraag titel="Wil je vaste dagen?" uitleg="Kies wat bij jou past.">
        <div role="radiogroup" aria-label="Wil je vaste dagen" className="grid gap-2 sm:grid-cols-2">
          {[
            { waarde: true, label: 'Ja, ik wil vaste dagen' },
            { waarde: false, label: 'Nee, liever geen vaste dagen' },
          ].map((k) => (
            <button
              key={String(k.waarde)}
              type="button"
              role="radio"
              aria-checked={wilVast === k.waarde}
              data-touch
              onClick={() => {
                setWilVast(k.waarde)
                setKlaar(false)
              }}
              className={`rounded-[4px] border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                wilVast === k.waarde
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong text-text hover:bg-surface-2'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {wilVast === false && (
          <div className="flex flex-col gap-3 rounded-[4px] border-[1.5px] border-warn bg-warn-soft p-3">
            <p className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <span>
                <strong className="font-semibold">Let op:</strong> zonder vaste dagen heb je geen
                vastigheid. Je wordt alleen ingepland als er ruimte ontstaat naast de vaste
                plekken, bijvoorbeeld bij ziekte, vakantie of extra drukte. Het kan dus zijn dat je
                een tijd weinig of geen diensten krijgt.
              </span>
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={akkoord}
                onChange={(e) => {
                  setAkkoord(e.target.checked)
                  setKlaar(false)
                }}
                className="mt-0.5 size-4 shrink-0"
              />
              Ik begrijp dit en kies toch voor geen vaste dagen
            </label>
          </div>
        )}
      </Vraag>

      {wilVast === true && (
        <>
          <Vraag
            titel="Avondspits 17:00 – 20:00"
            uitleg="Hoe graag zou je op deze dag vast de spits werken?"
          >
            <div className="flex flex-col gap-4">
              {DAGEN.map((d) => (
                <div key={d.sleutel} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">{d.naam}</p>
                  <Keuzeknoppen
                    naam={`${d.naam}, spits`}
                    waarde={antwoorden[d.sleutel]}
                    zet={(v) => zet(d.sleutel, v)}
                  />

                  {(d.sleutel === 'za' || d.sleutel === 'zo') && (
                    <div className="mt-1 flex flex-col gap-2 border-l-2 border-line pl-3">
                      <p className="text-sm text-muted">Of liever de hele dag? 12:00 – 20:00</p>
                      <Keuzeknoppen
                        naam={`${d.naam}, hele dag`}
                        waarde={antwoorden[d.sleutel === 'za' ? 'za_hele_dag' : 'zo_hele_dag']}
                        zet={(v) => zet(d.sleutel === 'za' ? 'za_hele_dag' : 'zo_hele_dag', v)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Vraag>

          <Vraag
            titel="Hoeveel vaste diensten per week?"
            uitleg="Hoeveel diensten wil je per week vast hebben staan?"
          >
            <div role="radiogroup" aria-label="Aantal vaste diensten" className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={aantal === n}
                  data-touch
                  onClick={() => {
                    setAantal(n)
                    setKlaar(false)
                  }}
                  className={`min-w-12 rounded-[4px] border-[1.5px] px-3 py-2.5 text-sm font-semibold tabular-nums transition-colors ${
                    aantal === n
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-line-strong text-text hover:bg-surface-2'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Vraag>
        </>
      )}

      <Vraag
        titel="Wat ligt bij jou vast?"
        uitleg="School, sport, een andere baan, vervoer… alles waar we rekening mee moeten houden."
      >
        <textarea
          value={blokkades}
          onChange={(e) => setBlokkades(e.target.value)}
          maxLength={1000}
          rows={3}
          aria-label="Wat ligt bij jou vast"
          className={invoer}
        />
      </Vraag>

      <Vraag
        titel="Tot wanneer geldt dit ongeveer?"
        uitleg={'Bijvoorbeeld "tot de zomer" of "tot het nieuwe schoolrooster in februari".'}
      >
        <input
          type="text"
          value={geldig}
          onChange={(e) => setGeldig(e.target.value)}
          maxLength={100}
          aria-label="Tot wanneer geldt dit"
          className={invoer}
        />
      </Vraag>

      <Vraag titel="Nog iets dat Sander moet weten?">
        <textarea
          value={opmerking}
          onChange={(e) => setOpmerking(e.target.value)}
          maxLength={1000}
          rows={3}
          aria-label="Nog iets dat Sander moet weten"
          className={invoer}
        />
      </Vraag>

      {fout && <p className="text-sm text-bad">{fout}</p>}

      {klaar ? (
        <Kaart className="flex items-start gap-2 border-good p-4">
          <Check className="mt-0.5 size-5 shrink-0 text-good" aria-hidden />
          <div>
            <p className="font-semibold">Bedankt, het is binnen!</p>
            <p className="mt-0.5 text-sm text-muted">
              Wil je later iets aanpassen? Vul het gewoon opnieuw in; je laatste versie telt.
            </p>
          </div>
        </Kaart>
      ) : (
        <div>
          <Knop onClick={bewaar} bezig={opslaan.isPending} breed>
            {eerder ? 'Aanpassing opslaan' : 'Versturen'}
          </Knop>
        </div>
      )}
    </div>
  )
}
