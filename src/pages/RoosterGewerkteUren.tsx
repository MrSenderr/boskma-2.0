import { useState } from 'react'
import { Kaart, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import {
  datumKort,
  maandagVan,
  perWeek,
  statistiek,
  urenTekst,
  useRooster,
  verschuif,
  weekKolommen,
  type PerWeek,
  type Statistiek,
  type WeekKolom,
} from '../lib/rooster'

/* Wat er gewerkt is, per persoon.
 *
 * Twee manieren van kijken. **Totaal** is drie kolommen: naam, uren, diensten.
 * **Per week** zet de weken naast elkaar, zodat je ziet of iemand elke week
 * hetzelfde draait of dat het schommelt — en dat laatste is wat je wilt weten
 * bij een oproepkracht, bij de jeugduren van een vijftienjarige, en bij de
 * vraag of een contract nog klopt met wat er feitelijk gebeurt.
 *
 * Er stonden eerst zeven kolommen: gepland, gewerkt, verschil, diensten,
 * dagen, langste. Dat is meer dan je op een blad uren wilt lezen. Wat eraf
 * ging, ging er met reden af:
 *
 * **De vergelijking met het rooster.** Die kwam uit het Excel-bestand dat je er
 * met de hand in sleepte. Nu de uren vanzelf binnenkomen zou die kolom stil
 * leeglopen, en een lege kolom die vroeger iets zei is erger dan geen kolom.
 * Hij komt terug zodra de planning ook uit de koppeling komt.
 *
 * **De balkjes onder elke naam.** Die vergeleken mensen met elkaar. Wie het
 * meest werkte is bijna nooit de vraag; hoeveel er gewerkt is wel.
 *
 * **"12:30".** Dat leest als half één 's middags. Uren staan er nu als getal.
 */

/* De periodes die je in de praktijk wilt zien. Week en maand allebei: voor een
   snelle blik kijk je per week, voor het loonbureau per maand. */
function periodes(vandaag = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const jaar = vandaag.getFullYear()
  const maand = vandaag.getMonth()
  const eerste = (j: number, m: number) => iso(new Date(Date.UTC(j, m, 1)))
  const laatste = (j: number, m: number) => iso(new Date(Date.UTC(j, m + 1, 0)))

  const dezeWeek = maandagVan(vandaag)
  const vorigeWeek = verschuif(dezeWeek, -7)

  return [
    { sleutel: 'week', label: 'Deze week', van: dezeWeek, tot: verschuif(dezeWeek, 6) },
    { sleutel: 'vorigeweek', label: 'Vorige week', van: vorigeWeek, tot: verschuif(vorigeWeek, 6) },
    { sleutel: 'deze', label: 'Deze maand', van: eerste(jaar, maand), tot: laatste(jaar, maand) },
    { sleutel: 'vorige', label: 'Vorige maand', van: eerste(jaar, maand - 1), tot: laatste(jaar, maand - 1) },
    { sleutel: 'kwartaal', label: 'Laatste 3 maanden', van: eerste(jaar, maand - 2), tot: iso(vandaag) },
    { sleutel: 'jaar', label: 'Dit jaar', van: `${jaar}-01-01`, tot: iso(vandaag) },
  ]
}

function Keuzeknop({
  aan,
  onClick,
  children,
}: {
  aan: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aan}
      className={`min-h-11 rounded-[4px] border-[1.5px] px-3 text-sm font-semibold transition-colors ${
        aan ? 'border-accent bg-surface-2' : 'border-line-strong hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}

function Naam({ naam, gekoppeld }: { naam: string; gekoppeld: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 font-semibold">
      {naam}
      {!gekoppeld && <Pil soort="letop">Niet gekoppeld</Pil>}
    </span>
  )
}

function TotaalTabel({ rijen }: { rijen: Statistiek[] }) {
  const uren = rijen.reduce((som, r) => som + r.gewerkt, 0)
  const diensten = rijen.reduce((som, r) => som + r.shifts, 0)

  return (
    <Kaart>
      {/* Geen vaste minimumbreedte: drie kolommen horen op een telefoon te
          passen zonder slepen. De naam mag afbreken, de getallen niet. */}
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-3 pl-4 pr-2 font-semibold">Medewerker</th>
            <th className="whitespace-nowrap px-2 py-3 text-right font-semibold">Uren</th>
            <th className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-semibold">Diensten</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.sleutel} className="border-b border-line last:border-0">
              <td className="py-3 pl-4 pr-2">
                <Naam naam={r.naam} gekoppeld={Boolean(r.medewerker_id)} />
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">
                {urenTekst(r.gewerkt)}
              </td>
              <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right tabular-nums text-muted">
                {r.shifts}
              </td>
            </tr>
          ))}
        </tbody>
        {/* Een dikkere streep erboven: zonder die scheiding leest het totaal
            als nog een medewerker die toevallig Samen heet. */}
        <tfoot className="border-t-2 border-line-strong">
          <tr className="font-semibold">
            <td className="py-3 pl-4 pr-2">Samen</td>
            <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
              {urenTekst(uren)}
            </td>
            <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right tabular-nums">{diensten}</td>
          </tr>
        </tfoot>
      </table>
    </Kaart>
  )
}

/* De naamkolom blijft staan als je naar rechts schuift. Bij dertien weken naast
   elkaar schuif je de namen anders het scherm af, en dan staat er een tabel vol
   getallen waarvan je niet meer weet van wie ze zijn. */
const NAAMKOLOM = 'sticky left-0 z-10 bg-surface'

function WeekTabel({ rijen, kolommen }: { rijen: PerWeek[]; kolommen: WeekKolom[] }) {
  const perKolom = (maandag: string) =>
    rijen.reduce((som, r) => som + (r.weken[maandag] ?? 0), 0)
  const totaal = rijen.reduce((som, r) => som + r.totaal, 0)

  return (
    <Kaart className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className={`${NAAMKOLOM} py-3 pl-4 pr-3 font-semibold`}>Medewerker</th>
            {kolommen.map((k) => (
              <th key={k.maandag} className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                wk {k.nummer}
                <span className="block text-xs font-normal">{datumKort(k.maandag)}</span>
              </th>
            ))}
            <th className="whitespace-nowrap py-3 pl-3 pr-4 text-right font-semibold">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.sleutel} className="border-b border-line last:border-0">
              <td className={`${NAAMKOLOM} py-3 pl-4 pr-3`}>
                <Naam naam={r.naam} gekoppeld={Boolean(r.medewerker_id)} />
              </td>
              {kolommen.map((k) => (
                <td
                  key={k.maandag}
                  className="whitespace-nowrap px-3 py-3 text-right tabular-nums"
                >
                  {/* Een streepje, geen nul. Een nul leest als "nul uur
                      gewerkt"; dit is "die week niet gewerkt". */}
                  {r.weken[k.maandag] ? (
                    urenTekst(r.weken[k.maandag])
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
              ))}
              <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right font-semibold tabular-nums">
                {urenTekst(r.totaal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line-strong">
          <tr className="font-semibold">
            <td className={`${NAAMKOLOM} py-3 pl-4 pr-3`}>Samen</td>
            {kolommen.map((k) => (
              <td key={k.maandag} className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                {perKolom(k.maandag) ? (
                  urenTekst(perKolom(k.maandag))
                ) : (
                  <span className="font-normal text-muted">–</span>
                )}
              </td>
            ))}
            <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right tabular-nums">
              {urenTekst(totaal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Kaart>
  )
}

export function RoosterGewerkteUren() {
  const keuzes = periodes()
  const [gekozen, setGekozen] = useState(keuzes[2])
  const [perWeekAan, setPerWeekAan] = useState(false)
  const { data, isPending, error, refetch } = useRooster(gekozen.van, gekozen.tot)

  /* De planning komt hier nog wel binnen — hij staat in de database van de
     Excel-imports — maar wordt niet getoond. Daarom een lege lijst: dan telt
     `statistiek` alleen de gewerkte uren en blijft niemand in de lijst staan
     die wel ingeroosterd was maar niet gewerkt heeft. */
  const totalen = data ? statistiek([], data.gewerkt).filter((r) => r.gewerkt > 0) : []
  const weken = data ? perWeek(data.gewerkt) : []
  const kolommen = weekKolommen(gekozen.van, gekozen.tot)

  const losse = totalen.filter((r) => !r.medewerker_id).length

  /* Bij één week zegt "per week" niets: dan is die ene kolom het totaal. */
  const weekKeuze = kolommen.length > 1
  const toonWeken = perWeekAan && weekKeuze

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2">
        {keuzes.map((p) => (
          <Keuzeknop
            key={p.sleutel}
            aan={p.sleutel === gekozen.sleutel}
            onClick={() => setGekozen(p)}
          >
            {p.label}
          </Keuzeknop>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Welke dagen je nu ziet. Bij "laatste 3 maanden" is dat anders niet
            te zien, en dan weet je niet waar een getal over gaat. */}
        <p className="text-sm text-muted">
          {datumKort(gekozen.van)} tot en met {datumKort(gekozen.tot)}
          {toonWeken && ` · ${kolommen.length} weken`}
        </p>

        {weekKeuze && (
          <div className="flex gap-2">
            <Keuzeknop aan={!perWeekAan} onClick={() => setPerWeekAan(false)}>
              Totaal
            </Keuzeknop>
            <Keuzeknop aan={perWeekAan} onClick={() => setPerWeekAan(true)}>
              Per week
            </Keuzeknop>
          </div>
        )}
      </div>

      {isPending && <Laden tekst="Uren optellen…" />}
      {error && <Mislukt tekst={error.message} opnieuw={() => refetch()} />}

      {data && totalen.length === 0 && (
        <Leeg
          titel="In deze periode is er niet gewerkt"
          uitleg="Of de uren zijn nog niet opgehaald. Kijk bij Importeren of de koppeling met eitje heeft gelopen."
        />
      )}

      {totalen.length > 0 &&
        (toonWeken ? (
          <WeekTabel rijen={weken} kolommen={kolommen} />
        ) : (
          <TotaalTabel rijen={totalen} />
        ))}

      {toonWeken && kolommen.length > 8 && (
        <p className="max-w-2xl text-sm text-muted">
          Dat zijn {kolommen.length} weken naast elkaar; schuif de tabel opzij om de rest te zien.
          De namen blijven staan.
        </p>
      )}

      {losse > 0 && (
        <p className="max-w-2xl text-sm text-muted">
          {losse === 1 ? 'Eén naam hoort' : `${losse} namen horen`} nog bij niemand. Die uren tellen
          wel mee in het totaal hierboven, maar niet in het gemiddelde van een medewerker. Koppel de
          naam bij Importeren, dan verhuist zijn hele historie mee.
        </p>
      )}
    </div>
  )
}
