import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { Kaart, Knop, Kopje, Leeg, Mislukt, Pil } from '../components/ui'
import { leesWerkboek } from '../lib/xlsx-lezen'
import { leesEitje, naarKlok, type Eitjebestand } from '../lib/eitje'
import {
  beoordeel,
  datumKort,
  haalBestaand,
  useAfspraken,
  useImporteren,
  useImports,
  useKandidaten,
  useNaamVastleggen,
  type Shift,
} from '../lib/rooster'

const SOORTNAAM = { planning: 'Geplande shifts', gewerkt: 'Gewerkte uren' } as const

function Telling({ getal, label, soort }: { getal: number; label: string; soort?: 'goed' | 'letop' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`font-display text-2xl tabular-nums ${
          getal === 0 ? 'text-muted' : soort === 'goed' ? 'text-good' : soort === 'letop' ? 'text-warn' : ''
        }`}
      >
        {getal}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

export function RoosterImporteren() {
  const kiezer = useRef<HTMLInputElement>(null)
  const [bestand, setBestand] = useState<Eitjebestand | null>(null)
  const [bestandsnaam, setBestandsnaam] = useState('')
  const [bestaand, setBestaand] = useState<Map<string, Shift>>(new Map())
  const [fout, setFout] = useState<string | null>(null)
  const [bezigMetLezen, setBezigMetLezen] = useState(false)
  const [sleept, setSleept] = useState(false)
  const [klaar, setKlaar] = useState<{ aantal: number } | null>(null)

  const kandidaten = useKandidaten()
  const afspraken = useAfspraken()
  const vastleggen = useNaamVastleggen()
  const importeren = useImporteren()
  const imports = useImports()

  /* Het voorstel wordt telkens opnieuw berekend, ook als je onderweg een naam
     koppelt. Zo zie je het effect van die keuze meteen in de tellingen. */
  const voorstel = useMemo(() => {
    if (!bestand) return null
    return beoordeel(bestand, bestaand, kandidaten.data ?? [], afspraken.data ?? new Map())
  }, [bestand, bestaand, kandidaten.data, afspraken.data])

  async function neemAan(gekozen: File | undefined) {
    if (!gekozen) return
    setFout(null)
    setKlaar(null)
    setBestand(null)
    setBezigMetLezen(true)
    try {
      const gelezen = leesEitje(await leesWerkboek(await gekozen.arrayBuffer()))
      if (gelezen.regels.length === 0) {
        throw new Error('In dit bestand staan geen shifts. Klopt de geëxporteerde periode?')
      }
      setBestaand(await haalBestaand(gelezen.soort, gelezen.regels.map((r) => r.bron_id)))
      setBestand(gelezen)
      setBestandsnaam(gekozen.name)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Dit bestand kon ik niet lezen.')
    } finally {
      setBezigMetLezen(false)
    }
  }

  async function voerUit() {
    if (!bestand || !voorstel) return
    setFout(null)
    try {
      const uit = await importeren.mutateAsync({ bestand, bestandsnaam, voorstel })
      setKlaar(uit)
      setBestand(null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Importeren lukte niet.')
    }
  }

  const uren = voorstel?.regels.reduce((som, r) => som + r.regel.minuten, 0) ?? 0

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ kiezen --- */}
      <Kaart
        onDragOver={(e) => {
          e.preventDefault()
          setSleept(true)
        }}
        onDragLeave={() => setSleept(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSleept(false)
          void neemAan(e.dataTransfer.files[0])
        }}
        className={`flex flex-col items-center gap-3 border-dashed p-8 text-center transition-colors ${
          sleept ? 'border-accent bg-surface-2' : ''
        }`}
      >
        <FileSpreadsheet className="size-8 text-muted" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg">Sleep hier een export uit eitje</p>
          <p className="max-w-md text-sm text-muted">
            Zowel <strong>Geplande shifts</strong> als <strong>Gewerkte uren</strong>; welk van de twee
            het is, leest de app zelf uit het bestand. Een week die er al in staat wordt bijgewerkt,
            niet nog een keer toegevoegd.
          </p>
        </div>
        <input
          ref={kiezer}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => void neemAan(e.target.files?.[0] ?? undefined)}
        />
        <Knop soort="rustig" bezig={bezigMetLezen} onClick={() => kiezer.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Bestand kiezen
        </Knop>
      </Kaart>

      {fout && <Mislukt tekst={fout} />}

      {klaar && (
        <Kaart className="flex items-center gap-3 border-good p-5">
          <CheckCircle2 className="size-5 shrink-0 text-good" aria-hidden />
          <p className="text-sm">
            <strong>{klaar.aantal} regels</strong> ingelezen. Ze staan nu onder Week en Per
            medewerker.
          </p>
        </Kaart>
      )}

      {/* ---------------------------------------------------- voorstel --- */}
      {bestand && voorstel && (
        <div className="flex flex-col gap-4">
          <Kaart className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Kopje>Klaar om in te lezen</Kopje>
                <p className="font-display text-lg">{SOORTNAAM[bestand.soort]}</p>
                <p className="text-sm text-muted">
                  {bestand.periode
                    ? `${datumKort(bestand.periode.van)} tot en met ${datumKort(bestand.periode.tot)}`
                    : 'Periode onbekend'}
                  {' · '}
                  {naarKlok(uren)} uur over {voorstel.regels.length} regels
                </p>
              </div>
              <Pil soort={bestand.soort === 'planning' ? 'neutraal' : 'goed'}>
                {bestand.soort === 'planning' ? 'Rooster' : 'Urenregistratie'}
              </Pil>
            </div>

            <div className="flex flex-wrap gap-8">
              <Telling getal={voorstel.nieuw} label="nieuw" soort="goed" />
              <Telling getal={voorstel.gewijzigd} label="gewijzigd" soort="letop" />
              <Telling getal={voorstel.ongewijzigd} label="stond er al zo" />
              <Telling getal={voorstel.onbekend.length} label="namen onbekend" soort="letop" />
            </div>

            {bestand.waarschuwingen.map((tekst) => (
              <p key={tekst} className="flex items-start gap-2 text-sm text-muted">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                {tekst}
              </p>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <Knop onClick={() => void voerUit()} bezig={importeren.isPending}>
                {voorstel.nieuw + voorstel.gewijzigd === 0
                  ? 'Toch inlezen'
                  : `${voorstel.nieuw + voorstel.gewijzigd} regels inlezen`}
              </Knop>
              <Knop soort="rustig" onClick={() => setBestand(null)}>
                Annuleren
              </Knop>
              {voorstel.onbekend.length > 0 && (
                <span className="text-sm text-muted">
                  Onbekende namen worden bewaard, maar tellen pas mee bij een medewerker zodra je ze
                  hieronder koppelt.
                </span>
              )}
            </div>
          </Kaart>

          {/* ------------------------------------------------ koppelen --- */}
          {voorstel.onbekend.length > 0 && (
            <Kaart className="flex flex-col gap-3 p-5">
              <Kopje>Wie zijn dit?</Kopje>
              <p className="max-w-2xl text-sm text-muted">
                Deze namen staan niet in het personeelsbestand, of er zijn er meer die zo heten. Eén
                keer aanwijzen is genoeg — bij de volgende import gaat het vanzelf.
              </p>
              <ul className="flex flex-col gap-2">
                {voorstel.onbekend.map((wie) => (
                  <li
                    key={wie.sleutel}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-line px-3 py-2.5"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{wie.naam}</span>
                      <span className="text-xs text-muted">
                        {wie.aantal} {wie.aantal === 1 ? 'regel' : 'regels'}
                        {wie.reden === 'meerdere' && ' · meerdere medewerkers heten zo'}
                      </span>
                    </span>
                    <select
                      className="min-h-11 rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        const waarde = e.target.value
                        if (!waarde) return
                        vastleggen.mutate({
                          naam: wie.sleutel,
                          medewerker_id: waarde === 'negeren' ? null : waarde,
                        })
                      }}
                    >
                      <option value="">Kies een medewerker…</option>
                      {(kandidaten.data ?? []).map((k) => (
                        <option key={k.id} value={k.id}>
                          {[k.voornaam, k.achternaam].filter(Boolean).join(' ')}
                        </option>
                      ))}
                      <option value="negeren">Hoort niet bij ons personeel</option>
                    </select>
                  </li>
                ))}
              </ul>
            </Kaart>
          )}

          {/* -------------------------------------------- wat verandert --- */}
          {voorstel.gewijzigd > 0 && (
            <Kaart className="flex flex-col gap-3 p-5">
              <Kopje>Wat er verandert</Kopje>
              <ul className="flex flex-col divide-y divide-line text-sm">
                {voorstel.regels
                  .filter((r) => r.staat === 'gewijzigd')
                  .map((r) => (
                    <li key={r.regel.bron_id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="font-semibold">
                        {[r.regel.voornaam, r.regel.achternaam].filter(Boolean).join(' ') ||
                          'Open dienst'}
                      </span>
                      <span className="tabular-nums text-muted">
                        {r.was} → {r.regel.datum} {r.regel.begint}–{r.regel.eindigt} (
                        {naarKlok(r.regel.minuten)})
                      </span>
                    </li>
                  ))}
              </ul>
            </Kaart>
          )}
        </div>
      )}

      {/* ------------------------------------------------- eerder gedaan --- */}
      <div className="flex flex-col gap-3">
        <Kopje>Eerder ingelezen</Kopje>
        {imports.data && imports.data.length === 0 && (
          <Leeg titel="Nog niets ingelezen" uitleg="Begin met de export van de afgelopen week." />
        )}
        {imports.data && imports.data.length > 0 && (
          <Kaart>
            <ul className="divide-y divide-line text-sm">
              {imports.data.map((rij) => (
                <li key={rij.id as number} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {SOORTNAAM[rij.soort as 'planning' | 'gewerkt']}
                      {rij.periode_van && (
                        <span className="font-normal text-muted">
                          {' '}
                          · {datumKort(rij.periode_van as string)} –{' '}
                          {datumKort(rij.periode_tot as string)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted">{rij.bestandsnaam as string}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {rij.aantal_nieuw as number} nieuw · {rij.aantal_gewijzigd as number} gewijzigd ·{' '}
                    {new Date(rij.op as string).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Kaart>
        )}
      </div>
    </div>
  )
}
