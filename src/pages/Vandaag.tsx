import { Link } from 'react-router-dom'
import { Kaart, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { Stromen } from '../components/Stromen'
import { inArchief, naamVan, toestandVan, usePersonen } from '../lib/personeel'
import { Wijzigingen } from '../components/Wijzigingen'
import { Reacties } from '../components/Reacties'
import { useReeksStand, useWeerreeks } from '../lib/weerreeks'
import { dagnaam, getal } from '../lib/opmaak'
import { ketenTekst, useContractwaker, wanneer } from '../lib/contractwaker'
import { useContractStanden, type ContractStand } from '../lib/getekendContract'
import { useState } from 'react'

/* Het startscherm van Sander.
 *
 * Stond tot september 2026 vol met personeel: meldingen, taken en een lijst met
 * ontbrekende contracten. Dat is precies het onderwerp dat geparkeerd is, en het
 * was het eerste wat je zag bij het openen van de app.
 *
 * Nu de volgorde van wat aandacht vraagt: eerst wat iemand van je wil, dan wat
 * er bij jou ligt, en onderaan de reeks die stilletjes doorloopt. Geld en inkoop
 * horen hier ook, maar die staan nog in een andere database — zodra Mplus
 * gekoppeld is komen ze bovenaan. */

function OpJou() {
  const { data, isPending, error, refetch } = usePersonen()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  // Alleen wat op jou wacht: rood is meteen, oranje is deze week.
  const opJou = data
    .filter((p) => !inArchief(p))
    .map((p) => ({ p, toestand: toestandVan(p) }))
    .filter(({ toestand }) => toestand.soort === 'fout' || toestand.soort === 'letop')
    .sort((a, b) => (a.toestand.soort === 'fout' ? -1 : 1) - (b.toestand.soort === 'fout' ? -1 : 1))

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Wat er op jou wacht</Kopje>
      {opJou.length === 0 ? (
        <Kaart className="p-6">
          <p className="font-display text-lg">Niets dat op jou wacht.</p>
          <p className="mt-1 text-sm text-muted">
            Alles in de personeelslijst ligt bij iemand anders.
          </p>
        </Kaart>
      ) : (
        <Kaart>
          {opJou.map(({ p, toestand }) => (
            <Link
              key={p.id}
              to={`/personeel/${p.id}`}
              data-touch
              className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{naamVan(p)}</span>
              <Pil soort={toestand.soort}>{toestand.label}</Pil>
            </Link>
          ))}
        </Kaart>
      )}

      <Link
        to="/personeel"
        data-touch
        className="inline-flex w-fit items-center rounded-[4px] border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
      >
        Naar de hele lijst
      </Link>
    </section>
  )
}

function Contracten() {
  const { data, isPending, error, refetch } = useContractwaker()

  // Stil als er niets is: het startscherm hoort niet weer vol personeel te staan.
  if (isPending || (data && data.length === 0)) return null
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Contracten</Kopje>
      <Kaart>
        {data.map((s) => (
          <Link
            key={`${s.persoonId}-${s.soort}`}
            to={`/personeel/${s.persoonId}`}
            data-touch
            className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.naam}</span>
              <span className="block text-sm text-muted">{s.wat}</span>
              {/* Hoeveelste contract het is bepaalt wat je kúnt aanbieden: na
                  de derde is een volgend tijdelijk contract er geen. */}
              {ketenTekst(s) && (
                <span className="block text-sm text-muted">
                  {ketenTekst(s)}
                  {s.volgendeWordtVast && ' — een volgend tijdelijk contract wordt vanzelf vast'}
                </span>
              )}
            </span>
            <Pil soort={s.ernst}>{wanneer(s.dagen, s.uiterlijk)}</Pil>
          </Link>
        ))}
      </Kaart>
    </section>
  )
}

