import { useState } from 'react'
import { AlertTriangle, Check, Link2, RefreshCw, Search } from 'lucide-react'
import { Kaart, Knop, Kopje, Mislukt, Pil, Veld } from './ui'
import {
  redenTekst,
  useEitjeBijwerken,
  useEitjeProef,
  useEitjeTerughalen,
  useEitjeRondkijken,
  useEitjeVerkennen,
  type Openstaand,
  type Ophaalstand,
  type Proefuitslag,
  type Rondkijken,
  type WieKan,
  type Verkenning,
} from '../lib/eitjeKoppeling'
import { datumKort } from '../lib/rooster'

/* De koppeling met eitje, op het scherm waar tot nu toe het Excel-bestand
 * naartoe gesleept werd.
 *
 * Drie stappen in een vaste volgorde, en de derde kan niet voordat de tweede
 * groen licht heeft gegeven. Dat is geen omslachtigheid: urenregels worden
 * bewaard onder het nummer dat eitje eraan geeft, en zijn dat andere nummers
 * dan die uit de Excel, dan komt elke dienst er een tweede keer in. Dan is er
 * niets kapot en staat er geen foutmelding — alleen een urentotaal dat twee
 * keer te hoog is, in het getal dat meegaat in een aanbod voor vaste uren.
 *
 * Heeft de koppeling eerder gelopen, dan zijn die stappen klaar en blijft er
 * staan wanneer er voor het laatst is opgehaald.
 */

