import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt, Pil } from '../components/ui'
import { naarKlok } from '../lib/eitje'
import {
  dagnaam,
  dagoverzicht,
  datumKort,
  useRooster,
  verschuif,
  type Dagregel,
} from '../lib/rooster'
import { standVanDeDag, useRooster as useOpeningstijden, vandaagStr } from '../lib/openingstijden'
import { balk, dagtijdlijn, naarTijd, uurstreepjes, type Dagtijdlijn } from '../lib/tijdlijn'

/* Het rooster van één dag als tijdlijn, met een lijn door de openingstijd.
   De vraag die dit beantwoordt: wie staat er als we opengaan.

   De openingstijd komt uit de openingstijden-module en staat hier niet vast op
   12:00. Zo schuift de lijn mee met een afwijkende dag, en laat een gesloten
   maandag zich vanzelf als gesloten zien. */

/** Hoe ver het gewerkt afwijkt van wat er stond. Een kwartier is ruis; daarom
 *  pas een pil zodra het een half uur scheelt. */
function Verschil({ regel }: { regel: Dagregel }) {
  if (regel.gewerkt === 0) return null
  const verschil = regel.gewerkt - regel.gepland
  if (regel.onverwacht) return <Pil soort="letop">Niet ingepland</Pil>
  if (Math.abs(verschil) < 30) return <Pil soort="goed">Zoals gepland</Pil>
  return (
    <Pil soort={verschil > 0 ? 'letop' : 'fout'}>
      {verschil > 0 ? '+' : ''}
      {naarKlok(verschil)}
    </Pil>
  )
}

/* Op een telefoon staan naam en tijd bóven de balk, zodat de balk de hele
   breedte heeft. Vanaf een tablet staat de naam ernaast in een eigen kolom.
   De lijnen lopen over het balkenvlak, dus die begint waar die kolom eindigt:
   7rem plus de tussenruimte. Verander je het een, verander dan ook het ander. */
const KOLOMMEN = 'sm:grid sm:grid-cols-[7rem_1fr] sm:gap-2'
const LIJNVLAK = 'absolute inset-y-0 left-0 right-0 sm:left-[7.5rem]'

