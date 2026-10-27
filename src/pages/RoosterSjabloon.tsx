import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil, Veld } from '../components/ui'
import { useKandidaten } from '../lib/rooster'
import {
  DAGEN,
  SOORTEN,
  SOORTTEKST,
  klok,
  telDag,
  useRegelToevoegen,
  useRegelWeg,
  useRegelWijzigen,
  useSjabloon,
  useVasteDiensten,
  useVasteDienstToevoegen,
  useVasteDienstWeg,
  type Sjabloonregel,
  type Soort,
} from '../lib/weeksjabloon'

/* Wat er per dag nodig is.
 *
 * Dit scherm vult het gat tussen wat de app wist en wat er in Sanders hoofd
 * zat. De spitsindeling kende alleen de avond van vrijdag tot en met zondag;
 * hoeveel mensen er op een dinsdagmiddag moeten staan, stond nergens.
 *
 * Het staat al ingevuld met wat er feitelijk gepland werd in vijf weken: alles
 * eindigt om 20:00, de vroegste dagdienst is de voorbereiding, en de rest komt
 * om vijf uur. Beginnen met een lege tabel zou betekenen dat iemand van nul
 * moet opschrijven wat de administratie allang weet.
 *
 * Boven elke dag staat wat het bij elkaar is. Dat getal is belangrijker dan de
 * losse regels: dagdiensten lopen door tot sluitingstijd, dus die staan er
 * tijdens de spits gewoon bij. Vrijdag met vier overdag en twee 's avonds is
 * zes paar handen om vijf uur — met Sander erbij de zeven waar de
 * spitsindeling op rekent.
 */

function Tijdveld({
  waarde,
  onKlaar,
}: {
  waarde: string
  onKlaar: (tijd: string) => void
}) {
  const [tekst, setTekst] = useState(klok(waarde))
  return (
    <input
      type="time"
      value={tekst}
      onChange={(e) => setTekst(e.target.value)}
      onBlur={() => {
        if (tekst && tekst !== klok(waarde)) onKlaar(`${tekst}:00`)
        else setTekst(klok(waarde))
      }}
      className="min-h-11 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm tabular-nums outline-none transition-colors focus:border-accent"
    />
  )
}

