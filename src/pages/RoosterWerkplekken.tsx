import { Link } from 'react-router-dom'
import { Kaart, Kopje, Laden, Mislukt, Pil } from '../components/ui'
import { NiveauKeuze } from '../components/NiveauKeuze'
import { usePersonen } from '../lib/personeel'
import {
  NIVEAU,
  niveauVan,
  useNiveaus,
  useWerkplekWijzigen,
  useWerkplekken,
  stoelenVan,
  stoelnaam,
  vulVolgorde,
  type Werkplek,
} from '../lib/spits'

/* Wie kan waar staan.
 *
 * Dit is de basis onder de indeling van de avondspits. Zonder dit weet de app
 * alleen wie er die avond is, en niet wat ze kunnen — dan wordt het een
 * naamlijst in willekeurige volgorde.
 *
 * Het is een beoordeling, geen wens: hij wordt hier ingevuld en niet door de
 * medewerker zelf. De voorkeur van de medewerker staat bij de vaste dagen. */

function Getal({
  label,
  waarde,
  min,
  max,
  onKlaar,
  plaatshouder,
}: {
  label: string
  /* Null is een geldige waarde en geen ontbrekende: bij het doordeweekse
     belang betekent leeg "hetzelfde als in het weekend". Dat staat dan als
     grijze plaatshouder in het vakje, zodat je ziet wat er geldt zonder dat je
     het hoeft over te typen. */
  waarde: number | null
  min: number
  max: number
  onKlaar: (n: number | null) => void
  plaatshouder?: number
}) {
  return (
    <label className="flex items-center gap-2 sm:block">
      {/* Op een breed scherm staat de kop boven de kolom; op een telefoon
          vervalt die tabel, en dan hoort het label bij het vakje zelf. */}
      <span className="w-36 text-sm text-muted sm:hidden">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        aria-label={label}
        defaultValue={waarde ?? ''}
        placeholder={plaatshouder === undefined ? undefined : String(plaatshouder)}
        onBlur={(e) => {
          const leeg = e.target.value.trim() === ''
          if (leeg) {
            if (plaatshouder !== undefined && waarde !== null) onKlaar(null)
            else e.target.value = waarde === null ? '' : String(waarde)
            return
          }
          const n = Number(e.target.value)
          if (Number.isInteger(n) && n >= min && n <= max && n !== waarde) onKlaar(n)
          else e.target.value = waarde === null ? '' : String(waarde)
        }}
        className="w-16 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-2 py-1.5 text-center text-base tabular-nums outline-none focus:border-accent"
      />
    </label>
  )
}

function Instelling({ w }: { w: Werkplek }) {
  const wijzig = useWerkplekWijzigen()

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_8rem] sm:items-center sm:gap-4">
      <span className="min-w-0 truncate font-semibold">{w.naam}</span>
      <Getal
        label="Mensen tegelijk"
        waarde={w.aantal}
        min={1}
        max={6}
        onKlaar={(aantal) => aantal !== null && wijzig.mutate({ id: w.id, aantal })}
      />
      <Getal
        label="Weekend"
        waarde={w.belang}
        min={1}
        max={10}
        onKlaar={(belang) => belang !== null && wijzig.mutate({ id: w.id, belang })}
      />
      {/* Leeg laten betekent: doordeweeks hetzelfde als in het weekend. Het
          weekendgetal staat er dan grijs in, zodat je ziet wat er geldt zonder
          dat je het hoeft over te typen. */}
      <Getal
        label="Belang di/wo/do"
        waarde={w.belang_doordeweeks}
        min={1}
        max={10}
        plaatshouder={w.belang}
        onKlaar={(belang_doordeweeks) => wijzig.mutate({ id: w.id, belang_doordeweeks })}
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={w.actief}
          onChange={(e) => wijzig.mutate({ id: w.id, actief: e.target.checked })}
          className="size-4"
        />
        Draait mee
      </label>
    </div>
  )
}

/* Wat die twee getallen doen, als rijtje. Een belang van 8 zegt niets; "de
   kassa komt na de patat" zegt alles. En bij gelijk belang zie je hier dat het
   dan op de volgorde van de tabel aankomt — dat kun je nergens anders aflezen. */
function Vulvolgorde({
  werkplekken,
  doordeweeks,
}: {
  werkplekken: Werkplek[]
  doordeweeks: boolean
}) {
  const rij = vulVolgorde(stoelenVan(werkplekken, doordeweeks))
  if (rij.length === 0) return null

  return (
    <>
      <Kopje>{doordeweeks ? 'Zo vult hij op di, wo en do' : 'Zo vult hij in het weekend'}</Kopje>
      <p className="text-sm text-muted">
        Heb je te weinig mensen, dan gaat de app deze rij van boven naar beneden af. Staan er vijf
        mensen, dan worden dit de bovenste vijf en blijft de rest leeg.
      </p>
      <Kaart className="flex flex-col py-2">
        {rij.map((s, i) => (
          <div
            key={s.sleutel}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-0"
          >
            <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span>
            <span className="font-semibold">{stoelnaam(s)}</span>
            <span className="ml-auto text-sm text-muted">
              belang {s.belang}
              {i > 0 && rij[i - 1].belang === s.belang && ' — gelijk aan de vorige'}
            </span>
          </div>
        ))}
      </Kaart>
    </>
  )
}