const ACTIE: Record<'uploaden' | 'versturen', { wat: string; pil: string }> = {
  uploaden: { wat: 'Getekend contract uploaden', pil: 'Uploaden' },
  versturen: { wat: 'Getekend contract nog naar het loonbureau', pil: 'Versturen' },
}

function ContractRegel({ s, wat, pil, soort }: { s: ContractStand; wat: string; pil: string; soort: 'fout' | 'letop' }) {
  return (
    <Link
      to={`/personeel/${s.persoonId}`}
      data-touch
      className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{s.naam}</span>
        <span className="block text-sm text-muted">{s.fout ? `Mislukt: ${s.fout}` : wat}</span>
      </span>
      <Pil soort={soort}>{pil}</Pil>
    </Link>
  )
}

/* Getekende contracten. Wat jij moet doen staat er altijd; wie er zonder
   getekend contract bij staat is één regel die je openklapt, anders staat het
   startscherm weer vol personeel. */
function GetekendeContracten() {
  const { data, isPending, error, refetch } = useContractStanden()
  const [open, setOpen] = useState(false)

  if (isPending) return null
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const acties = data.filter((s) => s.stand === 'uploaden' || s.stand === 'versturen')
  const ontbreekt = data.filter((s) => s.stand === 'ontbreekt')
  if (acties.length === 0 && ontbreekt.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Getekende contracten</Kopje>
      <Kaart>
        {acties.map((s) => {
          const a = ACTIE[s.stand as 'uploaden' | 'versturen']
          return <ContractRegel key={s.persoonId} s={s} wat={a.wat} pil={a.pil} soort="fout" />
        })}
        {ontbreekt.length > 0 && (
          <button
            type="button"
            data-touch
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {ontbreekt.length} {ontbreekt.length === 1 ? 'medewerker' : 'medewerkers'} zonder getekend contract
              </span>
              <span className="block text-sm text-muted">Niets in het dossier onder "Getekend contract"</span>
            </span>
            <span className="text-sm text-muted" aria-hidden>
              {open ? '▾' : '▸'}
            </span>
          </button>
        )}
        {open &&
          ontbreekt.map((s) => (
            <ContractRegel key={s.persoonId} s={s} wat="Geen getekend contract in het dossier" pil="Ontbreekt" soort="letop" />
          ))}
      </Kaart>
    </section>
  )
}

function Weerreeks() {
  const { data, isPending, error, refetch } = useWeerreeks(7)
  const { data: stand } = useReeksStand()

  if (isPending) return <Laden />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />
  if (!data || data.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Kopje>Het weer</Kopje>
        <Leeg titel="Nog geen dagen verzameld." uitleg="De verzamelaar draait elke ochtend om half zes." />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Het weer</Kopje>
      <Kaart>
        {data.map((d) => (
          <div
            key={d.datum}
            className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-3 border-b border-line px-4 py-3 last:border-b-0"
          >
            <span className="font-semibold">{dagnaam(d.datum)}</span>
            <span className="truncate text-sm text-muted">
              {d.weerstype ?? '—'}
              {d.neerslag_mm ? ` · ${getal(d.neerslag_mm, 'mm')}` : ''}
            </span>
            <span className="tabular-nums text-sm">
              {getal(d.temp_max, '°C', 0)}
              <span className="text-muted"> / {getal(d.temp_min, '°C', 0)}</span>
            </span>
          </div>
        ))}
      </Kaart>
      {stand && (
        <p className="text-sm text-muted">
          {stand.dagen} dagen verzameld sinds{' '}
          {new Date(`${stand.eerste}T00:00:00`).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {stand.gaten === 0 ? ', zonder gaten.' : `, met ${stand.gaten} ontbrekende dagen.`} Straks
          ligt je omzet hiernaast.
        </p>
      )}
    </section>
  )
}

export function Vandaag() {
  return (
    <div className="flex flex-col gap-6">
      <Wijzigingen />

      <Reacties />

      <OpJou />

      <GetekendeContracten />

      <Contracten />

      <Weerreeks />

      <Stromen />
    </div>
  )
}
