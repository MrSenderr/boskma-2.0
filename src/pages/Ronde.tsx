import { useState } from 'react'
import { Check, Thermometer } from 'lucide-react'
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

/* Wat een medewerker ziet. Eén scherm, één taak: de ronde langs de koelingen.
   Zie docs/modules/haccp/haccpmodule.md — "Schermen op de telefoon". */

const MEETMOMENT = 'opening'

function Regel({
  apparaat,
  meting,
  doorNaam,
  doorGebruiker,
}: {
  apparaat: Apparaat
  meting: Meting | undefined
  doorNaam: string
  doorGebruiker: string | undefined
}) {
  const bewaar = useMetingBewaren()
  const [waarde, setWaarde] = useState('')
  const [actie, setActie] = useState<string | null>(null)
  const [opmerking, setOpmerking] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  // Al gemeten vandaag: dan tonen we alleen nog wat er staat.
  if (meting) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0">
        <span className="font-medium">{meting.apparaat_naam}</span>
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

  const getal = waarde === '' ? null : Number(waarde.replace(',', '.'))
  const geldig = getal !== null && !Number.isNaN(getal)
  const afwijkt = geldig && isAfwijking(apparaat, getal)
  const signaal = geldig && isSignaal(apparaat, getal)

  function bewaren() {
    if (!geldig) return
    setFout(null)
    bewaar.mutate(
      {
        apparaat,
        temperatuur: getal,
        meetmoment: MEETMOMENT,
        actie: afwijkt ? (actie ?? null) : null,
        opmerking: opmerking.trim() || null,
        doorNaam,
        doorGebruiker,
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
          <p className="font-medium">{apparaat.naam}</p>
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

        <input
          type="text"
          inputMode="decimal"
          aria-label={`Temperatuur ${apparaat.naam}`}
          placeholder="°C"
          value={waarde}
          onChange={(e) => setWaarde(e.target.value)}
          className={`w-24 rounded-[4px] border-[1.5px] bg-bg px-3 py-2.5 text-center text-base font-bold tabular-nums outline-none ${
            afwijkt ? 'border-bad' : signaal ? 'border-warn' : 'border-line-strong focus:border-accent'
          }`}
        />

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
  const { data: metingen } = useMetingenVandaag(MEETMOMENT)
  const { email } = useAuth()

  if (isPending) return <Laden tekst="Ronde laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const teMeten = apparaten.filter(
    (a) => a.actief && (a.meetmoment === MEETMOMENT || a.meetmoment === 'beide'),
  )

  if (teMeten.length === 0) {
    return (
      <Leeg
        titel="Nog niets te meten"
        uitleg="Er staan geen actieve apparaten die bij opening gemeten moeten worden. Voeg ze toe onder HACCP, tabblad Apparaten."
      />
    )
  }

  const gedaan = teMeten.filter((a) =>
    (metingen ?? []).some((m) => m.apparaat_id === a.id),
  ).length
  const klaar = gedaan === teMeten.length
  const afwijkingen = (metingen ?? []).filter((m) => m.afwijking).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Kopje>Openingsronde</Kopje>
          <p className="mt-1 font-display text-xl">
            {gedaan} van {teMeten.length} gemeten
          </p>
        </div>
        {klaar && <Pil soort="goed">Ronde compleet</Pil>}
      </div>

      {afwijkingen > 0 && (
        <p className="rounded-[4px] border border-bad bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          {afwijkingen === 1 ? 'Eén afwijking' : `${afwijkingen} afwijkingen`} vandaag.
          Die staan in het logboek en zijn niet weg te klikken.
        </p>
      )}

      <Kaart>
        {teMeten.map((a) => (
          <Regel
            key={a.id}
            apparaat={a}
            meting={(metingen ?? []).find((m) => m.apparaat_id === a.id)}
            doorNaam={email ?? 'onbekend'}
            doorGebruiker={undefined}
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
