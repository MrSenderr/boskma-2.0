import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Kaart, Knop, Kopje, Pil } from './ui'
import { korteDatum, type Persoon } from '../lib/personeel'
import {
  VELDNAMEN,
  moetNaarLoonbureau,
  useWijzigingDoorgegeven,
  useWijzigingenVan,
  type Wijziging,
} from '../lib/mijngegevens'

/* Wat de medewerker zelf heeft gewijzigd.
 *
 * Medewerkers kunnen hun eigen gegevens aanpassen. De meeste velden gaan
 * meteen door; een rekeningnummer en een mailadres wachten op akkoord. Beide
 * soorten leverden tot nu toe een melding op het startscherm op, en die
 * verdween zodra je hem had weggetikt.
 *
 * Daarmee bleef de vraag open die er later toe doet: is dat rekeningnummer
 * altijd al zo geweest, of is het vorige maand veranderd — en heb ik het
 * doorgegeven? Dit blok houdt dat vast op de plek waar je het zoekt: zijn
 * eigen kaart.
 *
 * Twee gewichten. Een adres of rekeningnummer raakt de loonbetaling en blijft
 * opvallen tot je het hebt doorgegeven. Een kledingmaat of noodcontact staat
 * er rustig bij: te zien, maar niemand hoeft er iets mee.
 */

function waarde(v: string | null): string {
  const w = (v ?? '').trim()
  return w === '' ? 'leeg' : w
}

function Regel({ w, gevoelig }: { w: Wijziging; gevoelig: boolean }) {
  const wacht = w.goedkeuring_nodig && w.status === 'open'
  const afgewezen = w.status === 'afgewezen'

  return (
    <div className="border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{VELDNAMEN[w.veld] ?? w.veld}</span>
          {wacht && <Pil soort="letop">Wacht op jouw akkoord</Pil>}
          {afgewezen && <Pil soort="neutraal">Afgewezen</Pil>}
        </span>
        <span className="text-sm text-muted">{korteDatum(w.aangevraagd_op)}</span>
      </div>

      {/* Bij een rekeningnummer hoort de oude waarde niet open en bloot op het
          scherm te staan; dat het veranderd is, is wat telt. */}
      <p className="mt-0.5 break-words text-sm text-muted">
        {gevoelig ? (
          afgewezen ? (
            'Voorgesteld en door jou afgewezen.'
          ) : (
            'Gewijzigd. Open de gegevens hierboven om het te zien.'
          )
        ) : (
          <>
            van <span className="text-text">{waarde(w.oude_waarde)}</span> naar{' '}
            <span className="text-text">{waarde(w.nieuwe_waarde)}</span>
          </>
        )}
      </p>
    </div>
  )
}

export function ZelfGewijzigd({ persoon }: { persoon: Persoon }) {
  const { data } = useWijzigingenVan(persoon.id)
  const doorgegeven = useWijzigingDoorgegeven(persoon.id)
  const [fout, setFout] = useState<string | null>(null)

  if (!data || data.length === 0) return null

  const nogDoorgeven = data.filter(moetNaarLoonbureau)
  const gevoelig = (veld: string) => veld === 'iban'

  return (
    <section className="flex flex-col gap-3">
      <Kopje>Zelf gewijzigd</Kopje>

      {/* Wat de loonbetaling raakt blijft bovenaan staan tot je het hebt
          doorgegeven. Een adres dat alleen in de app klopt is een loonstrook
          die naar het oude adres gaat. */}
      {nogDoorgeven.length > 0 && (
        <Kaart className="flex flex-col gap-3 border-warn p-4">
          <p className="flex items-start gap-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {nogDoorgeven.length === 1
                ? 'Er is iets gewijzigd dat het loonbureau moet weten: '
                : 'Er zijn dingen gewijzigd die het loonbureau moet weten: '}
              {nogDoorgeven.map((w) => (VELDNAMEN[w.veld] ?? w.veld).toLowerCase()).join(', ')}.
            </span>
          </p>
          {fout && <p className="text-sm text-bad">{fout}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Knop
              soort="rustig"
              bezig={doorgegeven.isPending}
              onClick={() =>
                doorgegeven.mutate(
                  nogDoorgeven.map((w) => w.id),
                  { onError: (e) => setFout(e.message) },
                )
              }
            >
              <Check className="size-4" aria-hidden />
              Doorgegeven
            </Knop>
            <span className="text-sm text-muted">
              Stuur je een nieuw mutatieformulier, dan gaat het vanzelf mee.
            </span>
          </div>
        </Kaart>
      )}

      <Kaart className="flex flex-col py-2">
        {data.map((w) => (
          <Regel key={w.id} w={w} gevoelig={gevoelig(w.veld)} />
        ))}
      </Kaart>
    </section>
  )
}