function Tijdlijn({ t }: { t: Dagtijdlijn }) {
  const v = t.venster
  const plek = (minuten: number) => ((minuten - v.van) / Math.max(1, v.tot - v.van)) * 100

  return (
    <div className="relative">
      {/* De uren bovenaan */}
      <div className={`${KOLOMMEN} sm:items-end`}>
        <span className="hidden sm:block" />
        <div className="relative h-5">
          {uurstreepjes(v).map((u) => (
            <span
              key={u}
              className="absolute -translate-x-1/2 text-xs tabular-nums text-muted"
              style={{ left: `${plek(u)}%` }}
            >
              {u / 60}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* De lijnen lopen door alle rijen heen, daarom liggen ze erover. */}
        <div className={`${LIJNVLAK} pointer-events-none`} aria-hidden>
          {uurstreepjes(v).map((u) => (
            <span
              key={u}
              className="absolute inset-y-0 w-px bg-line"
              style={{ left: `${plek(u)}%` }}
            />
          ))}
          {t.sluiting !== null && (
            <span
              className="absolute inset-y-0 w-px bg-line-strong"
              style={{ left: `${plek(t.sluiting)}%` }}
            />
          )}
          {t.opening !== null && (
            <span
              className="absolute inset-y-0 w-0.5 bg-accent"
              style={{ left: `${plek(t.opening)}%` }}
            />
          )}
        </div>

        <ul className="relative flex flex-col py-1">
          {t.diensten.map((d) => {
            const b = balk(d.begint, d.eindigt, v)
            return (
              <li key={d.sleutel} className={`${KOLOMMEN} py-1.5 sm:items-center sm:py-1`}>
                <span
                  className={`flex gap-2 truncate text-sm font-semibold ${d.open ? 'text-bad' : ''}`}
                  title={d.naam}
                >
                  <span className="truncate">{d.open ? 'Nog niemand' : d.naam}</span>
                  {/* Naast de naam op een telefoon, want in de balk past hij daar niet. */}
                  <span className="shrink-0 font-normal tabular-nums text-muted sm:hidden">
                    {naarTijd(d.begint)} – {naarTijd(d.eindigt)}
                  </span>
                </span>
                <span className="relative block h-7">
                  <span
                    className={`absolute inset-y-0 flex items-center overflow-hidden whitespace-nowrap rounded-[3px] text-xs tabular-nums sm:px-2 ${
                      d.open
                        ? 'border border-dashed border-bad bg-bad-soft text-bad'
                        : 'bg-brand text-on-brand'
                    }`}
                    style={{ left: `${b.links}%`, width: `${b.breedte}%` }}
                  >
                    <span className="hidden sm:inline">
                      {naarTijd(d.begint)} – {naarTijd(d.eindigt)}
                    </span>
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function RoosterDag() {
  const [datum, setDatum] = useState(() => vandaagStr())
  const { data, isPending, error, refetch } = useRooster(datum, datum)
  const { data: openingstijden } = useOpeningstijden()

  const stand = standVanDeDag(openingstijden, datum)
  const t = dagtijdlijn(data?.gepland ?? [], stand.van, stand.tot)
  const openers = t.diensten.filter((d) => d.opent && !d.open)
  const regels = data ? (dagoverzicht(data.gepland, data.gewerkt).get(datum) ?? []) : []
  const isVandaag = datum === vandaagStr()

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ bladeren --- */}
      <div className="flex flex-wrap items-center gap-2">
        <Knop soort="rustig" onClick={() => setDatum(verschuif(datum, -1))} aria-label="Vorige dag">
          <ChevronLeft className="size-4" aria-hidden />
        </Knop>
        <div className="min-w-44 text-center">
          <p className="font-display text-lg">{dagnaam(datum, true)}</p>
          <p className="text-sm text-muted">{datumKort(datum)}</p>
        </div>
        <Knop soort="rustig" onClick={() => setDatum(verschuif(datum, 1))} aria-label="Volgende dag">
          <ChevronRight className="size-4" aria-hidden />
        </Knop>
        {!isVandaag && (
          <Knop soort="rustig" onClick={() => setDatum(vandaagStr())}>
            Vandaag
          </Knop>
        )}
      </div>

      {isPending && <Laden tekst="Rooster ophalen…" />}
      {error && <Mislukt tekst={error.message} opnieuw={() => refetch()} />}

      {data && (
        <>
          {/* --------------------------------------------- wie er opent --- */}
          <Kaart className="flex flex-col gap-1 p-4">
            {!stand.open ? (
              <p className="text-sm text-muted">
                Gesloten{stand.reden ? ` — ${stand.reden}` : ''}.
              </p>
            ) : openers.length > 0 ? (
              <p className="text-sm">
                Om <span className="font-semibold tabular-nums">{stand.van ?? '?'}</span> open je met{' '}
                <span className="font-semibold">
                  {openers.map((d) => d.naam).join(', ')}
                </span>
                .
              </p>
            ) : (
              <p className="text-sm text-bad">
                Om {stand.van ?? 'openingstijd'} staat er niemand ingeroosterd.
              </p>
            )}
            {stand.open && stand.van && stand.tot && (
              <p className="text-xs text-muted">
                Open van {stand.van} tot {stand.tot}. De dikke lijn is de openingstijd.
              </p>
            )}
          </Kaart>

          {/* ------------------------------------------------- tijdlijn --- */}
          {t.diensten.length > 0 ? (
            <Kaart className="p-4">
              <Tijdlijn t={t} />
            </Kaart>
          ) : (
            <Kaart className="p-6 text-sm text-muted">
              Voor deze dag staat er niemand op het rooster.
            </Kaart>
          )}

          {t.zonderTijd.length > 0 && (
            <Kaart className="flex flex-col gap-1 p-4 text-sm">
              <p className="text-muted">Zonder tijden in de export, dus niet te tekenen:</p>
              {t.zonderTijd.map((d) => (
                <p key={d.sleutel} className={d.open ? 'text-bad' : ''}>
                  {d.open ? 'Nog niemand' : d.naam}
                </p>
              ))}
            </Kaart>
          )}

          {/* ------------------------------------------ gepland tegen gewerkt --- */}
          {regels.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted">Gepland en gewerkt</p>
              <Kaart>
                <ul className="flex flex-col divide-y divide-line">
                  {regels.map((regel) => (
                    <li key={regel.sleutel} className="flex flex-col gap-1 px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-semibold ${regel.open ? 'text-bad' : ''}`}>
                          {regel.open ? 'Nog niemand' : regel.naam}
                        </span>
                        <Verschil regel={regel} />
                      </div>
                      <span className="text-xs tabular-nums text-muted">
                        {regel.geplandTijd ?? regel.gewerktTijd}
                        {regel.gewerktTijd &&
                          regel.geplandTijd &&
                          regel.gewerktTijd !== regel.geplandTijd && <> → {regel.gewerktTijd}</>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Kaart>
            </section>
          )}
        </>
      )}
    </div>
  )
}
