import { Link } from 'react-router-dom'
import { Kaart, Laden, Mislukt, Pil } from '../components/ui'
import { korteDatum } from '../lib/personeel'
import {
  DAGEN,
  VOORKEUR,
  heeftIngevuld,
  perDag,
  samenvatting,
  useVasteDagenOverzicht,
  type Overzichtsregel,
} from '../lib/vasteDagen'

/* Ieders voorkeur voor vaste dagen naast elkaar.

   De vraag bij het maken van het rooster is niet "wat wil Daan", maar "wie heb
   ik dinsdag". Daarom staat bovenaan per dag hoeveel mensen hem graag doen en
   hoeveel hem kunnen, en daaronder pas de mensen zelf.

   Wie nog niets heeft opgegeven staat er ook bij. Juist dat wil je zien
   voordat je gaat plannen. */

const RIJ = 'grid grid-cols-[1fr_auto] md:grid-cols-[1fr_repeat(6,5rem)_3.5rem] items-center gap-x-2 gap-y-1'

function Hok({ waarde }: { waarde: Overzichtsregel['di'] }) {
  if (!waarde) return <span className="text-center text-muted">—</span>
  const k = VOORKEUR[waarde]
  const kleur =
    waarde === 'graag'
      ? 'bg-good-soft text-good'
      : waarde === 'kan'
        ? 'bg-surface-2 text-text'
        : waarde === 'liever_niet'
          ? 'bg-warn-soft text-warn'
          : 'bg-bad-soft text-bad'
  return (
    <span
      className={`block whitespace-nowrap rounded-[3px] px-1.5 py-1 text-center text-xs font-semibold ${kleur}`}
    >
      {k.label}
    </span>
  )
}

function Kop() {
  return (
    <div className={`${RIJ} hidden border-b border-line px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid`}>
      <span>Wie</span>
      {DAGEN.map((d) => (
        <span key={d.sleutel} className="text-center">
          {d.naam.slice(0, 2)}
        </span>
      ))}
      <span className="text-right">Vast</span>
    </div>
  )
}

function Regel({ r }: { r: Overzichtsregel }) {
  const kort = samenvatting(r)
  return (
    <div className={`${RIJ} border-b border-line px-4 py-2.5 last:border-0`}>
      <Link to={`/personeel/${r.persoon_id}`} className="min-w-0 truncate font-semibold hover:underline">
        {r.naam}
      </Link>

      {r.wil_vast === false ? (
        <span className="md:col-span-7 md:text-right">
          <Pil soort="neutraal">Wil geen vaste dagen</Pil>
        </span>
      ) : (
        <>
          {/* Op de telefoon staat het aantal naast de naam; op een breed scherm
              hoort het in zijn eigen kolom, achter de dagen. Twee aparte
              stukjes dus, in plaats van één die van plek springt. */}
          <span className="text-right tabular-nums md:hidden">{r.aantal_vast ?? '—'} vast</span>

          {DAGEN.map((d) => (
            <span key={d.sleutel} className="hidden md:block">
              <Hok waarde={r[d.sleutel]} />
            </span>
          ))}

          <span className="hidden text-right tabular-nums md:block">{r.aantal_vast ?? '—'}</span>

          {/* Op een telefoon past die tabel niet. Daar alleen de dagen die
              iets zeggen; "liever niet" laten we weg, want in een opsomming
              leest dat als een nee. */}
          <span className="col-span-full text-sm text-muted md:hidden">
            {kort.graag.length > 0 && <>Graag: {kort.graag.join(', ')}. </>}
            {kort.kan.length > 0 && <>Kan: {kort.kan.join(', ')}. </>}
            {kort.nee.length > 0 && <>Niet: {kort.nee.join(', ')}.</>}
          </span>
        </>
      )}

      {(r.za_hele_dag === 'graag' || r.zo_hele_dag === 'graag') && (
        <span className="col-span-full text-sm text-muted">
          Wil graag de hele dag op{' '}
          {[r.za_hele_dag === 'graag' && 'zaterdag', r.zo_hele_dag === 'graag' && 'zondag']
            .filter(Boolean)
            .join(' en ')}{' '}
          (12–20).
        </span>
      )}

      {r.blokkades && <span className="col-span-full text-sm text-muted">Let op: {r.blokkades}</span>}
    </div>
  )
}

export function RoosterVasteDagen() {
  const { data, isPending, error, refetch } = useVasteDagenOverzicht()

  if (isPending) return <Laden tekst="Voorkeuren ophalen…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const ingevuld = data.filter(heeftIngevuld)
  const nog = data.filter((r) => !heeftIngevuld(r))
  const tellingen = perDag(ingevuld)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Wat iedereen zelf heeft opgegeven, de laatste versie per persoon. Dit is een voorkeur, geen
        rooster: {ingevuld.length} van de {data.length} medewerkers heeft ingevuld.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tellingen.map((t) => (
          <Kaart key={t.sleutel} className="p-3">
            <p className="text-sm text-muted">{t.naam}</p>
            <p className="mt-1 font-display text-2xl tabular-nums">{t.graag}</p>
            <p className="text-sm text-muted">
              graag{t.kan > 0 && `, ${t.kan} kan`}
            </p>
          </Kaart>
        ))}
      </div>

      {ingevuld.length > 0 && (
        <Kaart className="flex flex-col py-2">
          <Kop />
          {ingevuld.map((r) => (
            <Regel key={r.persoon_id} r={r} />
          ))}
        </Kaart>
      )}

      {nog.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Nog niet ingevuld</h2>
          <Kaart className="flex flex-col py-2">
            {nog.map((r) => (
              <Link
                key={r.persoon_id}
                to={`/personeel/${r.persoon_id}`}
                className="border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface-2"
              >
                {r.naam}
              </Link>
            ))}
          </Kaart>
        </section>
      )}

      {ingevuld.length > 0 && (
        <p className="text-sm text-muted">
          Laatste inzending:{' '}
          {korteDatum(
            [...ingevuld].sort((a, b) => (b.ingevuld_op ?? '').localeCompare(a.ingevuld_op ?? ''))[0]
              .ingevuld_op,
          )}
          .
        </p>
      )}
    </div>
  )
}
