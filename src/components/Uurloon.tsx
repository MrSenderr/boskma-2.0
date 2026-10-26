import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Kaart, Knop, Veld } from './ui'
import {
  VAKKRACHT_UREN,
  caoUurloon,
  euro,
  isVakkracht,
  onderCao,
  vakkrachtDoetErtoe,
} from '../lib/cao'
import { vandaagIso } from '../lib/datums'
import { usePersoonWijzigen, type Persoon } from '../lib/personeel'
import { useErvaringsuren } from '../lib/gewerkteUren'

/* Het uurloon invullen, met de cao ernaast.
 *
 * Het bedrag staat er al in zodra de app de geboortedatum kent. Dat scheelt
 * opzoeken, maar het belangrijkste is dat de verkeerde trede niet meer per
 * ongeluk blijft staan: het jeugdloon springt op een verjaardag, en een
 * contract dat volgende maand ingaat hoort het bedrag van dán te krijgen.
 *
 * Het veld volgt de cao zolang jij er niet aan hebt gezeten. Verzet je de
 * ingangsdatum over een verjaardag heen, dan verspringt het bedrag mee. Tik je
 * zelf iets in, dan houdt het op met volgen — dan is het jouw keuze, en die
 * hoort de app niet te overschrijven. Een bestaand contract telt als een keuze
 * die al gemaakt is en wordt dus nooit overschreven.
 *
 * Te laag mag, maar niet ongemerkt. Boven de cao betalen doet Boskma bij
 * iedereen boven de achttien; eronder is een melding en geen slot, want er
 * zijn gevallen waarin afwijken terecht is.
 *
 * Bij 18, 19 en 20 jaar staat er geen bedrag maar een vraag. Daar kent de cao
 * twee bodems — vakkracht of niet — en zonder antwoord zou de app moeten
 * gokken. Het lage bedrag neerzetten maakt een keuze die jij hoort te maken;
 * het hoge kost geld dat je misschien niet hoeft uit te geven. Dus stelt hij
 * de vraag op het moment dat het ertoe doet, en legt het antwoord vast. Onder
 * de achttien bestaat een vakkracht niet en vanaf eenentwintig zijn de twee
 * bodems gelijk; daar blijft de vraag dus weg. */

/* Uit de database komt een bedrag als tekst terug ("5.2500"), uit het veld als
   getal. Allebei moeten ze hier binnen kunnen. */
function getal(w: number | string | null | undefined): number | null {
  if (w === null || w === undefined || w === '') return null
  const n = Number(w)
  return Number.isFinite(n) ? n : null
}