export function RoosterWerkplekken() {
  const personen = usePersonen()
  const plekken = useWerkplekken()
  const niveaus = useNiveaus()

  const fout = personen.error ?? plekken.error ?? niveaus.error
  if (fout)
    return (
      <Mislukt
        tekst={fout.message}
        opnieuw={() => {
          personen.refetch()
          plekken.refetch()
          niveaus.refetch()
        }}
      />
    )

  // Drie vragen, dus drie keer afwachten. Pas als ze alle drie binnen zijn
  // valt er iets te tonen.
  if (!personen.data || !plekken.data || !niveaus.data)
    return <Laden tekst="Werkplekken ophalen…" />

  const mensen = personen.data
    .filter((p) => p.fase === 'medewerker' && !p.uit_dienst_op)
    .map((p) => ({ id: p.id, naam: [p.voornaam, p.achternaam].filter(Boolean).join(' ') }))
    .sort((a, b) => a.naam.localeCompare(b.naam))
  const actief = plekken.data.filter((w) => w.actief)

  const beoordeeld = (id: string) =>
    actief.filter((w) => niveauVan(niveaus.data, id, w.id) !== 'onbekend').length
  const nogNiets = mensen.filter((m) => beoordeeld(m.id) === 0)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Per medewerker per plek hoe goed het gaat. Hier rekent de app de indeling van de avondspits
        mee uit. <strong className="font-semibold text-text">Nooit</strong> is een harde grens: daar
        wordt iemand niet ingedeeld, ook niet als het die avond beter uitkwam.{' '}
        <strong className="font-semibold text-text">Onbekend</strong> betekent nog niet beoordeeld —
        de app mag het dan wel, maar zegt erbij dat het een gok is.
      </p>

      {nogNiets.length > 0 && (
        <Kaart className="border-warn p-4">
          <p className="font-semibold">
            {nogNiets.length === 1
              ? 'Van één medewerker is nog niets ingevuld'
              : `Van ${nogNiets.length} medewerkers is nog niets ingevuld`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {nogNiets.map((m) => m.naam).join(', ')}. Zolang dat zo is zet de app ze overal op
            "onbekend", en is de indeling een gok.
          </p>
        </Kaart>
      )}

      {mensen.map((m) => (
        <section key={m.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link to={`/personeel/${m.id}`} className="font-display text-lg hover:underline">
              {m.naam}
            </Link>
            {beoordeeld(m.id) === 0 && <Pil soort="letop">Nog niets ingevuld</Pil>}
          </div>
          <Kaart className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {actief.map((w) => (
              <div key={w.id} className="flex flex-col gap-1">
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                  {w.naam}
                  {w.aantal > 1 && ` ${w.aantal}×`}
                </span>
                <NiveauKeuze
                  medewerkerId={m.id}
                  werkplekId={w.id}
                  waarde={niveauVan(niveaus.data, m.id, w.id)}
                  naam={`${m.naam} op ${w.naam}`}
                />
              </div>
            ))}
          </Kaart>
        </section>
      ))}

      <details className="flex flex-col gap-3">
        <summary className="w-fit cursor-pointer text-sm font-semibold text-muted hover:text-text">
          De werkplekken zelf aanpassen
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <Kopje>Werkplekken</Kopje>
          <p className="text-sm text-muted">
            <strong className="font-semibold text-text">Mensen tegelijk</strong> is hoeveel mensen er
            op die plek staan — bij de snackbakker twee.{' '}
            <strong className="font-semibold text-text">Belang</strong> is hoe hard de plek bezet
            moet zijn: 10 is onmisbaar, 1 is meegenomen. Dat staat er twee keer, want in het
            weekend telt een plek anders dan op een rustige woensdag. Laat je{' '}
            <strong className="font-semibold text-text">Di/wo/do</strong> leeg, dan geldt daar het
            weekendgetal. Hieronder zie je wat die getallen doen.
          </p>
          <Kaart className="flex flex-col py-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_8rem] gap-4 border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
              <span>Plek</span>
              <span className="text-center">Mensen</span>
              <span className="text-center">Weekend</span>
              <span className="text-center">Di/wo/do</span>
              <span />
            </div>
            {plekken.data.map((w) => (
              <Instelling key={`${w.id}-${w.aantal}-${w.belang}-${w.belang_doordeweeks}`} w={w} />
            ))}
          </Kaart>

          {/* Twee rijtjes naast elkaar, want ze lopen uiteen zodra je het
              doordeweekse getal invult. Zien dát ze verschillen is het hele
              punt: een belang van 8 zegt niets, "plankjes vóór de tweede
              snackbakker" zegt alles. */}
          <Vulvolgorde werkplekken={plekken.data} doordeweeks={false} />
          <Vulvolgorde werkplekken={plekken.data} doordeweeks />

          <Kopje>Wat de niveaus betekenen</Kopje>
          <Kaart className="flex flex-col py-2">
            {(['liefst', 'kan', 'nood', 'nooit', 'onbekend'] as const).map((n) => (
              <div
                key={n}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-0"
              >
                <Pil soort={NIVEAU[n].soort}>{NIVEAU[n].label}</Pil>
                <span className="text-sm text-muted">{NIVEAU[n].uitleg}</span>
              </div>
            ))}
          </Kaart>
        </div>
      </details>
    </div>
  )
}
