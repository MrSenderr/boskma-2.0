import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { Kaart, Knop, Laden, Mislukt } from '../components/ui'
import { useToast } from '../components/Toast'
import {
  BETAALWIJZEN,
  betaalwijzeNaam,
  nogInTeStellen,
  opWerkEerst,
  useLeverancierZetten,
  useLeveranciers,
  type Leverancier,
} from '../lib/facturen'

/* Het schriftje: hoe betaalt elke leverancier.

   Wat nog niet is ingesteld staat bovenaan — dat is het werk dat er ligt. Van
   een deel is uit de mails al een vermoeden; dat staat er als suggestie bij,
   zodat je bevestigt in plaats van bedenkt. Een vermoeden telt niet als
   antwoord: pas als jij tikt vult een nieuwe factuur zich vanzelf in. */

function LeverancierKaart({ l, melden }: { l: Leverancier; melden: (t: string) => void }) {
  const zetten = useLeverancierZetten()
  const suggestie = !l.bevestigd && l.betaalwijze

  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">{l.leverancier}</span>
        <span className="text-sm text-muted">
          {l.aantal} {l.aantal === 1 ? 'factuur' : 'facturen'}
          {l.aantal_open > 0 && `, ${l.aantal_open} open`}
        </span>
      </div>

      {l.bevestigd ? (
        <p className="flex items-center gap-1.5 text-sm text-good">
          <Check className="size-4 shrink-0" aria-hidden />
          {betaalwijzeNaam(l.betaalwijze)}
        </p>
      ) : (
        <p className="text-sm text-muted">
          {suggestie ? (
            <>
              Uit de mails: <span className="font-semibold">{betaalwijzeNaam(l.betaalwijze)}</span>
              {l.opmerking && ` — ${l.opmerking}`}
            </>
          ) : (
            'Nog niets over bekend.'
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {BETAALWIJZEN.map((b) => (
          <Knop
            key={b.waarde}
            soort={l.betaalwijze === b.waarde && l.bevestigd ? 'primair' : 'rustig'}
            bezig={zetten.isPending}
            onClick={() =>
              zetten.mutate(
                { leverancier: l.leverancier, betaalwijze: b.waarde },
                {
                  onError: (e) =>
                    melden(e instanceof Error ? e.message : 'Vastleggen lukte niet.'),
                },
              )
            }
          >
            {b.label}
          </Knop>
        ))}
      </div>
    </Kaart>
  )
}

export function FacturenLeveranciers() {
  const { data, isPending, error, refetch } = useLeveranciers()
  const { toon, toast } = useToast()

  if (isPending) return <Laden tekst="Leveranciers ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const lijst = [...data].sort(opWerkEerst)
  const open = nogInTeStellen(lijst)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/facturen/inkomend"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar inkomend
      </Link>

      <div>
        <p className="font-display text-2xl">Leveranciers</p>
        <p className="mt-1 max-w-prose text-sm text-muted">
          {open === 0 ? (
            <>
              Alle {lijst.length} ingesteld. Een nieuwe factuur vult zichzelf nu in en komt niet
              meer bij Nog uitzoeken terecht.
            </>
          ) : (
            <>
              {open} van de {lijst.length} nog in te stellen. Zodra je er een vastlegt, vult elke
              volgende factuur van die leverancier zichzelf in — en de facturen die nu al
              openstaan gaan meteen mee.
            </>
          )}
        </p>
      </div>

      {lijst.map((l) => (
        <LeverancierKaart key={l.leverancier} l={l} melden={toon} />
      ))}

      {toast}
    </div>
  )
}
