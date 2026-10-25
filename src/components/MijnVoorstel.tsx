import { useEffect, useRef, useState } from 'react'
import { Check, FileSignature, X } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import { korteDatum } from '../lib/personeel'
import {
  AARDNAAM,
  KEUZENAAM,
  openstaand,
  samenvatting,
  useMijnVoorstellen,
  useVoorstelAntwoorden,
  useVoorstelBevestigen,
  voorstelGeopend,
  type Voorstel,
} from '../lib/contractvoorstellen'

/* Wat de medewerker van een contractvoorstel ziet.
 *
 * Twee handelingen, in deze volgorde, en dat is geen smaak.
 *
 * Eerst **ik heb dit gelezen**. Aanzeggen moet schriftelijk en de ontvangst
 * moet te bewijzen zijn (art. 7:668 BW); dat bewijs is deze knop met zijn
 * tijdstip. Het openen van de pagina wordt ook vastgelegd, maar een pagina kan
 * per ongeluk openen — een knop niet.
 *
 * Dan de **keuze**, en alleen waar er iets te kiezen is. Bij een voorstel om
 * niet te verlengen valt er niets te kiezen: dan is het gelezen hebben het
 * einde. Een verlenging en een aanbod vaste uren zijn twee losse vragen, want
 * vaste uren mag je weigeren (art. 7:628a lid 5 BW) zonder daarmee de
 * verlenging af te wijzen.
 *
 * Een gegeven antwoord staat vast. Van gedachten veranderen loopt via Sander;
 * dat is geen strengheid maar de enige manier om later te kunnen laten zien
 * wat er is geantwoord en wanneer. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'

function Antwoord({
  v,
  wat,
  ja,
  nee,
  vraag,
  opmerking,
  opGedaan,
}: {
  v: Voorstel
  wat: 'verlenging' | 'vasteUren'
  ja: { waarde: 'akkoord' | 'aangenomen'; label: string }
  nee: { waarde: 'niet_akkoord' | 'geweigerd'; label: string }
  vraag: string
  opmerking: string
  opGedaan: () => void
}) {
  const antwoorden = useVoorstelAntwoorden()
  const [fout, setFout] = useState<string | null>(null)

  const stuur = (keuze: string) =>
    antwoorden.mutate(
      {
        id: v.id,
        ...(wat === 'verlenging'
          ? { verlenging: keuze as 'akkoord' | 'niet_akkoord' }
          : { vasteUren: keuze as 'aangenomen' | 'geweigerd' }),
        reactie: opmerking,
      },
      { onSuccess: opGedaan, onError: (e) => setFout(e.message) },
    )

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="font-semibold">{vraag}</p>
      {fout && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
          {fout}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" bezig={antwoorden.isPending} onClick={() => stuur(ja.waarde)}>
          <Check className="size-4" aria-hidden />
          {ja.label}
        </Knop>
        <Knop soort="gevaar" bezig={antwoorden.isPending} onClick={() => stuur(nee.waarde)}>
          <X className="size-4" aria-hidden />
          {nee.label}
        </Knop>
      </div>
    </div>
  )
}

function Een({ v }: { v: Voorstel }) {
  const bevestigen = useVoorstelBevestigen()
  const [fout, setFout] = useState<string | null>(null)
  /* Eén opmerkingveld per voorstel, niet één per vraag. Twee velden naast
     elkaar in dezelfde kaart laat je kiezen waar je iets neerzet terwijl het
     op dezelfde plek terechtkomt. Na een verstuurd antwoord leeg, anders gaat
     dezelfde tekst bij een tweede antwoord nog eens mee. */
  const [opmerking, setOpmerking] = useState('')
  const open = openstaand(v)
  const regels = v.brief ? v.brief.split('\n') : samenvatting(v)

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileSignature className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="font-display text-lg">{AARDNAAM[v.aard]}</span>
        {!v.ontvangst_bevestigd_op && <Pil soort="letop">Nieuw</Pil>}
      </div>

      {/* De brief zoals hij is verstuurd, niet opnieuw samengesteld. */}
      <div className="flex flex-col gap-1">
        {regels.map((r) => (
          <p key={r}>{r}</p>
        ))}
      </div>
      {v.toelichting && <p className="whitespace-pre-wrap text-muted">{v.toelichting}</p>}

      {!v.ontvangst_bevestigd_op ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {fout && (
            <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
              {fout}
            </p>
          )}
          <p className="text-sm text-muted">
            Laat eerst weten dat je dit gelezen hebt.
            {open.verlenging || open.vasteUren ? ' Daarna kun je antwoorden.' : ''}
          </p>
          <Knop
            soort="primair"
            className="w-fit"
            bezig={bevestigen.isPending}
            onClick={() => bevestigen.mutate(v.id, { onError: (e) => setFout(e.message) })}
          >
            <Check className="size-4" aria-hidden />
            Ik heb dit gelezen
          </Knop>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Gelezen op {korteDatum(v.ontvangst_bevestigd_op)}
          {v.op_papier && ' — op papier'}
        </p>
      )}

      {v.ontvangst_bevestigd_op && (open.verlenging || open.vasteUren) && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <label htmlFor={`opm-${v.id}`} className="text-sm font-semibold text-muted">
            Wil je er iets bij zeggen? (hoeft niet)
          </label>
          <textarea
            id={`opm-${v.id}`}
            rows={3}
            className={invoer}
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
          />
        </div>
      )}
      {v.ontvangst_bevestigd_op && open.verlenging && (
        <Antwoord
          v={v}
          wat="verlenging"
          vraag="Ga je akkoord met de verlenging?"
          ja={{ waarde: 'akkoord', label: 'Ja, akkoord' }}
          nee={{ waarde: 'niet_akkoord', label: 'Niet akkoord' }}
          opmerking={opmerking}
          opGedaan={() => setOpmerking('')}
        />
      )}
      {v.ontvangst_bevestigd_op && open.vasteUren && (
        <Antwoord
          v={v}
          wat="vasteUren"
          vraag="Neem je de vaste uren aan?"
          ja={{ waarde: 'aangenomen', label: 'Ja, ik neem ze aan' }}
          nee={{ waarde: 'geweigerd', label: 'Nee, ik blijf oproepkracht' }}
          opmerking={opmerking}
          opGedaan={() => setOpmerking('')}
        />
      )}

      {(v.keuze_verlenging || v.keuze_vaste_uren) && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {v.keuze_verlenging && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Pil soort={v.keuze_verlenging === 'akkoord' ? 'goed' : 'fout'}>
                {KEUZENAAM[v.keuze_verlenging]}
              </Pil>
              <span className="text-muted">op {korteDatum(v.keuze_verlenging_op)}</span>
            </p>
          )}
          {v.keuze_vaste_uren && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Pil soort={v.keuze_vaste_uren === 'aangenomen' ? 'goed' : 'neutraal'}>
                {KEUZENAAM[v.keuze_vaste_uren]}
              </Pil>
              <span className="text-muted">op {korteDatum(v.keuze_vaste_uren_op)}</span>
            </p>
          )}
          {v.reactie && (
            <p className="whitespace-pre-wrap rounded-[4px] bg-surface-2 p-3 text-sm">{v.reactie}</p>
          )}
          <p className="text-sm text-muted">
            Wil je dit toch anders? Zeg het tegen Sander; hij kan een nieuw voorstel sturen.
          </p>
        </div>
      )}
    </Kaart>
  )
}

export function MijnVoorstellen() {
  const { data } = useMijnVoorstellen()
  const gemeld = useRef<Set<string>>(new Set())

  /* Openen vastleggen, één keer per voorstel. Dit is niet hetzelfde als de
     ontvangstbevestiging: het is het spoor dat hij de pagina heeft gezien, en
     het is wat Sander laat weten of hij ernaar moet vragen. */
  useEffect(() => {
    ;(data ?? [])
      .filter((v) => !v.geopend_op && !gemeld.current.has(v.id))
      .forEach((v) => {
        gemeld.current.add(v.id)
        void voorstelGeopend(v.id)
      })
  }, [data])

  if (!data || data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Je contract</Kopje>
      {data.map((v) => (
        <Een key={v.id} v={v} />
      ))}
    </section>
  )
}
