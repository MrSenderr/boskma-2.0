import { useMemo, useState } from 'react'
import { AlertTriangle, CircleDashed, Phone, Send, Wand2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil, Veld } from '../components/ui'
import { dagnaam, datumKort, maandagVan } from '../lib/rooster'
import { useWieKanEr } from '../lib/beschikbaarheid'
import { SOORTTEKST, klok, useSjabloon, useVasteDiensten, type Soort } from '../lib/weeksjabloon'
import {
  isDoordeweeks,
  maakIndeling,
  stoelenVan,
  stoelnaam,
  useNiveaus,
  useWerkplekken,
} from '../lib/spits'
import {
  maakVoorstel,
  samenvatten,
  useEitjeTeam,
  inDeSpits,
  useNaarEitje,
  useRoosterMensen,
  useVoorkeuren,
  volgendBlok,
  wensenUit,
  type Dienstvoorstel,
  type Weekuitslag,
} from '../lib/voorstel'
import { vandaagStr } from '../lib/openingstijden'

/* Een conceptrooster voorstellen.
 *
 * Alles wat eerder is gebouwd komt hier samen: het weeksjabloon zegt hoeveel
 * plekken er per dag te vullen zijn, de vaste diensten liggen al vast, eitje
 * weet wie er kan, en de vaste dagen zeggen wat iemand liever wil.
 *
 * Dit scherm schrijft niets weg — niet hier en niet in eitje. Een voorstel dat
 * meteen ergens landt is geen voorstel.
 *
 * **Waarom een raster en geen lijst.** Een blok is vier weken; als lijst zijn
 * dat achtentwintig kaarten met samen ruim honderd regels, en dan lees je geen
 * rooster meer maar scrol je langs tekst. Een week hoort op één scherm te
 * passen zoals een rooster eruitziet: dagen naast elkaar, soorten diensten
 * onder elkaar.
 *
 * De uitleg per dienst is daarmee niet verdwenen maar verplaatst. Klik een
 * naam aan en hij staat erboven. Zonder uitleg kun je een rooster niet
 * nakijken, maar hem bij alle honderdveertig diensten tegelijk tonen maakt het
 * onleesbaar — en dan kijk je nergens meer naar.
 *
 * Wat hier níet gebeurt: wie op welke werkplek komt te staan. Dit verdeelt
 * diensten; de indeling over kassa, patat en de rest doet de spitsindeling.
 */

const SOORTEN: Soort[] = ['voorbereiding', 'dag', 'avond']

/** De eerste kolom blijft staan als je opzij schuift; anders weet je bij zes
 *  dagen naast elkaar niet meer welke rij je leest. */
const EERSTE = 'sticky left-0 z-10 bg-surface'

