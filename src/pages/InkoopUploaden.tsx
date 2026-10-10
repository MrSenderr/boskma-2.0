import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Kaart, Knop, Laden, Mislukt } from '../components/ui'
import {
  hashVan,
  useLeveranciers,
  useUploads,
  type Upload as Wachtrij,
  type Uploadstatus,
} from '../lib/inkoop'

/* Een factuur in de app zetten.

   Het uitlezen gebeurt niet hier maar op de achtergrond, en het duurt bij
   Veldboer ongeveer twee minuten: de tekstlaag van die pdf's is onbruikbaar
   gemaakt, dus de pagina's worden bekeken in plaats van gelezen. Daarom zet je
   hem hier neer en kijk je straks terug — weglopen mag. */

const WOORDEN: Record<Uploadstatus, string> = {
  nieuw: 'staat klaar om uitgelezen te worden',
  bezig: 'wordt uitgelezen',
  klaar: 'uitgelezen',
  mislukt: 'niet gelukt',
  duplicaat: 'stond er al',
}

function Regel({ u }: { u: Wachtrij }) {
  const bezig = u.status === 'nieuw' || u.status === 'bezig'
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0">
      <span className="flex items-baseline gap-2">
        {bezig && <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />}
        {u.status === 'klaar' && <Check className="size-4 shrink-0 text-good" aria-hidden />}
        {(u.status === 'mislukt' || u.status === 'duplicaat') && (
          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
        )}
        <span>
          {u.bestandsnaam}
          <span className="block text-sm text-muted">
            {WOORDEN[u.status]}
            {u.melding && ` — ${u.melding}`}
          </span>
        </span>
      </span>

      {u.document_id !== null && (
        <Link to="/inkoop/documenten" className="text-sm font-semibold underline">
          Bekijk bij de facturen
        </Link>
      )}
    </div>
  )
}

export function InkoopUploaden() {
  const leveranciers = useLeveranciers()
  const uploads = useUploads()
  const client = useQueryClient()
  const veld = useRef<HTMLInputElement>(null)

  const [leverancier, setLeverancier] = useState<number | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  const gekozen = leverancier ?? leveranciers.data?.[0]?.id ?? null

  async function kies(bestand: File | undefined) {
    if (!bestand || gekozen === null) return
    setFout('')
    setBezig(true)
    try {
      if (bestand.type !== 'application/pdf') {
        throw new Error('Dit is geen pdf. Een factuur van de groothandel is altijd een pdf.')
      }

      /* Eerst kijken of we hem al hebben. Uitlezen kost een paar cent en twee
         minuten, dus dat doe je niet twee keer voor hetzelfde bestand. */
      const hash = await hashVan(bestand)
      const bestaat = await supabase
        .schema('inkoop')
        .from('documenten')
        .select('nummer')
        .eq('bestand_hash', hash)
        .maybeSingle()
      if (bestaat.error) throw new Error(bestaat.error.message)
      if (bestaat.data) {
        throw new Error(`Deze factuur staat er al, als ${(bestaat.data as { nummer: string }).nummer}.`)
      }

      const pad = `uploads/${hash}.pdf`
      const gezet = await supabase.storage
        .from('inkoopdocumenten')
        .upload(pad, bestand, { contentType: 'application/pdf', upsert: true })
      if (gezet.error) throw new Error(gezet.error.message)

      const briefje = await supabase
        .schema('inkoop')
        .from('uploads')
        .insert({
          opslagpad: pad,
          bestandsnaam: bestand.name,
          bestand_hash: hash,
          leverancier_id: gekozen,
        })
      if (briefje.error) {
        throw new Error(
          briefje.error.code === '23505'
            ? 'Dit bestand staat al in de wachtrij.'
            : briefje.error.message,
        )
      }

      await client.invalidateQueries({ queryKey: ['inkoop', 'uploads'] })
      if (veld.current) veld.current.value = ''
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Er ging iets mis')
    } finally {
      setBezig(false)
    }
  }

  if (leveranciers.isPending) return <Laden tekst="Leveranciers ophalen…" />
  if (leveranciers.error)
    return <Mislukt tekst={leveranciers.error.message} opnieuw={() => leveranciers.refetch()} />

  const rij = uploads.data ?? []
  const loopt = rij.some((u) => u.status === 'nieuw' || u.status === 'bezig')

  return (
    <div className="flex flex-col gap-5">
      <Kaart className="flex flex-col gap-4 p-4">
        <div>
          <p className="font-display text-lg">Een factuur toevoegen</p>
          <p className="mt-1 text-sm text-muted">
            Het uitlezen gebeurt op de achtergrond en duurt ongeveer twee minuten. Je kunt dit
            scherm gerust sluiten; de factuur staat er straks gewoon. Elke factuur kost een paar
            cent aan uitleeskosten.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Van welke leverancier</span>
          <select
            value={gekozen ?? ''}
            onChange={(e) => setLeverancier(Number(e.target.value))}
            className="rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 outline-none focus:border-accent"
          >
            {leveranciers.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.naam}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">
            Elke leverancier maakt zijn factuur anders op, dus dit bepaalt hoe hij gelezen wordt.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={veld}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => kies(e.target.files?.[0])}
          />
          <Knop onClick={() => veld.current?.click()} bezig={bezig}>
            <Upload className="size-4" aria-hidden />
            Kies een pdf
          </Knop>
          {loopt && <span className="text-sm text-muted">Er wordt al iets uitgelezen.</span>}
        </div>

        {fout && <p className="text-sm text-bad">{fout}</p>}
      </Kaart>

      {rij.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Laatst toegevoegd</h2>
          <Kaart className="flex flex-col py-2">
            {rij.map((u) => (
              <Regel key={u.id} u={u} />
            ))}
          </Kaart>
        </section>
      )}
    </div>
  )
}
