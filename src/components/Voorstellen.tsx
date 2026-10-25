import { useMemo, useState } from 'react'
import { AlertTriangle, FileText, Info, Plus, Send } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil, Veld } from './ui'
import { korteDatum, naamVan, type Persoon } from '../lib/personeel'
import {
  ketenVan,
  useContracten,
  lopendContract,
  type Contract,
  type Duur,
  type Soort,
} from '../lib/contracten'
import { useGemiddeldeUren } from '../lib/gewerkteUren'
import {
  AARDNAAM,
  KEUZENAAM,
  STANDNAAM,
  herinnering,
  openstaand,
  controleer,
  magVerstuurd,
  metVasteUren,
  metVerlenging,
  samenvatting,
  schoonVoorstel,
  vulVoorstelIn,
  standVan,
  useVoorstelIntrekken,
  useVoorstelOpPapier,
  useVoorstelOpslaan,
  useVoorstelVersturen,
  useVoorstellen,
  type Aard,
  type Voorstel,
} from '../lib/contractvoorstellen'

/* Een contractvoorstel opstellen.
 *
 * Wat hier gebeurt is vooral nakijken. De app vult in wat uit het lopende
 * contract en de keten volgt, laat zien hoe het er voor de medewerker uitziet,
 * en houdt tegen wat juridisch niet kan — een vierde tijdelijk contract, of
 * een aanbod vaste uren onder het twaalfmaandsgemiddelde.
 *
 * Versturen gaat met één knop. De medewerker krijgt een mail — en een
 * pushbericht als hij meldingen aan heeft staan — en ziet het voorstel onder
 * Mijn dossier. Daar bevestigt hij de ontvangst en kiest hij. Blijft dat weg,
 * dan zegt deze lijst twee weken en een week vooraf dat het op papier mee
 * moet; te laat aanzeggen kost tot een maandloon. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const STAND_KLEUR = {
  concept: 'neutraal',
  verstuurd: 'letop',
  gezien: 'letop',
  beantwoord: 'goed',
  ingetrokken: 'neutraal',
} as const

function Keuze<T extends string>({
  label,
  waarde,
  opties,
  onKies,
}: {
  label: string
  waarde: T
  opties: { waarde: T; label: string }[]
  onKies: (v: T) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <select className={invoer} value={waarde} onChange={(e) => onKies(e.target.value as T)}>
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Opstellen({
  persoon,
  huidig,
  keten,
  gemiddelde,
  onKlaar,
}: {
  persoon: Persoon
  huidig: Contract | null
  keten: ReturnType<typeof ketenVan>
  gemiddelde: number | null
  onKlaar: () => void
}) {
  /* Elke vorm heeft zijn eigen vooringevulde waarden: verlengen sluit aan op
     het vorige contract, een aanbod begint bij het gemiddelde. Daarom vult de
     app bij het wisselen van vorm opnieuw in, in plaats van de oude waarden te
     laten staan — die horen bij een voorstel dat je niet meer doet. */
  const vul = (a: Aard) => vulVoorstelIn({ aard: a, huidig, keten, gemiddelde })
  const [v, setV] = useState<Partial<Voorstel>>(() => vul('verlengen'))
  const opslaan = useVoorstelOpslaan(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  /* Alles leest hetzelfde voorstel: het voorbeeld, de controle en het
     opslaan. Anders kijk je naar iets anders dan je bewaart. */
  const schoon = useMemo(() => schoonVoorstel(v), [v])
  const bezwaren = useMemo(() => controleer(schoon, keten), [schoon, keten])
  const regels = useMemo(() => samenvatting(schoon), [schoon])
  const aard = (v.aard ?? 'verlengen') as Aard
  const verlengt = metVerlenging(aard)

  return (
    <Kaart className="flex flex-col gap-4 p-4">
      <Keuze<Aard>
        label="Wat stel je voor"
        waarde={aard}
        opties={(Object.keys(AARDNAAM) as Aard[]).map((a) => ({ waarde: a, label: AARDNAAM[a] }))}
        onKies={(nieuw) => setV({ ...vul(nieuw), toelichting: v.toelichting })}
      />

      {aard !== 'stoppen' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Soort, duur en einddatum horen bij een contract. Bied je alleen
              vaste uren aan, dan verandert het contract niet en zouden die
              velden iets suggereren wat er niet staat. */}
          {verlengt && (
            <>
              <Keuze<Soort>
                label="Soort"
                waarde={(v.soort ?? 'nuluren') as Soort}
                opties={[
                  { waarde: 'nuluren' as Soort, label: 'Nuluren (oproep)' },
                  { waarde: 'min_max' as Soort, label: 'Min-max' },
                  { waarde: 'vaste_uren' as Soort, label: 'Vaste uren' },
                  { waarde: 'bandbreedte' as Soort, label: 'Bandbreedte' },
                ]}
                onKies={(s) => setV({ ...v, soort: s })}
              />
              <Keuze<Duur>
                label="Duur"
                waarde={(v.duur ?? 'bepaalde') as Duur}
                opties={[
                  { waarde: 'bepaalde' as Duur, label: 'Bepaalde tijd' },
                  { waarde: 'onbepaalde' as Duur, label: 'Onbepaalde tijd' },
                ]}
                onKies={(d) =>
                  setV({ ...v, duur: d, eindigt: d === 'onbepaalde' ? null : v.eindigt })
                }
              />
            </>
          )}
          <Veld
            label={verlengt ? 'Begint' : 'Gaat in op'}
            type="date"
            value={v.begint ?? ''}
            onChange={(e) => setV({ ...v, begint: e.target.value || null })}
          />
          {verlengt && v.duur === 'bepaalde' && (
            <Veld
              label="Eindigt"
              type="date"
              value={v.eindigt ?? ''}
              onChange={(e) => setV({ ...v, eindigt: e.target.value || null })}
            />
          )}
          {(v.soort === 'vaste_uren' || metVasteUren(aard)) && (
            <Veld
              label="Uren per week"
              type="number"
              step="0.5"
              value={String(v.uren_vast ?? '')}
              onChange={(e) =>
                setV({ ...v, uren_vast: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          )}
          {verlengt && (v.soort === 'min_max' || v.soort === 'bandbreedte') && (
            <>
              <Veld
                label="Minimaal uren"
                type="number"
                step="0.5"
                value={String(v.uren_min ?? '')}
                onChange={(e) =>
                  setV({ ...v, uren_min: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
              <Veld
                label="Maximaal uren"
                type="number"
                step="0.5"
                value={String(v.uren_max ?? '')}
                onChange={(e) =>
                  setV({ ...v, uren_max: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </>
          )}
          <Veld
            label="Uurloon bruto"
            type="number"
            step="0.01"
            value={String(v.uurloon ?? '')}
            onChange={(e) =>
              setV({ ...v, uurloon: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
          <Veld
            label="Functie"
            value={v.functie ?? ''}
            onChange={(e) => setV({ ...v, functie: e.target.value || null })}
          />
        </div>
      )}

      <Veld
        label="Antwoord uiterlijk"
        type="date"
        value={v.uiterlijk ?? ''}
        onChange={(e) => setV({ ...v, uiterlijk: e.target.value || null })}
      />
      <Veld
        label="Toelichting voor de medewerker"
        value={v.toelichting ?? ''}
        onChange={(e) => setV({ ...v, toelichting: e.target.value || null })}
      />

      {metVasteUren(aard) && gemiddelde === null && (
        <p className="text-sm text-muted">
          Het gemiddelde over twaalf maanden is niet bekend, dus de app kan niet nakijken of dit
          aanbod hoog genoeg is.
        </p>
      )}

      {/* Wat de medewerker straks leest. */}
      <div className="flex flex-col gap-2">
        <Kopje>Zo ziet het eruit</Kopje>
        <Kaart className="flex flex-col gap-1 p-4">
          {regels.length === 0 ? (
            <p className="text-sm text-muted">Vul hierboven in wat je voorstelt.</p>
          ) : (
            regels.map((r) => <p key={r}>{r}</p>)
          )}
          {v.toelichting && <p className="mt-1 whitespace-pre-wrap text-muted">{v.toelichting}</p>}
        </Kaart>
      </div>

      {bezwaren.length > 0 && (
        <Kaart className={`flex flex-col gap-2 p-4 ${magVerstuurd(bezwaren) ? 'border-warn' : 'border-bad'}`}>
          {bezwaren.map((b) => (
            <p key={b.wat} className="flex items-start gap-2 text-sm">
              {b.ernst === 'fout' ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              )}
              <span>{b.wat}</span>
            </p>
          ))}
        </Kaart>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Knop
          bezig={opslaan.isPending}
          disabled={!magVerstuurd(bezwaren)}
          onClick={() =>
            opslaan.mutate(schoon, {
              onSuccess: onKlaar,
              onError: (e) => setFout(e instanceof Error ? e.message : 'Opslaan lukte niet.'),
            })
          }
        >
          Opslaan als concept
        </Knop>
        <Knop soort="rustig" onClick={onKlaar}>
          Annuleren
        </Knop>
        {!magVerstuurd(bezwaren) && (
          <span className="text-sm text-muted">Los eerst op wat hierboven rood staat.</span>
        )}
      </div>
    </Kaart>
  )
}


/* Eén voorstel in de lijst bij Sander.
 *
 * Een concept gaat met één knop de deur uit. Daarna is de rij vooral een
 * tijdlijn: verstuurd, gezien, bevestigd, geantwoord. Die tijdstippen zijn
 * geen opsmuk — bij een geschil over aanzeggen is dit wat je laat zien.
 *
 * En er is altijd de papieren weg. Wie het niet opent krijgt het op papier
 * mee, en dan legt Sander het antwoord hier vast. Dat staat erbij vermeld,
 * want dan komen de tijdstippen niet van de medewerker zelf. */
function Regel({
  v,
  persoon,
  intrekken,
}: {
  v: Voorstel
  persoon: Persoon
  intrekken: ReturnType<typeof useVoorstelIntrekken>
}) {
  const versturen = useVoorstelVersturen(persoon.id)
  const opPapier = useVoorstelOpPapier(persoon.id)
  const [fout, setFout] = useState<string | null>(null)
  const [papier, setPapier] = useState(false)
  const stand = standVan(v)
  const open = openstaand(v)
  const seintje = herinnering(v)

  return (
    <div className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{AARDNAAM[v.aard]}</span>
          <Pil soort={STAND_KLEUR[stand]}>{STANDNAAM[stand]}</Pil>
          {v.op_papier && <Pil soort="neutraal">Op papier</Pil>}
        </span>
        <span className="text-sm text-muted">{korteDatum(v.opgesteld_op)}</span>
      </div>

      {(v.brief ? v.brief.split('\n') : samenvatting(v)).map((r) => (
        <p key={r} className="mt-0.5 text-sm text-muted">
          {r}
        </p>
      ))}

      {/* De tijdlijn. Alleen wat er is; een lege regel zegt niets. */}
      {v.verstuurd_op && (
        <p className="mt-1 text-sm text-muted">
          Verstuurd {korteDatum(v.verstuurd_op)}
          {v.verstuurd_naar ? ` naar ${v.verstuurd_naar}` : ''}
          {v.geopend_op ? ` · gezien ${korteDatum(v.geopend_op)}` : ' · nog niet gezien'}
          {v.ontvangst_bevestigd_op ? ` · gelezen ${korteDatum(v.ontvangst_bevestigd_op)}` : ''}
        </p>
      )}
      {v.keuze_verlenging && (
        <p className="mt-0.5 text-sm">
          {KEUZENAAM[v.keuze_verlenging]} op {korteDatum(v.keuze_verlenging_op)}
        </p>
      )}
      {v.keuze_vaste_uren && (
        <p className="mt-0.5 text-sm">
          {KEUZENAAM[v.keuze_vaste_uren]} op {korteDatum(v.keuze_vaste_uren_op)}
        </p>
      )}
      {v.reactie && (
        <p className="mt-1 whitespace-pre-wrap rounded-[4px] bg-surface-2 p-3 text-sm">{v.reactie}</p>
      )}

      {seintje && (
        <p
          className={`mt-2 flex items-start gap-2 text-sm ${seintje.dringend ? 'text-bad' : 'text-warn'}`}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {seintje.dagen < 0
              ? `Nog niet gelezen en de datum is ${-seintje.dagen} ${-seintje.dagen === 1 ? 'dag' : 'dagen'} voorbij — geef het alsnog op papier mee`
              : `Nog niet gelezen, nog ${seintje.dagen} ${seintje.dagen === 1 ? 'dag' : 'dagen'} — ${seintje.dringend ? 'geef het op papier mee' : 'spreek hem erop aan'}`}
          </span>
        </p>
      )}

      {v.ingetrokken_op && (
        <p className="mt-0.5 text-sm text-muted">
          Ingetrokken op {korteDatum(v.ingetrokken_op)}
          {v.ingetrokken_reden ? ` — ${v.ingetrokken_reden}` : ''}
        </p>
      )}

      {fout && <p className="mt-2 text-sm text-bad">{fout}</p>}

      {!v.ingetrokken_op && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!v.verstuurd_op && (
            <Knop
              bezig={versturen.isPending}
              onClick={() =>
                versturen.mutate(v, {
                  onSuccess: (uitkomst) =>
                    setFout(
                      uitkomst.testmodus
                        ? `Testmodus staat aan: de mail ging naar ${uitkomst.verstuurd_naar}, niet naar ${naamVan(persoon)}.`
                        : null,
                    ),
                  onError: (e) => setFout(e.message),
                })
              }
            >
              <Send className="size-4" aria-hidden />
              Versturen
            </Knop>
          )}
          {v.verstuurd_op && (open.verlenging || open.vasteUren) && !papier && (
            <button
              type="button"
              className="text-sm text-muted underline hover:text-text"
              onClick={() => setPapier(true)}
            >
              antwoord op papier vastleggen
            </button>
          )}
          {/* Een beantwoord voorstel is een vastgelegde afspraak. Dat
              intrekken zou hem uit beeld halen terwijl hij is gedaan; wil je
              iets anders, dan stuur je een nieuw voorstel. */}
          {!v.keuze_verlenging && !v.keuze_vaste_uren && (
            <button
              type="button"
              className="text-sm text-muted underline hover:text-text"
              onClick={() => intrekken.mutate({ id: v.id })}
            >
              intrekken
            </button>
          )}
        </div>
      )}

      {papier && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-sm text-muted">
            Wat heeft {naamVan(persoon)} geantwoord? Dit wordt vastgelegd als op papier gegeven.
          </p>
          {open.verlenging && (
            <div className="flex flex-wrap gap-2">
              <Knop
                soort="rustig"
                bezig={opPapier.isPending}
                onClick={() =>
                  opPapier.mutate(
                    { id: v.id, verlenging: 'akkoord' },
                    { onSuccess: () => setPapier(false), onError: (e) => setFout(e.message) },
                  )
                }
              >
                Akkoord met verlenging
              </Knop>
              <Knop
                soort="rustig"
                bezig={opPapier.isPending}
                onClick={() =>
                  opPapier.mutate(
                    { id: v.id, verlenging: 'niet_akkoord' },
                    { onSuccess: () => setPapier(false), onError: (e) => setFout(e.message) },
                  )
                }
              >
                Niet akkoord
              </Knop>
            </div>
          )}
          {open.vasteUren && (
            <div className="flex flex-wrap gap-2">
              <Knop
                soort="rustig"
                bezig={opPapier.isPending}
                onClick={() =>
                  opPapier.mutate(
                    { id: v.id, vasteUren: 'aangenomen' },
                    { onSuccess: () => setPapier(false), onError: (e) => setFout(e.message) },
                  )
                }
              >
                Vaste uren aangenomen
              </Knop>
              <Knop
                soort="rustig"
                bezig={opPapier.isPending}
                onClick={() =>
                  opPapier.mutate(
                    { id: v.id, vasteUren: 'geweigerd' },
                    { onSuccess: () => setPapier(false), onError: (e) => setFout(e.message) },
                  )
                }
              >
                Vaste uren geweigerd
              </Knop>
            </div>
          )}
          <button
            type="button"
            className="w-fit text-sm text-muted underline hover:text-text"
            onClick={() => setPapier(false)}
          >
            laat maar
          </button>
        </div>
      )}
    </div>
  )
}

export function Voorstellen({ persoon }: { persoon: Persoon }) {
  const { data: contracten } = useContracten(persoon.id)
  const { data: voorstellen } = useVoorstellen(persoon.id)
  const { data: uren } = useGemiddeldeUren(persoon.id)
  const intrekken = useVoorstelIntrekken(persoon.id)
  const [opstellen, setOpstellen] = useState(false)

  if (!contracten || !voorstellen) return null

  const keten = ketenVan(contracten)
  const huidig = lopendContract(contracten)
  const gemiddelde = uren?.urenPerWeek ?? null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Voorstellen</Kopje>

      {voorstellen.length > 0 && (
        <Kaart className="flex flex-col py-2">
          {voorstellen.map((v) => (
            <Regel key={v.id} v={v} persoon={persoon} intrekken={intrekken} />
          ))}
        </Kaart>
      )}

      {opstellen ? (
        <Opstellen
          persoon={persoon}
          huidig={huidig}
          keten={keten}
          gemiddelde={gemiddelde}
          onKlaar={() => setOpstellen(false)}
        />
      ) : (
        <Knop
          soort="rustig"
          className="w-fit"
          onClick={() => setOpstellen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Voorstel opstellen
        </Knop>
      )}

      <p className="flex items-start gap-2 text-sm text-muted">
        <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
        Het loonbureau maakt het contract. Dit is wat je aanbiedt, niet wat er getekend is.
      </p>
    </section>
  )
}
