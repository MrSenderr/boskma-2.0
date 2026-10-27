import { useState } from 'react'
import { Kaart, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import {
  datumKort,
  maandagVan,
  statistiek,
  urenTekst,
  useRooster,
  verschuif,
} from '../lib/rooster'

/* Wat er gewerkt is, per persoon.
 *
 * Drie kolommen en een totaal. Er stonden er zeven — gepland, gewerkt,
 * verschil, diensten, dagen, langste — en dat is meer dan je op een blad uren
 * wilt lezen. Wat eraf ging, ging er met reden af:
 *
 * **De vergelijking met het rooster.** Die kwam uit het Excel-bestand dat je
 * er met de hand in sleepte. Nu de uren vanzelf binnenkomen zou die kolom stil
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

export function RoosterGewerkteUren() {
  const keuzes = periodes()
  const [gekozen, setGekozen] = useState(keuzes[2])
  const { data, isPending, error, refetch } = useRooster(gekozen.van, gekozen.tot)

  /* De planning komt hier nog wel binnen — hij staat in de database van de
     Excel-imports — maar wordt niet getoond. Daarom een lege lijst: dan telt
     `statistiek` alleen de gewerkte uren en blijft niemand in de lijst staan
     die wel ingeroosterd was maar niet gewerkt heeft. */
  const rijen = data ? statistiek([], data.gewerkt).filter((r) => r.gewerkt > 0) : []

  const totaalMinuten = rijen.reduce((som, r) => som + r.gewerkt, 0)
  const totaalDiensten = rijen.reduce((som, r) => som + r.shifts, 0)
  const losse = rijen.filter((r) => !r.medewerker_id).length

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2">
        {keuzes.map((p) => (
          <button
            key={p.sleutel}
            type="button"
            onClick={() => setGekozen(p)}
            aria-pressed={p.sleutel === gekozen.sleutel}
            className={`min-h-11 rounded-[4px] border-[1.5px] px-3 text-sm font-semibold transition-colors ${
              p.sleutel === gekozen.sleutel
                ? 'border-accent bg-surface-2'
                : 'border-line-strong hover:bg-surface-2'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {/* Welke dagen je nu ziet. Bij "deze week" en "laatste 3 maanden" is dat
          anders niet te zien, en dan weet je niet waar een getal over gaat. */}
      <p className="text-sm text-muted">
        {datumKort(gekozen.van)} tot en met {datumKort(gekozen.tot)}
      </p>

      {isPending && <Laden tekst="Uren optellen…" />}
      {error && <Mislukt tekst={error.message} opnieuw={() => refetch()} />}

      {data && rijen.length === 0 && (
        <Leeg
          titel="In deze periode is er niet gewerkt"
          uitleg="Of de uren zijn nog niet opgehaald. Kijk bij Importeren of de koppeling met eitje heeft gelopen."
        />
      )}

      {rijen.length > 0 && (
        <Kaart>
          {/* Geen vaste minimumbreedte: drie kolommen horen op een telefoon te
              passen zonder slepen. De naam mag afbreken, de getallen niet. */}
          <table className="w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-3 pl-4 pr-2 font-semibold">Medewerker</th>
                <th className="whitespace-nowrap px-2 py-3 text-right font-semibold">Uren</th>
                <th className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-semibold">
                  Diensten
                </th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.sleutel} className="border-b border-line last:border-0">
                  <td className="py-3 pl-4 pr-2">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {r.naam}
                      {!r.medewerker_id && <Pil soort="letop">Niet gekoppeld</Pil>}
                    </span>
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
            {/* Een dikkere streep erboven: zonder die scheiding leest het
                totaal als nog een medewerker die toevallig Samen heet. */}
            <tfoot className="border-t-2 border-line-strong">
              <tr className="font-semibold">
                <td className="py-3 pl-4 pr-2">Samen</td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                  {urenTekst(totaalMinuten)}
                </td>
                <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right tabular-nums">
                  {totaalDiensten}
                </td>
              </tr>
            </tfoot>
          </table>
        </Kaart>
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
