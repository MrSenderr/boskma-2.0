import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download } from 'lucide-react'
import { Kaart, Knop, Kopje } from './ui'
import {
  bestandsnaam,
  csvBestand,
  haalExportGegevens,
  keurRij,
  naamVanExport,
  teExporteren,
} from '../lib/verzekeringsinzicht'

/* Export van het personeelsbestand naar Verzekeringsinzicht. Zie
   docs/SPEC-verzekeringsinzicht-csv.md.

   Klopt er iets niet, dan komt er geen bestand maar een lijstje met wie wat
   mist. Een half bestand naar een verzekeraar sturen is erger dan geen bestand:
   dat merk je pas als iemand zich ziek meldt. */

type Gebrek = { id: string; naam: string; missers: string[] }

export function ExportVerzekering() {
  const [bezig, setBezig] = useState(false)
  const [gebreken, setGebreken] = useState<Gebrek[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [gelukt, setGelukt] = useState<string | null>(null)

  async function exporteer() {
    setBezig(true)
    setGebreken(null)
    setFout(null)
    setGelukt(null)
    try {
      const iedereen = await haalExportGegevens()
      const mee = teExporteren(iedereen)

      if (mee.length === 0) {
        setFout('Er is niemand met een lopend contract om te exporteren.')
        return
      }

      const problemen = mee
        .map((p) => ({ id: p.id, naam: naamVanExport(p), missers: keurRij(p) }))
        .filter((g) => g.missers.length > 0)

      if (problemen.length > 0) {
        setGebreken(problemen)
        return
      }

      const naam = bestandsnaam()
      const url = URL.createObjectURL(csvBestand(mee))
      const a = document.createElement('a')
      a.href = url
      a.download = naam
      a.click()
      URL.revokeObjectURL(url)
      setGelukt(`${naam} — ${mee.length} ${mee.length === 1 ? 'medewerker' : 'medewerkers'}.`)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'De export lukte niet.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Export verzekeraar</Kopje>

      <div>
        <Knop soort="rustig" bezig={bezig} onClick={exporteer}>
          <Download className="size-4" aria-hidden />
          Export Verzekeringsinzicht
        </Knop>
      </div>

      {gelukt && (
        <p className="rounded-[4px] border border-good bg-good-soft px-3 py-2 text-sm text-good">
          Bestand gemaakt: {gelukt}
        </p>
      )}

      {fout && <p className="text-sm text-bad">{fout}</p>}

      {gebreken && (
        <Kaart className="flex flex-col gap-3 p-4">
          <p className="flex items-start gap-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Er is geen bestand gemaakt. Bij{' '}
            {gebreken.length === 1 ? 'deze medewerker' : `deze ${gebreken.length} medewerkers`}{' '}
            ontbreekt nog iets:
          </p>
          <div className="flex flex-col">
            {gebreken.map((g) => (
              <Link
                key={g.id}
                to={`/personeel/${g.id}`}
                className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0 hover:bg-surface-2"
              >
                <span className="font-semibold">{g.naam}</span>
                <span className="text-sm text-muted">{g.missers.join(', ')}</span>
              </Link>
            ))}
          </div>
        </Kaart>
      )}

      <p className="max-w-prose text-sm text-muted">
        Alleen medewerkers met een lopend of toekomstig contract gaan mee. Wie
        uit dienst is, van wie het contract is afgelopen, of van wie het dossier
        nog niet naar het loonbureau is, blijft eruit.
      </p>
    </section>
  )
}