/* De vraag, met beide bedragen erbij zodat je ziet wat je kiest. */
function Vraag({ persoon, opDatum }: { persoon: Persoon; opDatum: string }) {
  const wijzig = usePersoonWijzigen(persoon.id)
  const uren = useErvaringsuren(persoon.id, persoon.geboortedatum)
  const [fout, setFout] = useState<string | null>(null)

  const gewoon = caoUurloon(persoon.geboortedatum, opDatum, false)
  const vak = caoUurloon(persoon.geboortedatum, opDatum, true)
  if (!gewoon || !vak) return null

  const zet = (vakkracht: 'nee' | 'diploma' | 'ervaring') =>
    wijzig.mutate(
      { vakkracht, vakkracht_sinds: vakkracht === 'nee' ? null : vandaagIso() },
      { onError: (e) => setFout(e.message) },
    )

  return (
    <Kaart className="flex flex-col gap-3 border-warn p-4">
      <p className="flex items-start gap-2 text-sm text-warn">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Is {persoon.voornaam ?? 'deze medewerker'} vakkracht? Bij {gewoon.leeftijd} jaar is de
          bodem {euro(vak.bedrag)} voor een vakkracht en {euro(gewoon.bedrag)} voor wie dat niet is.
        </span>
      </p>

      {/* Wat de app van de ervaring weet. Met opzet geen antwoord maar een
          getal met een voorbehoud: uren bij een vorige werkgever tellen
          volgens de cao mee en die staan hier niet in. */}
      {uren.data && (
        <p className="text-sm text-muted">
          In de app staan {uren.data.uren.toLocaleString('nl-NL')} gewerkte uren sinds zijn
          achttiende verjaardag. De cao vraagt om {VAKKRACHT_UREN.toLocaleString('nl-NL')} uur, en
          uren bij een vorige werkgever tellen daarin mee. Die kent de app niet, dus het werkelijke
          aantal ligt hoger.
        </p>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}

      <div className="flex flex-wrap gap-2">
        <Knop soort="rustig" bezig={wijzig.isPending} onClick={() => zet('diploma')}>
          Ja — vakdiploma
        </Knop>
        <Knop soort="rustig" bezig={wijzig.isPending} onClick={() => zet('ervaring')}>
          Ja — genoeg ervaring
        </Knop>
        <Knop soort="rustig" bezig={wijzig.isPending} onClick={() => zet('nee')}>
          Nee
        </Knop>
      </div>
    </Kaart>
  )
}

export function Uurloonveld({
  label = 'Uurloon bruto',
  waarde,
  onVeranderd,
  persoon,
  opDatum,
  onKlaar,
}: {
  label?: string
  waarde: number | string | null | undefined
  onVeranderd: (bedrag: number | null) => void
  persoon: Persoon
  /** De dag waarop het loon ingaat. Leeg betekent vandaag. */
  opDatum?: string | null
  /* Als het bewaren niet bij elke toetsaanslag hoort te gebeuren maar pas als
     je het veld verlaat — zoals op de kaart van de medewerker, waar elke
     wijziging meteen de database in gaat. */
  onKlaar?: (bedrag: number | null) => void
}) {
  const dag = opDatum || vandaagIso()
  const bedrag = getal(waarde)
  const vakkracht = isVakkracht(persoon, dag)
  const cao = caoUurloon(persoon.geboortedatum, dag, vakkracht)
  const telaag = onderCao(bedrag, persoon.geboortedatum, dag, vakkracht)

  /* Zolang de vraag openstaat vult de app niets voor. */
  const vraagOpen = !persoon.vakkracht && vakkrachtDoetErtoe(persoon.geboortedatum, dag)

  /* Een bedrag dat er al stond is een keuze die al gemaakt is. Alleen een leeg
     veld laat zich vullen. */
  const aangeraakt = useRef(bedrag !== null)

  useEffect(() => {
    if (aangeraakt.current || vraagOpen || !cao) return
    onVeranderd(cao.bedrag)
    /* En meteen bewaren waar dat hoort. Op de kaart van de medewerker slaat
       elk veld zichzelf op zodra je het verzet; deed het voorgevulde bedrag
       dat niet, dan stond er € 6,75 op het scherm terwijl de database leeg
       bleef — en zei het formulier eronder "nog invullen: uurloon" bij een
       veld waar een bedrag in stond. Een veld dat ingevuld lijkt maar het niet
       is, is erger dan een leeg veld. */
    onKlaar?.(cao.bedrag)
    // onVeranderd en onKlaar veranderen elke render; het bedrag is wat telt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cao?.bedrag, vraagOpen])

  return (
    <div className="flex flex-col gap-1.5">
      <Veld
        label={label}
        type="number"
        step="0.01"
        inputMode="decimal"
        value={bedrag === null ? '' : String(bedrag)}
        onChange={(e) => {
          aangeraakt.current = true
          onVeranderd(e.target.value === '' ? null : Number(e.target.value))
        }}
        onBlur={onKlaar ? () => onKlaar(bedrag) : undefined}
      />

      {vraagOpen ? (
        <Vraag persoon={persoon} opDatum={dag} />
      ) : telaag ? (
        <p className="flex items-start gap-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Onder de cao. Bij {telaag.leeftijd} jaar hoort {euro(telaag.bedrag)} per uur
            {vakkracht ? ' voor een vakkracht' : ''}.
          </span>
        </p>
      ) : (
        cao && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            {vakkracht && <Check className="size-3.5 shrink-0 text-good" aria-hidden />}
            <span>
              Cao bij {cao.leeftijd} jaar{vakkracht ? ', als vakkracht' : ''}: {euro(cao.bedrag)} per
              uur.
            </span>
          </p>
        )
      )}
    </div>
  )
}