function Namen({ namen }: { namen: Openstaand[] }) {
  if (namen.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <p className="text-sm text-warn">
        {namen.length === 1
          ? 'Eén naam uit eitje kon ik hier niet thuisbrengen:'
          : `${namen.length} namen uit eitje kon ik hier niet thuisbrengen:`}
      </p>
      <ul className="flex flex-col gap-0.5">
        {namen.map((n) => (
          <li key={`${n.naam}|${n.reden}`} className="text-sm text-muted">
            {n.naam} — {redenTekst(n.reden)}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Hun uren komen er wél in, alleen nog niet op een persoon. Koppel de naam hieronder bij een
        import, dan verhuist de historie mee.
      </p>
    </div>
  )
}

function Stap({
  nummer,
  titel,
  uitleg,
  children,
}: {
  nummer: number
  titel: string
  uitleg: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">
          {nummer}. {titel}
        </p>
        {children}
      </div>
      <p className="text-sm text-muted">{uitleg}</p>
    </div>
  )
}

export function EitjeKoppeling({
  laatste,
}: {
  /** De laatste keer dat de koppeling uren heeft opgehaald, of null. */
  laatste: { op: string; periode_van: string | null; periode_tot: string | null } | null
}) {
  const verkennen = useEitjeVerkennen()
  const proef = useEitjeProef()
  const terughalen = useEitjeTerughalen()
  const bijwerken = useEitjeBijwerken()
  const rondkijken = useEitjeRondkijken()

  const [vanaf, setVanaf] = useState('')
  const [ronde, setRonde] = useState<Ophaalstand | null>(null)

  const verkenning: Verkenning | undefined = verkennen.data
  const uitslag: Proefuitslag | undefined = proef.data
  const bezig =
    verkennen.isPending ||
    proef.isPending ||
    terughalen.isPending ||
    bijwerken.isPending ||
    rondkijken.isPending

  const fout =
    rondkijken.error?.message ??
    verkennen.error?.message ??
    proef.error?.message ??
    terughalen.error?.message ??
    bijwerken.error?.message ??
    null

  /* Heeft de koppeling eerder gelopen, dan is de nummering al bewezen en zijn
     de eerste twee stappen gedaan. */
  const alGelopen = Boolean(laatste)

  return (
    <Kaart className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Kopje>Rechtstreeks uit eitje</Kopje>
          <p className="text-sm text-muted">
            {laatste
              ? `Laatst opgehaald op ${datumKort(laatste.op.slice(0, 10))}` +
                (laatste.periode_van
                  ? ` — ${datumKort(laatste.periode_van)} tot en met ${datumKort(
                      laatste.periode_tot ?? laatste.periode_van,
                    )}`
                  : '')
              : 'Nog niet gebruikt. Dan hoeft er geen bestand meer per mail langs.'}
          </p>
        </div>
        <Pil soort={alGelopen ? 'goed' : 'neutraal'}>{alGelopen ? 'Loopt' : 'Nieuw'}</Pil>
      </div>

      {fout && <Mislukt tekst={fout} />}

      {!alGelopen && (
        <div className="flex flex-col gap-4">
          <Stap
            nummer={1}
            titel="Kijken wat er is"
            uitleg="Haalt alleen de medewerkerslijst op en legt die naast de lijst hier. Verandert nog niets."
          >
            <Knop
              soort="rustig"
              bezig={verkennen.isPending}
              disabled={bezig && !verkennen.isPending}
              onClick={() => {
                verkennen.mutate(undefined, {
                  onSuccess: (uit) => setVanaf(uit.oudste_medewerker_vanaf ?? ''),
                })
              }}
            >
              <Link2 className="size-4" aria-hidden />
              Kijken
            </Knop>
          </Stap>

          {verkenning && (
            <div className="flex flex-col gap-3 rounded-[4px] bg-surface-2 p-4">
              <p className="text-sm">
                <strong>
                  {verkenning.gekoppeld} van de {verkenning.medewerkers_in_eitje}
                </strong>{' '}
                medewerkers in eitje zijn hier herkend.
                {verkenning.oudste_medewerker_vanaf &&
                  ` De oudste staat er sinds ${datumKort(
                    verkenning.oudste_medewerker_vanaf,
                  )}; verder terug dan dat heeft eitje geen uren.`}
              </p>
              <Namen namen={verkenning.niet_gekoppeld} />
            </div>
          )}

          <Stap
            nummer={2}
            titel="Proef op de nummering"
            uitleg="Haalt één week op die hier al staat en kijkt of eitje dezelfde nummers gebruikt als de Excel. Zonder deze controle zou elke dienst er een tweede keer in kunnen komen en zou elk urentotaal verdubbelen. Schrijft niets."
          >
            <Knop
              soort="rustig"
              bezig={proef.isPending}
              disabled={bezig && !proef.isPending}
              onClick={() => proef.mutate()}
            >
              Proef doen
            </Knop>
          </Stap>

          {uitslag && (
            <div
              className={`flex items-start gap-3 rounded-[4px] border p-4 ${
                uitslag.veilig ? 'border-good' : 'border-warn'
              }`}
            >
              {uitslag.veilig ? (
                <Check className="mt-0.5 size-5 shrink-0 text-good" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
              )}
              <div className="flex flex-col gap-1">
                <p className="font-medium">{uitslag.uitkomst}</p>
                {uitslag.uitleg && <p className="text-sm text-muted">{uitslag.uitleg}</p>}
                {uitslag.week && (
                  <p className="text-sm text-muted">
                    Gekeken naar {datumKort(uitslag.week.van)} tot en met{' '}
                    {datumKort(uitslag.week.tot)}: {uitslag.uit_eitje} uit eitje,{' '}
                    {uitslag.staat_hier_al} hier, {uitslag.nummers_die_passen} nummers die passen.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Stap
          nummer={alGelopen ? 1 : 3}
          titel="Uren terughalen"
          uitleg={
            alGelopen
              ? 'Haalt een periode opnieuw op, bijvoorbeeld om een gat op te vullen. Een week die er al staat wordt bijgewerkt, niet nog een keer toegevoegd.'
              : 'Kan pas als de proef groen licht heeft gegeven. Haalt alles op in ronden van acht weken; een jaar duurt zo ruim een minuut, want eitje geeft zeven dagen per aanvraag en vraagt om een seconde pauze ertussen.'
          }
        >
          <div className="flex flex-wrap items-end gap-2">
            <Veld
              label="Vanaf"
              type="date"
              value={vanaf}
              onChange={(e) => setVanaf(e.target.value)}
            />
            <Knop
              bezig={terughalen.isPending}
              disabled={!vanaf || (!alGelopen && !uitslag?.veilig) || (bezig && !terughalen.isPending)}
              onClick={() => {
                setRonde(null)
                terughalen.mutate({ van: vanaf, onRonde: setRonde })
              }}
            >
              Terughalen
            </Knop>
          </div>
        </Stap>

        {/* Tijdens het ophalen de laatste ronde, daarna het totaal. Een lus van
            ruim een minuut zonder iets op het scherm voelt als vastgelopen. */}
        {(terughalen.isPending ? ronde : (terughalen.data ?? null)) && (
          <OphaalBericht
            stand={(terughalen.isPending ? ronde : terughalen.data)!}
            bezig={terughalen.isPending}
          />
        )}

        {alGelopen && (
          <Stap
            nummer={2}
            titel="Nu bijwerken"
            uitleg="Haalt op wat er de laatste twee dagen in eitje is veranderd. Dit gebeurt ook elke nacht; deze knop is voor als je er niet op wilt wachten."
          >
            <Knop
              soort="rustig"
              bezig={bijwerken.isPending}
              disabled={bezig && !bijwerken.isPending}
              onClick={() => bijwerken.mutate()}
            >
              <RefreshCw className="size-4" aria-hidden />
              Bijwerken
            </Knop>
          </Stap>
        )}

        {bijwerken.data && <OphaalBericht stand={bijwerken.data} bezig={false} />}

        {alGelopen && (
          <Stap
            nummer={3}
            titel="Rondkijken in eitje"
            uitleg="Kijkt eenmalig welke gegevens eitje al heeft die wij hier met de hand bijhouden, en hoe ver terug eitje beschikbaarheid nog geeft. Leest alleen; schrijft en verandert niets."
          >
            <Knop
              soort="rustig"
              bezig={rondkijken.isPending}
              disabled={bezig && !rondkijken.isPending}
              onClick={() => rondkijken.mutate()}
            >
              <Search className="size-4" aria-hidden />
              Rondkijken
            </Knop>
          </Stap>
        )}

        {rondkijken.data && <Rondkijkuitslag uitslag={rondkijken.data} />}
      </div>
    </Kaart>
  )
}

/* Wat eitje al heeft.
 *
 * Alleen aantallen. De serverfunctie stuurt ook een paar voorbeeldrijen mee en
 * daar staan namen van medewerkers in; dit scherm staat in de zaak open, dus
 * die blijven eraf. Voor de vraag die hier beantwoord moet worden — houden we
 * iets dubbel bij, en hoe ver terug reikt eitje — is een aantal genoeg. */
function Rondkijkuitslag({ uitslag }: { uitslag: Rondkijken }) {
  const regels = Object.entries(uitslag.uitkomst)
  return (
    <div className="flex flex-col gap-3 rounded-[4px] bg-surface-2 p-4">
      <p className="text-sm text-muted">Week {uitslag.week}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-1 font-medium">Onderdeel</th>
            <th className="pb-1 text-right font-medium">Gevonden</th>
          </tr>
        </thead>
        <tbody>
          {regels.map(([naam, deel]) => (
            <tr key={naam} className="border-t border-line">
              <td className="py-1">{naam}</td>
              <td className="py-1 text-right tabular-nums">
                {'fout' in deel ? (
                  <span className="text-bad">{deel.fout}</span>
                ) : (
                  deel.aantal
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OphaalBericht({ stand, bezig }: { stand: Ophaalstand; bezig: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-[4px] bg-surface-2 p-4">
      <p className="text-sm">
        {bezig ? 'Bezig: ' : ''}
        {datumKort(stand.periode.van)} tot en met {datumKort(stand.periode.tot)} —{' '}
        <strong>{stand.regels} regels</strong> ({stand.nieuw} nieuw, {stand.bijgewerkt} bijgewerkt)
        {stand.nog_te_gaan > 0 && bezig && `, nog ${stand.nog_te_gaan} weken te gaan`}
      </p>
      {stand.nummers_vastgelegd > 0 && (
        <p className="text-sm text-muted">
          {stand.nummers_vastgelegd === 1
            ? 'Bij één medewerker is het eitje-nummer vastgelegd'
            : `Bij ${stand.nummers_vastgelegd} medewerkers is het eitje-nummer vastgelegd`}
          . Daarmee hoeft er bij hen nooit meer op naam geraden te worden.
        </p>
      )}
      {stand.wiekan && <WieKanBericht wiekan={stand.wiekan} />}
      <Namen namen={stand.niet_gekoppeld} />
    </div>
  )
}

function WieKanBericht({ wiekan }: { wiekan: WieKan }) {
  const stukjes = [
    `${wiekan.niet_beschikbaar} keer "kan niet"`,
    `${wiekan.verlof} verlofaanvragen`,
    `${wiekan.ziek} ziekmeldingen`,
  ]
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-2">
      <p className="text-sm">
        Vooruit tot {datumKort(wiekan.tot)}: {stukjes.join(', ')}. Staat bij Rooster → Dag.
      </p>
      {/* Niets kunnen ophalen en niets te melden hebben zien er hetzelfde uit.
          Daarom staat het erbij als eitje een onderdeel niet vrijgeeft. */}
      {wiekan.niet_opgehaald && wiekan.niet_opgehaald.length > 0 && (
        <p className="text-sm text-warn">
          Niet opgehaald: {wiekan.niet_opgehaald.join(' en ')}. Eitje geeft die niet vrij voor
          onze sleutels. Wat er al stond blijft staan; vraag het na bij Eitje als je het nodig
          hebt.
        </p>
      )}
    </div>
  )
}