function Regel({ regel }: { regel: Sjabloonregel }) {
  const wijzig = useRegelWijzigen()
  const weg = useRegelWeg()

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-0">
      <select
        value={regel.soort}
        onChange={(e) => wijzig.mutate({ id: regel.id, soort: e.target.value as Soort })}
        className="min-h-11 min-w-36 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm outline-none focus:border-accent"
      >
        {SOORTEN.map((s) => (
          <option key={s} value={s}>
            {SOORTTEKST[s]}
          </option>
        ))}
      </select>

      <Tijdveld waarde={regel.begint} onKlaar={(t) => wijzig.mutate({ id: regel.id, begint: t })} />
      <span className="text-sm text-muted">tot</span>
      <Tijdveld waarde={regel.eindigt} onKlaar={(t) => wijzig.mutate({ id: regel.id, eindigt: t })} />

      <input
        type="number"
        min={0}
        max={20}
        value={regel.aantal}
        onChange={(e) => wijzig.mutate({ id: regel.id, aantal: Number(e.target.value) })}
        aria-label="Hoeveel mensen"
        className="min-h-11 w-16 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm tabular-nums outline-none focus:border-accent"
      />
      <span className="text-sm text-muted">{regel.aantal === 1 ? 'persoon' : 'personen'}</span>

      <button
        type="button"
        onClick={() => weg.mutate(regel.id)}
        aria-label="Deze dienst weghalen"
        className="ml-auto flex size-11 items-center justify-center rounded-[4px] text-muted transition-colors hover:text-bad"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function Dag({ dag, naam, regels }: { dag: number; naam: string; regels: Sjabloonregel[] }) {
  const toevoegen = useRegelToevoegen()
  const { overdag, avond, samen, regels: vanDieDag } = telDag(regels, dag)

  return (
    <Kaart className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg">{naam}</p>
        <p className="text-sm text-muted">
          {/* Het totaal telt de dagdiensten mee: die staan er tijdens de spits
              gewoon bij, want ze lopen door tot sluitingstijd. */}
          {samen} {samen === 1 ? 'persoon' : 'personen'} om 17:00 — {overdag} overdag begonnen,{' '}
          {avond} erbij 's avonds
        </p>
      </div>

      {vanDieDag.length === 0 ? (
        <p className="text-sm text-muted">Nog niets ingesteld voor deze dag.</p>
      ) : (
        <div className="flex flex-col">
          {vanDieDag.map((r) => (
            <Regel key={r.id} regel={r} />
          ))}
        </div>
      )}

      <Knop
        soort="rustig"
        bezig={toevoegen.isPending}
        onClick={() =>
          toevoegen.mutate({
            dag,
            soort: 'avond',
            begint: '17:00:00',
            eindigt: '20:00:00',
            aantal: 1,
          })
        }
      >
        <Plus className="size-4" aria-hidden />
        Dienst erbij
      </Knop>
    </Kaart>
  )
}

function VasteDiensten() {
  const diensten = useVasteDiensten()
  const mensen = useKandidaten()
  const toevoegen = useVasteDienstToevoegen()
  const weg = useVasteDienstWeg()

  const [wie, setWie] = useState('')
  const [dag, setDag] = useState(5)
  const [soort, setSoort] = useState<Soort>('dag')
  const [begint, setBegint] = useState('12:00')
  const [eindigt, setEindigt] = useState('20:00')

  const naamVan = (id: string) => {
    const m = (mensen.data ?? []).find((k) => k.id === id)
    return m ? [m.voornaam, m.achternaam].filter(Boolean).join(' ') : 'Onbekend'
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Kopje>Vaste diensten</Kopje>
        <p className="max-w-2xl text-sm text-muted">
          Een afspraak, geen wens. Wie hier staat wordt als eerste ingepland, vóórdat er iets te
          verdelen valt — ook als hij die week niets heeft opgegeven. Wat iemand liever wíl staat
          bij Vaste dagen; dat is iets anders.
        </p>
      </div>

      {(diensten.data ?? []).length > 0 && (
        <Kaart>
          <ul className="flex flex-col divide-y divide-line">
            {(diensten.data ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold">{naamVan(d.medewerker_id)}</span>
                  <span className="text-muted">
                    {' — elke '}
                    {DAGEN.find((x) => x.nr === d.dag)?.naam.toLowerCase() ?? '?'}
                    {`, ${SOORTTEKST[d.soort].toLowerCase()} ${klok(d.begint)}–${klok(d.eindigt)}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => weg.mutate(d.id)}
                  aria-label="Deze afspraak weghalen"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[4px] text-muted transition-colors hover:text-bad"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Kaart>
      )}

      {toevoegen.error && <Mislukt tekst={toevoegen.error.message} />}

      <Kaart className="flex flex-wrap items-end gap-2 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Wie</span>
          <select
            value={wie}
            onChange={(e) => setWie(e.target.value)}
            className="min-h-11 min-w-44 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Kies een medewerker</option>
            {(mensen.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {[m.voornaam, m.achternaam].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Elke</span>
          <select
            value={dag}
            onChange={(e) => setDag(Number(e.target.value))}
            className="min-h-11 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm outline-none focus:border-accent"
          >
            {DAGEN.map((d) => (
              <option key={d.nr} value={d.nr}>
                {d.naam.toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Soort</span>
          <select
            value={soort}
            onChange={(e) => {
              const s = e.target.value as Soort
              setSoort(s)
              // Meebewegen met wat gebruikelijk is, zodat je alleen hoeft te
              // corrigeren als het afwijkt.
              if (s === 'avond') setBegint('17:00')
              if (s === 'voorbereiding') setBegint('11:00')
              if (s === 'dag') setBegint('12:00')
            }}
            className="min-h-11 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 text-sm outline-none focus:border-accent"
          >
            {SOORTEN.map((s) => (
              <option key={s} value={s}>
                {SOORTTEKST[s]}
              </option>
            ))}
          </select>
        </label>

        <Veld
          label="Van"
          type="time"
          value={begint}
          onChange={(e) => setBegint(e.target.value)}
          className="w-32"
        />
        <Veld
          label="Tot"
          type="time"
          value={eindigt}
          onChange={(e) => setEindigt(e.target.value)}
          className="w-32"
        />

        <Knop
          bezig={toevoegen.isPending}
          disabled={!wie || !begint || !eindigt}
          onClick={() =>
            toevoegen.mutate(
              {
                medewerker_id: wie,
                dag,
                soort,
                begint: `${begint}:00`,
                eindigt: `${eindigt}:00`,
              },
              { onSuccess: () => setWie('') },
            )
          }
        >
          <Plus className="size-4" aria-hidden />
          Vastleggen
        </Knop>
      </Kaart>
    </div>
  )
}

export function RoosterSjabloon() {
  const sjabloon = useSjabloon()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="max-w-2xl text-sm text-muted">
          Hoeveel mensen je per dag nodig hebt, en hoe laat ze beginnen. Al ingevuld met wat je de
          afgelopen vijf weken feitelijk plande — corrigeer wat er niet klopt. Hier draait straks
          het roostervoorstel op.
        </p>
        <p className="max-w-2xl text-sm text-muted">
          Dagdiensten lopen door tot sluitingstijd, dus die tellen mee in wat er tijdens de spits
          staat. Maandag ontbreekt: dan is de zaak dicht.
        </p>
      </div>

      {sjabloon.isPending && <Laden tekst="Sjabloon ophalen…" />}
      {sjabloon.error && <Mislukt tekst={sjabloon.error.message} opnieuw={() => sjabloon.refetch()} />}

      {sjabloon.data && (
        <>
          <div className="flex flex-col gap-3">
            {DAGEN.map((d) => (
              <Dag key={d.nr} dag={d.nr} naam={d.naam} regels={sjabloon.data} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Pil soort="neutraal">
              {DAGEN.reduce((som, d) => som + telDag(sjabloon.data, d.nr).samen, 0)} diensten per
              week
            </Pil>
            <span>Dat is wat het voorstel per week moet zien te vullen.</span>
          </div>

          <VasteDiensten />
        </>
      )}
    </div>
  )
}
