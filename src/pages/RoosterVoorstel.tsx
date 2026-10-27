import { useMemo, useState } from 'react'
import { AlertTriangle, CircleDashed, Phone, Wand2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil, Veld } from '../components/ui'
import { dagnaam, datumKort } from '../lib/rooster'
import { useWieKanEr } from '../lib/beschikbaarheid'
import { useVasteDagenOverzicht } from '../lib/vasteDagen'
import { SOORTTEKST, klok, useSjabloon, useVasteDiensten } from '../lib/weeksjabloon'
import {
  maakVoorstel,
  samenvatten,
  useRoosterMensen,
  volgendBlok,
  wensenUit,
  type Dienstvoorstel,
} from '../lib/voorstel'
import { vandaagStr } from '../lib/openingstijden'

/* Een conceptrooster voorstellen.
 *
 * Alles wat eerder is gebouwd komt hier samen: het weeksjabloon zegt hoeveel
 * plekken er per dag te vullen zijn, de vaste diensten liggen al vast, eitje
 * weet wie er kan, en de vaste dagen zeggen wat iemand liever wil.
 *
 * Dit scherm schrijft niets weg — niet hier en niet in eitje. Je kijkt ernaar,
 * en wat je ervan vindt bepaalt of het de moeite waard is om het echt te laten
 * wegschrijven. Een voorstel dat meteen ergens landt is geen voorstel.
 *
 * Bij elke dienst staat waarom die persoon daar staat. Een voorstel dat dat
 * niet kan uitleggen kun je niet nakijken, en dan keur je het goed omdat de
 * computer het zei.
 *
 * Wat hier níet gebeurt: wie op welke werkplek komt te staan. Dit verdeelt
 * diensten — wie werkt er wanneer. De verdeling over kassa, patat en de rest
 * doet de spitsindeling, en die draait op het rooster dat hieruit komt.
 */

function Dienst({ d }: { d: Dienstvoorstel }) {
  const open = !d.medewerker_id

  return (
    <li className="flex flex-col gap-0.5 px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={`font-semibold ${open ? 'text-bad' : ''}`}>
          {open ? 'Nog niemand' : d.naam}
        </span>
        <span className="text-sm tabular-nums text-muted">
          {klok(d.begint)}–{klok(d.eindigt)} · {SOORTTEKST[d.soort].toLowerCase()}
        </span>
      </div>
      <span className="text-sm text-muted">{d.uitleg}</span>
      {d.waarschuwing && (
        <span className="flex items-center gap-1.5 text-sm text-warn">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {d.waarschuwing}
        </span>
      )}
      {/* Open plekken rondappen is wat er nu met de hand gebeurt, dus hoort de
          lijst hier te staan in plaats van dat je hem zelf bij elkaar zoekt.
          Wie met verlof is staat er niet bij: iemand bellen die er niet is, is
          erger dan niemand bellen. */}
      {open && d.teVragen && d.teVragen.length > 0 && (
        <span className="flex items-start gap-1.5 text-sm text-muted">
          <Phone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Te vragen: {d.teVragen.join(', ')}
        </span>
      )}
    </li>
  )
}

function Dag({ datum, diensten }: { datum: string; diensten: Dienstvoorstel[] }) {
  const open = diensten.filter((d) => !d.medewerker_id).length

  return (
    <Kaart className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="font-semibold">
          {dagnaam(datum, true)} {datumKort(datum)}
        </p>
        <span className="text-sm text-muted">
          {diensten.length} {diensten.length === 1 ? 'dienst' : 'diensten'}
          {open > 0 && <span className="text-bad">{` · ${open} open`}</span>}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {diensten.map((d, i) => (
          <Dienst key={`${d.datum}-${d.begint}-${d.medewerker_id ?? `open${i}`}`} d={d} />
        ))}
      </ul>
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

  const sjabloon = useSjabloon()
  const vast = useVasteDiensten()
  const mensen = useRoosterMensen()
  const wieKan = useWieKanEr(periode?.van ?? van, periode?.tot ?? tot)
  const overzicht = useVasteDagenOverzicht()

  const klaar =
    sjabloon.data && vast.data && mensen.data && wieKan.data && overzicht.data

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
      wensen: wensenUit(overzicht.data! as unknown as { persoon_id: string | null }[]),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, klaar, sjabloon.data, vast.data, mensen.data, wieKan.data, overzicht.data])

  const perDag = useMemo(() => {
    const kaart = new Map<string, Dienstvoorstel[]>()
    for (const d of voorstel ?? []) {
      if (!kaart.has(d.datum)) kaart.set(d.datum, [])
      kaart.get(d.datum)!.push(d)
    }
    return [...kaart.entries()]
  }, [voorstel])

  const totalen = voorstel ? samenvatten(voorstel) : null
  const fout = sjabloon.error ?? vast.error ?? mensen.error ?? wieKan.error ?? overzicht.error

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="max-w-2xl text-sm text-muted">
          Een voorstel op basis van je weeksjabloon, je vaste diensten en wie er volgens eitje kan.
          Er wordt niets weggeschreven — niet hier en niet in eitje. Je kijkt ernaar, en daarna
          bepaal je of het goed genoeg is om echt te gebruiken.
        </p>
        <p className="max-w-2xl text-sm text-muted">
          Wie op welke werkplek komt te staan zit hier niet in. Dit verdeelt diensten; de indeling
          over kassa, patat en de rest doet de spits.
        </p>
      </div>

      <Kaart className="flex flex-wrap items-end gap-3 p-4">
        <Veld label="Van" type="date" value={van} onChange={(e) => setVan(e.target.value)} />
        <Veld label="Tot en met" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
        <Knop
          disabled={!van || !tot || van > tot || !klaar}
          onClick={() => setPeriode({ van, tot })}
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

          {/* Wie hoeveel krijgt. Dit is het eerste waar je naar kijkt als je
              wilt weten of een voorstel eerlijk is uitgevallen. */}
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

          <div className="flex flex-col gap-3">
            {perDag.map(([datum, diensten]) => (
              <Dag key={datum} datum={datum} diensten={diensten} />
            ))}
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
