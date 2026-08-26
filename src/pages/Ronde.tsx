import { useState } from 'react'
import { Check, MessageSquareWarning, Thermometer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Kaart, Knop, Kopje, Laden, Leeg, Mislukt, Pil } from '../components/ui'
import { useApparaten, type Apparaat } from '../lib/apparaten'
import {
  ACTIES,
  isAfwijking,
  isSignaal,
  useMetingBewaren,
  useMetingenVandaag,
  type Meting,
} from '../lib/metingen'
import { useAuth } from '../lib/auth'
import { useWieBenIk } from '../lib/wie'
import { useWieWerkt } from '../lib/wieWerkt'
import { RONDES, apparatenVoor, rondeVanNu, standVan } from '../lib/rondes'
import { sluitingsrondeVanaf, useRooster, vandaagStr } from '../lib/openingstijden'
import type { Meetmoment } from '../lib/apparaten'

/* Wat een medewerker ziet. Eén scherm, één taak: de ronde langs de koelingen.
   Zie docs/modules/haccp/haccpmodule.md — "Schermen op de telefoon". */

/** Klein knopje om te melden dat er iets mis is met dit apparaat. Staat hier,
 *  want dit is het moment waarop iemand het merkt — en dan hoeft niemand later
 *  uit te leggen wélke koeling het was. */
