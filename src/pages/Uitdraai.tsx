import { useState } from 'react'
import { AlertTriangle, Printer } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden } from '../components/ui'
import { LIJSTEN } from '../lib/taken'
import { toonNaam } from '../lib/personeel'
import { dagenTerug, useUitdraai, vandaagStr, type Onderdeel } from '../lib/uitdraai'

/* De uitdraai voor een controle. Zie docs/Modules/haccp/haccpmodule.md. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

const PERIODES = [
  { label: 'Afgelopen maand', dagen: 30 },
  { label: 'Drie maanden', dagen: 90 },
  { label: 'Een jaar', dagen: 365 },
]

function lang(datum: string) {
  return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function kort(datum: string) {
  return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Een deel dat niet geladen kon worden zegt dat, ook op papier. */
function Mist({ wat, fout }: { wat: string; fout: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[4px] border-2 border-bad bg-bad-soft p-3">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
      <p className="text-sm">
        <span className="font-bold text-bad">{wat} ontbreekt in deze uitdraai.</span>{' '}
        Dit deel kon niet opgehaald worden ({fout}). Probeer het opnieuw voordat je
        dit document gebruikt.
      </p>
    </div>
  )
}

function Deel<T>({
  titel,
  onderdeel,
  leeg,
  toon,
}: {
  titel: string
  onderdeel: Onderdeel<T[]>
  leeg: string
  toon: (waarde: T[]) => React.ReactNode
}) {
  return (
    <section className="flex break-inside-avoid flex-col gap-2">
      <h3 className="font-display text-lg">{titel}</h3>
      {!onderdeel.gelukt ? (
        <Mist wat={titel} fout={onderdeel.fout} />
      ) : onderdeel.waarde.length === 0 ? (
        <p className="text-sm text-muted">{leeg}</p>
      ) : (
        toon(onderdeel.waarde)
      )}
    </section>
  )
}

const tabel = 'w-full border-collapse text-sm'
const kop = 'border-b border-line-strong px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider'
const cel = 'border-b border-line px-2 py-1.5 align-top'