function Cel({
  diensten,
  tijdErbij,
  gekozen,
  onKies,
}: {
  diensten: Dienstvoorstel[]
  tijdErbij: boolean
  gekozen: Dienstvoorstel | null
  onKies: (d: Dienstvoorstel) => void
}) {
  if (diensten.length === 0) return <span className="text-sm text-muted">—</span>

  return (
    <div className="flex flex-col gap-0.5">
      {diensten.map((d, i) => {
        const open = !d.medewerker_id
        const dit = gekozen === d
        return (
          <button
            key={`${d.begint}-${d.medewerker_id ?? `open${i}`}`}
            type="button"
            onClick={() => onKies(d)}
            className={`flex flex-wrap items-baseline gap-x-1.5 rounded-[3px] px-1 py-0.5 text-left text-sm transition-colors hover:bg-surface-2 ${
              dit ? 'bg-surface-2 ring-1 ring-accent' : ''
            }`}
          >
            <span className={open ? 'font-semibold text-bad' : ''}>
              {open ? 'Nog niemand' : (d.naam ?? '').split(' ')[0]}
            </span>
            {/* De tijd staat er alleen bij als hij op die dag afwijkt. Overal
                de klok erbij zetten verdubbelt de hoogte voor iets dat bijna
                altijd hetzelfde is. */}
            {tijdErbij && <span className="text-xs tabular-nums text-muted">{klok(d.begint)}</span>}
            {d.waarschuwing && <AlertTriangle className="size-3 shrink-0 text-warn" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

function Week({
  maandag,
  diensten,
  gekozen,
  onKies,
  gekozenDag,
  onKiesDag,
}: {
  maandag: string
  diensten: Dienstvoorstel[]
  gekozen: Dienstvoorstel | null
  onKies: (d: Dienstvoorstel) => void
  gekozenDag: string | null
  onKiesDag: (datum: string) => void
}) {
  const dagen = useMemo(() => [...new Set(diensten.map((d) => d.datum))].sort(), [diensten])
  const open = diensten.filter((d) => !d.medewerker_id).length

  /* Per dag en soort: staan er meerdere begintijden door elkaar? Alleen dan
     hoort de klok in de cel. */
  const gemengd = useMemo(() => {
    const uit = new Set<string>()
    for (const dag of dagen) {
      for (const soort of SOORTEN) {
        const tijden = new Set(
          diensten.filter((d) => d.datum === dag && d.soort === soort).map((d) => d.begint),
        )
        if (tijden.size > 1) uit.add(`${dag}|${soort}`)
      }
    }
    return uit
  }, [dagen, diensten])

  if (dagen.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Kopje>Week van {datumKort(maandag)}</Kopje>
        <span className="text-sm text-muted">
          {diensten.length} diensten
          {open > 0 && <span className="text-bad">{` · ${open} open`}</span>}
        </span>
      </div>

      <Kaart className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className={`${EERSTE} py-2 pl-4 pr-3 font-semibold`} />
              {dagen.map((dag) => (
                <th key={dag} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {/* Aanklikbaar: dan zie je eronder wie er die dag waar staat.
                      Zes werkplekken per dag in het raster zetten zou het
                      onleesbaar maken. */}
                  <button
                    type="button"
                    onClick={() => onKiesDag(dag)}
                    className={`rounded-[3px] px-1 py-0.5 text-left transition-colors hover:bg-surface-2 ${
                      gekozenDag === dag ? 'bg-surface-2 ring-1 ring-accent' : ''
                    }`}
                  >
                    {dagnaam(dag, true)}
                    <span className="block text-xs font-normal">{datumKort(dag)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOORTEN.map((soort) => (
              <tr key={soort} className="border-b border-line align-top last:border-0">
                <th className={`${EERSTE} whitespace-nowrap py-2 pl-4 pr-3 text-left font-semibold`}>
                  {SOORTTEKST[soort]}
                </th>
                {dagen.map((dag) => (
                  <td key={dag} className="px-3 py-2">
                    <Cel
                      diensten={diensten.filter((d) => d.datum === dag && d.soort === soort)}
                      tijdErbij={gemengd.has(`${dag}|${soort}`)}
                      gekozen={gekozen}
                      onKies={onKies}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>
    </div>
  )
}

/* De uitleg bij de dienst die je hebt aangeklikt. Zonder uitleg kun je een
   rooster niet nakijken; met uitleg bij alles tegelijk kijk je nergens meer
   naar. Vandaar: op verzoek, en één tegelijk. */
function Uitleg({ d }: { d: Dienstvoorstel }) {
  const open = !d.medewerker_id
  return (
    <Kaart className={`flex flex-col gap-1 p-4 ${open ? 'border-bad' : ''}`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-semibold ${open ? 'text-bad' : ''}`}>
          {open ? 'Nog niemand' : d.naam}
        </span>
        <span className="text-sm text-muted">
          {dagnaam(d.datum, true)} {datumKort(d.datum)} · {klok(d.begint)}–{klok(d.eindigt)} ·{' '}
          {SOORTTEKST[d.soort].toLowerCase()}
        </span>
      </p>
      <p className="text-sm text-muted">{d.uitleg}</p>
      {d.waarschuwing && (
        <p className="flex items-center gap-1.5 text-sm text-warn">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {d.waarschuwing}
        </p>
      )}
      {open && d.teVragen && d.teVragen.length > 0 && (
        <p className="flex items-start gap-1.5 text-sm">
          <Phone className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
          Te vragen: {d.teVragen.join(', ')}
        </p>
      )}
    </Kaart>
  )
}

/* Het voorstel ongepubliceerd in eitje zetten.
 *
 * Met een tussenstap, want dit schrijft in een systeem waar het personeel in
 * kijkt. Niet omdat het gevaarlijk is — ongepubliceerde diensten zijn volgens
 * eitje alleen voor beheerders zichtbaar — maar omdat één muisklik te weinig
 * afstand is tot iets wat buiten de app gebeurt.
 *
 * Twee keer drukken vervangt wat er stond. De serverfunctie haalt eerst weg
 * wat de app er eerder neerzette en schrijft daarna opnieuw; diensten die jij
 * in eitje met de hand hebt gemaakt blijven staan. */
function NaarEitje({ voorstel }: { voorstel: Dienstvoorstel[] }) {
  const [vraagt, setVraagt] = useState(false)
  const [weken, setWeken] = useState<Weekuitslag[]>([])
  const sturen = useNaarEitje()
  const team = useEitjeTeam()

  const totaal = weken.reduce((som, w) => som + w.geschreven, 0)
  const vervangen = weken.reduce((som, w) => som + w.weggehaald, 0)
  const zonderNaam = weken.reduce((som, w) => som + w.zonder_naam, 0)

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Naar eitje</p>
          <p className="max-w-xl text-sm text-muted">
            Zet dit voorstel ongepubliceerd in eitje. Je team ziet er niets van; jij kijkt het daar
            na en geeft het zelf vrij.
            {team.data && ` De diensten komen in het team ${team.data.naam}.`}
          </p>
        </div>
        {!vraagt && (
          <Knop soort="rustig" bezig={sturen.isPending} onClick={() => setVraagt(true)}>
            <Send className="size-4" aria-hidden />
            Als concept in eitje zetten
          </Knop>
        )}
      </div>

      {vraagt && !sturen.isPending && weken.length === 0 && (
        <div className="flex flex-col gap-2 rounded-[4px] border border-line-strong p-3">
          <p className="text-sm">
            Dit zet <strong>{voorstel.length} diensten</strong> in eitje, ongepubliceerd. Stond er
            van een eerdere keer al een concept voor deze weken, dan wordt dat eerst weggehaald —
            diensten die je daar zelf hebt gemaakt blijven staan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Knop
              onClick={() =>
                sturen.mutate(
                  {
                    voorstel,
                    teamId: team.data?.id,
                    onWeek: (w) => setWeken((v) => [...v, w]),
                  },
                  { onError: () => setVraagt(false) },
                )
              }
            >
              Ja, in eitje zetten
            </Knop>
            <Knop soort="rustig" onClick={() => setVraagt(false)}>
              Toch niet
            </Knop>
          </div>
        </div>
      )}

      {sturen.isPending && (
        <p className="text-sm text-muted">
          Bezig — {weken.length} {weken.length === 1 ? 'week' : 'weken'} gedaan, {totaal} diensten
          weggeschreven. Dit duurt ongeveer een minuut per week, want eitje wil niet te snel
          achter elkaar aangesproken worden.
        </p>
      )}

      {sturen.error && <Mislukt tekst={sturen.error.message} />}

      {!sturen.isPending && weken.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[4px] border border-good p-3">
          <p className="text-sm">
            <strong>{totaal} diensten</strong> staan nu ongepubliceerd in eitje
            {vervangen > 0 && `, en ${vervangen} van een eerdere ronde zijn weggehaald`}. Geef ze
            daar vrij als je tevreden bent.
          </p>
          {zonderNaam > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-warn">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {zonderNaam} {zonderNaam === 1 ? 'dienst staat' : 'diensten staan'} er als open
              dienst: die medewerker is in eitje niet bekend.
            </p>
          )}
        </div>
      )}
    </Kaart>
  )
}

/* Wie waar staat tijdens de spits van één dag.
 *
 * Hetzelfde rekenwerk als het spitsscherm, alleen op het voorstel in plaats van
 * op het ingelezen rooster. Er wordt echt gezocht en niet van boven naar
 * beneden gevuld: de beste kassa is soms ook de beste patatbakker, en dan moet
 * er één schuiven.
 *
 * Doordeweeks geldt een eigen volgorde van belang, dus met vier man worden
 * andere plekken bezet dan in het weekend. Dat hoort hier mee te doen —
 * anders kijk je naar een indeling die op zaterdag klopt en op dinsdag niet.
 *
 * Staat hier een plek leeg, dan is dat geen fout van de indeling maar een paar
 * handen dat je niet hebt: een open dienst in het voorstel erboven. */
function Plekindeling({ datum, voorstel }: { datum: string; voorstel: Dienstvoorstel[] }) {
  const werkplekken = useWerkplekken()
  const niveaus = useNiveaus()

  const indeling = useMemo(() => {
    if (!werkplekken.data || !niveaus.data) return null
    const mensen = inDeSpits(voorstel, datum)
    if (mensen.length === 0) return null
    return maakIndeling({
      stoelen: stoelenVan(werkplekken.data, isDoordeweeks(datum)),
      mensen,
      niveaus: niveaus.data,
    })
  }, [datum, voorstel, werkplekken.data, niveaus.data])

  if (!indeling) return null

  return (
    <Kaart className="flex flex-col gap-2 p-4">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">Plekken om 17:00</span>
        <span className="text-sm text-muted">
          {dagnaam(datum, true)} {datumKort(datum)}
          {isDoordeweeks(datum) && ' · doordeweekse volgorde'}
        </span>
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {indeling.plekken.map((p) => (
          <li key={p.stoel.sleutel} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-sm text-muted">{stoelnaam(p.stoel)}</span>
            <span className={`text-sm font-semibold ${p.persoon ? '' : 'text-bad'}`}>
              {p.persoon ? p.persoon.naam : 'leeg'}
            </span>
          </li>
        ))}
      </ul>

      {indeling.onbezet.length > 0 && (
        <p className="text-sm text-muted">
          {indeling.onbezet.map(stoelnaam).join(', ')} {indeling.onbezet.length === 1 ? 'blijft' : 'blijven'}{' '}
          leeg: er staan te weinig mensen. Dat is geen keuze van de indeling maar een open dienst
          hierboven.
        </p>
      )}

      {indeling.over.length > 0 && (
        <p className="text-sm text-muted">
          Zonder plek: {indeling.over.map((o) => o.persoon.naam).join(', ')}
          {indeling.over.some((o) => o.reden === 'kan_niks') &&
            ' — voor wie nergens op staat beoordeeld, of overal op "nooit".'}
        </p>
      )}
    </Kaart>
  )
}

export function RoosterVoorstel() {
  const blok = useMemo(() => volgendBlok(vandaagStr()), [])
  const [van, setVan] = useState(blok.van)
  const [tot, setTot] = useState(blok.tot)
  /* Pas rekenen als je erom vraagt. Meteen een voorstel tonen zodra het scherm
     opent, wekt de indruk dat er al iets besloten is. */
  const [periode, setPeriode] = useState<{ van: string; tot: string } | null>(null)
  const [gekozen, setGekozen] = useState<Dienstvoorstel | null>(null)
  const [gekozenDag, setGekozenDag] = useState<string | null>(null)

  const sjabloon = useSjabloon()
  const vast = useVasteDiensten()
  const mensen = useRoosterMensen()
  const wieKan = useWieKanEr(periode?.van ?? van, periode?.tot ?? tot)
  const voorkeuren = useVoorkeuren()

  const klaar = sjabloon.data && vast.data && mensen.data && wieKan.data && voorkeuren.data

  const voorstel = useMemo(() => {
    if (!periode || !klaar) return null
    return maakVoorstel({
      van: periode.van,
      tot: periode.tot,
      sjabloon: sjabloon.data!,
      vast: vast.data!,
      mensen: mensen.data!,
      opgaven: wieKan.data!.opgaven,
      afwezig: wieKan.data!.afwezig,
      wensen: wensenUit(voorkeuren.data!),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, klaar, sjabloon.data, vast.data, mensen.data, wieKan.data, voorkeuren.data])

  const weken = useMemo(() => {
    const kaart = new Map<string, Dienstvoorstel[]>()
    for (const d of voorstel ?? []) {
      const week = maandagVan(d.datum)
      if (!kaart.has(week)) kaart.set(week, [])
      kaart.get(week)!.push(d)
    }
    return [...kaart.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [voorstel])

  const totalen = voorstel ? samenvatten(voorstel) : null
  const fout = sjabloon.error ?? vast.error ?? mensen.error ?? wieKan.error ?? voorkeuren.error

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="max-w-2xl text-sm text-muted">
          Een voorstel op basis van je weeksjabloon, je vaste diensten en wie er volgens eitje kan.
          Er wordt niets weggeschreven — niet hier en niet in eitje. Klik een naam aan om te zien
          waarom hij daar staat, of een dag om te zien wie er dan waar staat.
        </p>
        <p className="max-w-2xl text-sm text-muted">
          Dit verdeelt diensten over mensen. Welke plek iemand tijdens de spits krijgt, rekent de
          spitsmodule erbij zodra je een dag aanklikt.
        </p>
      </div>

      <Kaart className="flex flex-wrap items-end gap-3 p-4">
        <Veld label="Van" type="date" value={van} onChange={(e) => setVan(e.target.value)} />
        <Veld label="Tot en met" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
        <Knop
          disabled={!van || !tot || van > tot || !klaar}
          onClick={() => {
            setGekozen(null)
            setGekozenDag(null)
            setPeriode({ van, tot })
          }}
        >
          <Wand2 className="size-4" aria-hidden />
          Maak voorstel
        </Knop>
        {!periode && (
          <p className="w-full text-sm text-muted">
            Standaard het volgende blok: vier weken, beginnend op de maandag over twee weken.
          </p>
        )}
      </Kaart>

      {fout && <Mislukt tekst={fout.message} />}
      {periode && !klaar && <Laden tekst="Gegevens ophalen…" />}

      {totalen && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Pil soort="neutraal">{totalen.diensten} diensten</Pil>
            <Pil soort={totalen.open > 0 ? 'fout' : 'goed'}>
              {totalen.open === 0 ? 'allemaal ingevuld' : `${totalen.open} open`}
            </Pil>
            {totalen.metWaarschuwing > 0 && (
              <Pil soort="letop">{totalen.metWaarschuwing} met een kanttekening</Pil>
            )}
          </div>

          {gekozen && <Uitleg d={gekozen} />}
          {gekozenDag && <Plekindeling datum={gekozenDag} voorstel={voorstel!} />}

          <NaarEitje key={`${periode?.van}-${periode?.tot}`} voorstel={voorstel!} />

          <div className="flex flex-col gap-5">
            {weken.map(([maandag, diensten]) => (
              <Week
                key={maandag}
                maandag={maandag}
                diensten={diensten}
                gekozen={gekozen}
                onKies={(d) => setGekozen((vorige) => (vorige === d ? null : d))}
                gekozenDag={gekozenDag}
                onKiesDag={(dag) => setGekozenDag((vorige) => (vorige === dag ? null : dag))}
              />
            ))}
          </div>

          {/* Wie hoeveel krijgt. Staat onder het rooster en niet erboven: eerst
              kijk je of de weken kloppen, daarna of het eerlijk is verdeeld. */}
          <div className="flex flex-col gap-2">
            <Kopje>Diensten per persoon</Kopje>
            <Kaart>
              <ul className="flex flex-col divide-y divide-line">
                {totalen.perPersoon.map((p) => (
                  <li key={p.naam} className="flex items-baseline justify-between gap-3 px-4 py-2">
                    <span className="text-sm font-semibold">{p.naam}</span>
                    <span className="text-sm tabular-nums text-muted">{p.diensten}</span>
                  </li>
                ))}
              </ul>
            </Kaart>
            {totalen.perPersoon.length < (mensen.data?.length ?? 0) && (
              <p className="flex items-start gap-2 text-sm text-muted">
                <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
                {(mensen.data?.length ?? 0) - totalen.perPersoon.length} medewerkers staan dit blok
                nergens op. Dat kan kloppen, maar het is het nakijken waard.
              </p>
            )}
          </div>
        </>
      )}

      {voorstel && voorstel.length === 0 && (
        <Leeg
          titel="Hier valt niets te verdelen"
          uitleg="Voor deze periode staan er geen diensten in het weeksjabloon."
        />
      )}
    </div>
  )
}