function MeldKnop({ apparaat }: { apparaat: Apparaat }) {
  return (
    <Link
      to={`/melden?apparaat=${apparaat.id}`}
      aria-label={`Iets melden over ${apparaat.naam}`}
      title={`Iets melden over ${apparaat.naam}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-bad"
    >
      <MessageSquareWarning className="size-4" aria-hidden />
    </Link>
  )
}

function Regel({
  apparaat,
  meting,
  doorNaam,
  meetmoment,
  vraagWie,
}: {
  apparaat: Apparaat
  meting: Meting | undefined
  doorNaam: string
  meetmoment: string
  vraagWie: () => Promise<{ id: string; naam: string } | null>
}) {
  const bewaar = useMetingBewaren()
  const [waarde, setWaarde] = useState('')
  // Op een telefoon geeft het cijfertoetsenbord geen minteken. Daarom een eigen
  // knop — en bij een vriezer staat die meteen goed, want daar is min de regel.
  const [negatief, setNegatief] = useState(
    (apparaat.max_temp !== null && apparaat.max_temp < 0) ||
      (apparaat.min_temp !== null && apparaat.min_temp < 0),
  )
  const [actie, setActie] = useState<string | null>(null)
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  // Al gemeten vandaag: dan tonen we alleen nog wat er staat.
  if (meting) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0">
        <span className="flex items-center gap-1">
          <span className="font-medium">{meting.apparaat_naam}</span>
          <MeldKnop apparaat={apparaat} />
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold tabular-nums">{meting.temperatuur} °C</span>
          {meting.afwijking ? <Pil soort="fout">Afwijking</Pil> : <Pil soort="goed">Goed</Pil>}
        </span>
        {meting.actie && (
          <span className="w-full text-sm text-muted">Actie: {meting.actie}</span>
        )}
      </div>
    )
  }

  const ruw = waarde === '' ? null : Number(waarde.replace(',', '.').replace('-', ''))
  const getal = ruw === null || Number.isNaN(ruw) ? null : negatief ? -Math.abs(ruw) : Math.abs(ruw)
  const geldig = getal !== null && !Number.isNaN(getal)
  const afwijkt = geldig && isAfwijking(apparaat, getal)
  const signaal = geldig && isSignaal(apparaat, getal)

  async function bewaren() {
    if (!geldig) return
    // Op een tablet eerst vragen wie het deed; op een telefoon ben jij dat.
    const w = await vraagWie()
    if (w === null) return
    setFout(null)
    bewaar.mutate(
      {
        apparaat,
        temperatuur: getal,
        meetmoment,
        actie: afwijkt ? (actie ?? null) : null,
        opmerking: opmerking.trim() || null,
        doorNaam,
      },
      { onError: (e) => setFout(e.message) },
    )
  }

  return (
    <div
      className={`border-b border-line px-4 py-3 last:border-b-0 ${afwijkt ? 'border-l-4 border-l-bad bg-bad-soft' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-medium">
            {apparaat.naam}
            <MeldKnop apparaat={apparaat} />
          </p>
          <p className="text-sm text-muted">
            {apparaat.min_temp !== null && apparaat.max_temp !== null
              ? `${apparaat.min_temp} tot ${apparaat.max_temp} °C`
              : apparaat.min_temp !== null
                ? `min. ${apparaat.min_temp} °C`
                : apparaat.max_temp !== null
                  ? `max. ${apparaat.max_temp} °C`
                  : 'geen grenzen'}
          </p>
        </div>

        <div className="flex items-stretch gap-1">
          <button
            type="button"
            onClick={() => setNegatief((v) => !v)}
            aria-label={negatief ? 'Nu min, klik voor plus' : 'Nu plus, klik voor min'}
            aria-pressed={negatief}
            className={`flex size-12 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] text-xl font-bold ${
              negatief
                ? 'border-brand bg-brand text-on-brand'
                : 'border-line-strong text-muted hover:bg-surface-2'
            }`}
          >
            {negatief ? '−' : '+'}
          </button>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Temperatuur ${apparaat.naam}`}
            placeholder="°C"
            value={waarde}
            onChange={(e) => setWaarde(e.target.value)}
            className={`w-20 rounded-[4px] border-[1.5px] bg-bg px-2 py-2.5 text-center text-base font-bold tabular-nums outline-none ${
              afwijkt ? 'border-bad' : signaal ? 'border-warn' : 'border-line-strong focus:border-accent'
            }`}
          />
        </div>

        {geldig && !afwijkt && (
          <Knop soort="primair" bezig={bewaar.isPending} onClick={bewaren}>
            <Check className="size-4" aria-hidden />
            Bewaren
          </Knop>
        )}
      </div>

      {signaal && (
        <p className="mt-2 text-sm font-semibold text-warn">
          Binnen de norm, maar buiten je eigen grens. Even in de gaten houden.
        </p>
      )}

      {/* Een afwijking is pas af als er staat wat je eraan gedaan hebt. */}
      {afwijkt && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm font-bold text-bad">
            {getal} °C valt buiten de grenzen. Wat heb je gedaan?
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setActie(a)}
                className={`min-h-11 rounded-full border px-3 py-2 text-sm transition-colors ${
                  actie === a
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-line-strong hover:bg-surface-2'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Toelichting (mag leeg)"
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            className="w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
          />
          <Knop soort="primair" bezig={bewaar.isPending} disabled={!actie} onClick={bewaren}>
            Bewaren met actie
          </Knop>
          {!actie && (
            <p className="text-sm text-muted">Kies eerst wat je gedaan hebt.</p>
          )}
        </div>
      )}

      {fout && <p className="mt-2 text-sm text-bad">Dit ging mis: {fout}</p>}
    </div>
  )
}

export function Ronde() {
  const { data: apparaten, isPending, error, refetch } = useApparaten()
  const { data: rooster } = useRooster()
  // Vóór sluitingstijd staat de openingsronde voor; daarna de sluitingsronde.
  // Niets gekozen betekent: volg de klok. Kies je zelf, dan blijft dat staan —
  // een gemiste ronde moet je kunnen inhalen.
  const [gekozen, setGekozen] = useState<Exclude<Meetmoment, 'beide'> | null>(null)
  const moment = gekozen ?? rondeVanNu(sluitingsrondeVanaf(rooster, vandaagStr()))
  const setMoment = setGekozen
  const { data: metingen } = useMetingenVandaag(moment)
  const { email } = useAuth()
  const { data: wie } = useWieBenIk()
  const { vraagWie } = useWieWerkt()

  if (isPending) return <Laden tekst="Temperaturen laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const teMeten = apparatenVoor(apparaten, moment)
  const beideRondes = RONDES.every((r) => apparatenVoor(apparaten, r.moment).length > 0)
  const { gedaan, klaar } = standVan(teMeten, metingen)
  const afwijkingen = (metingen ?? []).filter((m) => m.afwijking).length
  const label = RONDES.find((r) => r.moment === moment)?.label ?? 'Ronde'

  const wisselaar = beideRondes ? (
    <div className="flex gap-1 rounded-[4px] bg-surface-2 p-1">
      {RONDES.map((r) => (
        <button
          key={r.moment}
          type="button"
          onClick={() => setMoment(r.moment)}
          aria-pressed={moment === r.moment}
          className={`min-h-11 flex-1 rounded-[3px] px-3 text-sm font-semibold transition-colors ${
            moment === r.moment ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface'
          }`}
        >
          {r.moment === 'opening' ? 'Opening' : 'Sluiting'}
        </button>
      ))}
    </div>
  ) : null

  if (teMeten.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {wisselaar}
        <Leeg
          titel="Nog niets te meten"
          uitleg={`Er staan geen actieve apparaten die bij ${moment === 'opening' ? 'opening' : 'sluiting'} gemeten moeten worden. Voeg ze toe onder HACCP, tabblad Apparaten.`}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {wisselaar}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kopje>{label}</Kopje>
          <p className="mt-1 font-display text-xl">
            {gedaan} van {teMeten.length} gemeten
          </p>
        </div>
        {klaar && <Pil soort="goed">Alles gemeten</Pil>}
      </div>

      {afwijkingen > 0 && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          {afwijkingen === 1 ? 'Eén afwijking' : `${afwijkingen} afwijkingen`} bij deze ronde.
          Die staan in het logboek en zijn niet weg te klikken.
        </p>
      )}

      <Kaart>
        {teMeten.map((a) => (
          <Regel
            key={a.id}
            apparaat={a}
            meting={(metingen ?? []).find((m) => m.apparaat_id === a.id)}
            doorNaam={wie?.naam || email || 'onbekend'}
            vraagWie={vraagWie}
            meetmoment={moment}
          />
        ))}
      </Kaart>

      <p className="flex items-start gap-2 text-sm text-muted">
        <Thermometer className="mt-0.5 size-4 shrink-0" aria-hidden />
        Elke meting wordt vastgelegd met het tijdstip van de server en op naam van
        wie is ingelogd. Corrigeren kan later wel, weggooien niet.
      </p>
    </div>
  )
}