export function Uitdraai() {
  const [van, setVan] = useState(dagenTerug(90))
  const [tot, setTot] = useState(vandaagStr())
  const [opgevraagd, setOpgevraagd] = useState(false)
  const { data, isFetching } = useUitdraai(van, tot, opgevraagd)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 print:hidden">
        <Kopje>Uitdraai voor een controle</Kopje>
        <Kaart className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            {PERIODES.map((p) => (
              <Knop
                key={p.dagen}
                soort="rustig"
                onClick={() => {
                  setVan(dagenTerug(p.dagen))
                  setTot(vandaagStr())
                  setOpgevraagd(true)
                }}
              >
                {p.label}
              </Knop>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="van" className="text-sm font-semibold text-muted">Van</label>
              <input id="van" type="date" className={invoer} value={van} onChange={(e) => setVan(e.target.value)} />
            </div>
            <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <label htmlFor="tot" className="text-sm font-semibold text-muted">Tot en met</label>
              <input id="tot" type="date" className={invoer} value={tot} onChange={(e) => setTot(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Knop soort="primair" bezig={isFetching} onClick={() => setOpgevraagd(true)}>
              Overzicht maken
            </Knop>
            {data && !isFetching && (
              <Knop soort="rustig" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                Afdrukken of opslaan als PDF
              </Knop>
            )}
          </div>

          <p className="text-sm text-muted">
            Dit wordt een afdrukbare pagina, geen bestand van de server. Kies bij het
            afdrukken "Bewaar als PDF" als je hem wilt mailen. Werkt ook als de
            server er even uit ligt, zolang dit scherm openstaat.
          </p>
        </Kaart>
      </section>

      {isFetching && <Laden tekst="Alles ophalen…" />}

      {data && !isFetching && (
        <article className="flex flex-col gap-6">
          <header className="flex flex-col gap-1 border-b-2 border-line-strong pb-3">
            <p className="font-display text-2xl">Snackerie 't Zonnetje</p>
            <p className="text-sm text-muted">Boskma Foodservice — HACCP-registratie</p>
            <p className="mt-1 font-semibold">
              {lang(data.van)} tot en met {lang(data.tot)}
            </p>
            <p className="text-sm text-muted">
              Uitgedraaid op{' '}
              {new Date(data.gemaaktOp).toLocaleString('nl-NL', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </header>

          <Deel
            titel="Temperaturen"
            onderdeel={data.metingen}
            leeg="Geen metingen in deze periode."
            toon={(m) => (
              <table className={tabel}>
                <thead>
                  <tr>
                    <th className={kop}>Datum</th>
                    <th className={kop}>Tijd</th>
                    <th className={kop}>Apparaat</th>
                    <th className={kop}>Ronde</th>
                    <th className={`${kop} text-right`}>Temp.</th>
                    <th className={kop}>Door</th>
                    <th className={kop}>Afwijking en actie</th>
                  </tr>
                </thead>
                <tbody>
                  {m.map((r) => (
                    <tr key={r.id} className={r.afwijking ? 'bg-bad-soft' : ''}>
                      <td className={cel}>{kort(r.datum)}</td>
                      <td className={`${cel} tabular-nums`}>{(r.tijd ?? '').slice(0, 5)}</td>
                      <td className={cel}>{r.apparaat_naam}</td>
                      <td className={cel}>{r.meetmoment === 'sluiting' ? 'Sluiting' : 'Opening'}</td>
                      <td className={`${cel} text-right font-bold tabular-nums`}>{r.temperatuur} °C</td>
                      <td className={cel}>{toonNaam(r.door_naam)}</td>
                      <td className={cel}>
                        {r.afwijking
                          ? [r.actie ?? 'geen actie vastgelegd', r.opmerking].filter(Boolean).join(' — ')
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          <Deel
            titel="Werklijsten"
            onderdeel={data.taken}
            leeg="Geen afgevinkte taken in deze periode."
            toon={(dagen) => (
              <>
                <table className={tabel}>
                  <thead>
                    <tr>
                      <th className={kop}>Datum</th>
                      {LIJSTEN.map((l) => (
                        <th key={l.waarde} className={`${kop} text-right`}>{l.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dagen.map((d) => (
                      <tr key={d.datum}>
                        <td className={cel}>{kort(d.datum)}</td>
                        {LIJSTEN.map((l) => (
                          <td key={l.waarde} className={`${cel} text-right tabular-nums`}>
                            {d.perLijst[l.waarde] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm text-muted">
                  Per dag hoeveel taken er per lijst zijn afgevinkt. Elke losse taak
                  apart zou over een periode van maanden tienduizenden regels worden;
                  wie één dag wil natrekken, vindt die in het logboek in de app.
                </p>
              </>
            )}
          />

          <Deel
            titel="Leveringen"
            onderdeel={data.leveringen}
            leeg="Geen leveringen vastgelegd in deze periode."
            toon={(l) => (
              <table className={tabel}>
                <thead>
                  <tr>
                    <th className={kop}>Datum</th>
                    <th className={kop}>Leverancier</th>
                    <th className={`${kop} text-right`}>Temp.</th>
                    <th className={kop}>Aangenomen</th>
                    <th className={kop}>Door</th>
                    <th className={kop}>Opmerking</th>
                  </tr>
                </thead>
                <tbody>
                  {l.map((r) => (
                    <tr key={r.id} className={r.ok ? '' : 'bg-bad-soft'}>
                      <td className={cel}>{kort(r.datum)}</td>
                      <td className={cel}>{r.leverancier}</td>
                      <td className={`${cel} text-right font-bold tabular-nums`}>{r.temperatuur} °C</td>
                      <td className={cel}>{r.ok ? 'Ja' : 'Geweigerd'}</td>
                      <td className={cel}>{toonNaam(r.door_naam ?? r.employee_naam)}</td>
                      <td className={cel}>{r.opmerking ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          <Deel
            titel="Frituurvet"
            onderdeel={data.doorschuiven}
            leeg="Geen doorschuiven vastgelegd in deze periode."
            toon={(d) => (
              <>
                <table className={tabel}>
                  <thead>
                    <tr>
                      <th className={kop}>Datum</th>
                      <th className={kop}>Door</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.map((r) => (
                      <tr key={r.id}>
                        <td className={cel}>{kort(r.datum)}</td>
                        <td className={cel}>{toonNaam(r.door_naam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm text-muted">
                  Het vet loopt in een doorschuifsysteem: verse olie gaat in de
                  laatste pan, bij elke handeling schuift alles een plek op en de
                  eerste pan gaat naar de afgewerktvetbak.
                </p>
              </>
            )}
          />

          <Deel
            titel="Weekafsluitingen"
            onderdeel={data.weken}
            leeg="Geen afgetekende weken in deze periode."
            toon={(w) => (
              <table className={tabel}>
                <thead>
                  <tr>
                    <th className={kop}>Week</th>
                    <th className={kop}>Nagekeken op</th>
                    <th className={kop}>Door</th>
                    <th className={kop}>Opmerking</th>
                  </tr>
                </thead>
                <tbody>
                  {w.map((r) => (
                    <tr key={r.id}>
                      <td className={cel}>{r.iso_week} — {r.jaar}</td>
                      <td className={cel}>
                        {new Date(r.akkoord_op).toLocaleDateString('nl-NL', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className={cel}>{toonNaam(r.door)}</td>
                      <td className={cel}>{r.opmerking ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          <footer className="border-t border-line pt-3 text-sm text-muted">
            Registraties kunnen in de app niet worden gewijzigd of verwijderd. Een
            correctie wordt als nieuwe regel vastgelegd, met de oorspronkelijke
            meting erbij.
          </footer>
        </article>
      )}
    </div>
  )
}
