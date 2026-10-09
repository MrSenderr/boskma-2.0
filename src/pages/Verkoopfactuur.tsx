import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Plus, Trash2 } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Veld } from '../components/ui'
import { useToast } from '../components/Toast'
import { GetalVeld } from '../components/GetalVeld'
import { Versturen } from '../components/Versturen'
import {
  euro,
  euroUitCenten,
  kortDatum,
  regelCenten,
  totalenVan,
  useConceptOpslaan,
  useConceptWeg,
  useKlanten,
  useProducten,
  useVerkoopfactuur,
  useCrediteren,
  useVerkoopBetaald,
  useVerkoopHeropenen,
  verwissel,
  dagenTeLaat,
  haalPdf,
  type Btw,
  type Regel,
  // De pagina heet ook Verkoopfactuur; vandaar een andere naam voor het type.
  type Verkoopfactuur as VerkoopfactuurType,
} from '../lib/verkoop'

/* Een factuur opstellen. Zolang er geen nummer op staat is het een concept en
   mag alles; zodra hij verstuurd is ligt hij vast en kun je hem alleen nog
   bekijken. Dat is geen strengheid van de app: factuurnummers moeten
   doorlopen, en wat de klant heeft gekregen mag niet meer veranderen. */

const invoer =
  'w-full rounded-[4px] border-[1.5px] border-line-strong bg-bg px-3 py-2.5 text-base outline-none focus:border-accent'


function Bedragen({ regels }: { regels: Regel[] }) {
  const t = totalenVan(regels)
  return (
    <Kaart className="flex flex-col gap-1 p-4 text-sm">
      {[
        ['Subtotaal excl. btw', t.excl],
        ['Btw 9%', t.btw9],
        ['Btw 21%', t.btw21],
      ].map(([label, waarde]) => (
        <p key={String(label)} className="flex justify-between gap-4 text-muted">
          <span>{label}</span>
          <span className="tabular-nums">{euroUitCenten(Number(waarde))}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
        <span>Totaal incl. btw</span>
        <span className="tabular-nums">{euroUitCenten(t.incl)}</span>
      </p>
    </Kaart>
  )
}

function RegelKaart({
  r,
  onWijzig,
  onWeg,
  onOmhoog,
  onOmlaag,
}: {
  r: Regel
  onWijzig: (nieuw: Regel) => void
  onWeg: () => void
  /** Niet meegegeven = deze regel staat al boven- of onderaan. */
  onOmhoog?: () => void
  onOmlaag?: () => void
}) {
  return (
    <Kaart className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <input
          aria-label="Omschrijving"
          className={`${invoer} flex-1`}
          value={r.omschrijving}
          onChange={(e) => onWijzig({ ...r, omschrijving: e.target.value })}
        />
        {/* Pijltjes in plaats van slepen: met een vinger op een telefoon mis
            je bij slepen net zo vaak als je raak hebt. */}
        <div className="mt-1.5 flex shrink-0 items-center">
          <button
            type="button"
            onClick={onOmhoog}
            disabled={!onOmhoog}
            aria-label="Regel omhoog"
            className="p-1.5 text-muted hover:text-text disabled:opacity-25"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOmlaag}
            disabled={!onOmlaag}
            aria-label="Regel omlaag"
            className="p-1.5 text-muted hover:text-text disabled:opacity-25"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onWeg}
          aria-label="Regel weghalen"
          className="mt-2.5 shrink-0 p-1.5 text-muted hover:text-bad"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <GetalVeld
          label="Aantal"
          waarde={r.aantal}
          placeholder="1"
          onWijzig={(n) => onWijzig({ ...r, aantal: n ?? 0 })}
        />
        <GetalVeld
          label="Prijs incl."
          waarde={r.prijs_incl}
          placeholder="0,00"
          onWijzig={(n) => onWijzig({ ...r, prijs_incl: n ?? 0 })}
        />
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
          Btw
          <select
            className={invoer}
            value={r.btw_tarief}
            onChange={(e) => onWijzig({ ...r, btw_tarief: Number(e.target.value) as Btw })}
          >
            <option value={9}>9%</option>
            <option value={21}>21%</option>
            <option value={0}>0%</option>
          </select>
        </label>
      </div>

      <p className="text-right text-sm tabular-nums text-muted">{euroUitCenten(regelCenten(r))}</p>
    </Kaart>
  )
}

function Prijslijst({ onKies }: { onKies: (r: Regel) => void }) {
  const { data } = useProducten()
  const [zoek, setZoek] = useState('')
  const actief = (data ?? []).filter((p) => p.actief)

  if (actief.length === 0) {
    return (
      <p className="text-sm text-muted">
        Je prijslijst is nog leeg. Typ hieronder een losse regel, of vul eerst je{' '}
        <Link to="/facturen/prijslijst" className="underline">
          prijslijst
        </Link>{' '}
        in.
      </p>
    )
  }

  const gevonden = actief.filter((p) => p.naam.toLowerCase().includes(zoek.toLowerCase()))

  return (
    <div className="flex flex-col gap-2">
      <input
        className={invoer}
        placeholder="Zoek in de prijslijst…"
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {gevonden.slice(0, 12).map((p) => (
          <Knop
            key={p.id}
            soort="rustig"
            onClick={() =>
              onKies({
                volgorde: 0,
                product_id: p.id,
                omschrijving: p.naam,
                aantal: 1,
                prijs_incl: Number(p.prijs_incl),
                btw_tarief: p.btw_tarief,
              })
            }
          >
            {p.naam} · {euro(Number(p.prijs_incl))}
          </Knop>
        ))}
      </div>
    </div>
  )
}

/* Wat je met een verstuurde factuur nog kunt: afvinken als hij betaald is,
   een herinnering sturen als hij te laat is, of hem crediteren. Wijzigen kan
   niet meer — daarom staat crediteren hier en niet een bewerkknop. */
function VerstuurdeActies({
  factuur,
  melden,
}: {
  factuur: VerkoopfactuurType
  melden: (t: string) => void
}) {
  const navigeer = useNavigate()
  const { data: klanten } = useKlanten()
  const betaald = useVerkoopBetaald()
  const heropenen = useVerkoopHeropenen()
  const crediteren = useCrediteren()
  const [datum, setDatum] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [herinneren, setHerinneren] = useState(false)

  const klant = klanten?.find((k) => k.id === factuur.klant_id)
  const telaat = dagenTeLaat(factuur)
  const fout = (e: unknown) => melden(e instanceof Error ? e.message : 'Dat lukte niet.')

  if (factuur.status === 'betaald') {
    return (
      <Kaart className="flex flex-wrap items-center justify-between gap-2 p-4">
        <span className="text-sm text-good">
          Betaald op {factuur.betaald_op ? kortDatum(factuur.betaald_op) : 'onbekende datum'}.
        </span>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => heropenen.mutate(factuur.id, { onError: fout })}
        >
          Toch niet betaald
        </button>
      </Kaart>
    )
  }

  if (factuur.status === 'gecrediteerd') {
    return <p className="text-sm text-muted">Deze factuur is gecrediteerd.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {telaat > 0 && (
        <p className="text-sm text-bad">
          {telaat} {telaat === 1 ? 'dag' : 'dagen'} te laat.
        </p>
      )}

      <Kaart className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold">Is hij betaald?</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40">
            <Veld
              label="Op welke datum"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>
          <Knop
            soort="primair"
            bezig={betaald.isPending}
            onClick={() => betaald.mutate({ id: factuur.id, datum }, { onError: fout })}
          >
            Betaald ontvangen
          </Knop>
        </div>
      </Kaart>

      {telaat > 0 && (
        herinneren ? (
          <Versturen
            factuur={factuur}
            klant={klant}
            melden={melden}
            onKlaar={() => setHerinneren(false)}
            herinnering
          />
        ) : (
          <Knop soort="rustig" className="w-fit" onClick={() => setHerinneren(true)}>
            Herinnering sturen
          </Knop>
        )
      )}

      <div>
        <Knop
          soort="gevaar"
          bezig={crediteren.isPending}
          onClick={() =>
            crediteren.mutate(factuur.id, {
              onSuccess: (nieuwId) => {
                melden('Creditfactuur aangemaakt als concept. Kijk hem na en verstuur hem.')
                navigeer(`/facturen/uitgaand/${nieuwId}`)
              },
              onError: fout,
            })
          }
        >
          Crediteren
        </Knop>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Maakt een creditfactuur met dezelfde regels, negatief. Die begint als concept, dus je
          kunt hem nog aanpassen. Zodra je hem verstuurt gaat deze factuur op gecrediteerd.
        </p>
      </div>
    </div>
  )
}

export function Verkoopfactuur() {
  const { id } = useParams()
  const nieuw = id === 'nieuw'
  const factuurId = nieuw ? undefined : Number(id)
  const navigeer = useNavigate()
  const { toon, toast } = useToast()

  const bestaand = useVerkoopfactuur(factuurId)
  const { data: klanten } = useKlanten()
  const [verstuurOpen, setVerstuurOpen] = useState(false)
  const opslaan = useConceptOpslaan()
  const weg = useConceptWeg()

  const [klantId, setKlantId] = useState<number | ''>('')
  const [onderwerp, setOnderwerp] = useState('')
  const [leverdatum, setLeverdatum] = useState('')
  const [periode, setPeriode] = useState('')
  const [notitie, setNotitie] = useState('')
  const [regels, setRegels] = useState<Regel[]>([])
  const [geladen, setGeladen] = useState(false)
  const [pdfBezig, setPdfBezig] = useState(false)

  /* De pdf in een nieuw tabblad. Downloaden kan daar; zo zie je eerst hoe hij
     eruitziet voordat er iets de deur uit gaat. */
  async function toonPdf(vanId: number, soort: 'definitief' | 'concept' | 'test') {
    setPdfBezig(true)
    try {
      const blob = await haalPdf(vanId, soort)
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      toon(e instanceof Error ? e.message : 'De pdf maken lukte niet.')
    } finally {
      setPdfBezig(false)
    }
  }

  useEffect(() => {
    if (nieuw || geladen || !bestaand.data) return
    const f = bestaand.data.factuur
    setKlantId(f.klant_id)
    setOnderwerp(f.onderwerp ?? '')
    setLeverdatum(f.leverdatum ?? '')
    setPeriode(f.periode ?? '')
    setNotitie(f.notitie_op_factuur ?? '')
    setRegels(bestaand.data.regels)
    setGeladen(true)
  }, [nieuw, geladen, bestaand.data])

  if (!nieuw && bestaand.isPending) return <Laden tekst="Factuur ophalen…" />
  if (!nieuw && bestaand.error)
    return <Mislukt tekst={bestaand.error.message} opnieuw={() => bestaand.refetch()} />

  const factuur = bestaand.data?.factuur
  const vast = Boolean(factuur?.nummer)

  function bewaar() {
    if (klantId === '') {
      toon('Kies eerst een klant.')
      return
    }
    opslaan.mutate(
      {
        id: factuurId,
        klant_id: Number(klantId),
        onderwerp: onderwerp.trim() || null,
        leverdatum: leverdatum || null,
        periode: periode.trim() || null,
        notitie_op_factuur: notitie.trim() || null,
        regels,
      },
      {
        onSuccess: () => navigeer('/facturen/uitgaand'),
        onError: (e) => toon(e instanceof Error ? e.message : 'Opslaan lukte niet.'),
      },
    )
  }

  /* --------------------------------------------------- vastgelegd --- */
  if (vast && factuur) {
    return (
      <div className="flex flex-col gap-5">
        <Link
          to="/facturen/uitgaand"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug
        </Link>
        <div>
          <Kopje>Factuur {factuur.nummer}</Kopje>
          <p className="mt-1 font-display text-2xl">{factuur.klanten?.naam}</p>
          <p className="text-sm text-muted">
            {factuur.onderwerp && `${factuur.onderwerp} · `}
            {factuur.factuurdatum && `${kortDatum(factuur.factuurdatum)}`}
            {factuur.vervaldatum && ` · vervalt ${kortDatum(factuur.vervaldatum)}`}
          </p>
        </div>

        {/* Van een factuur die buiten de app is gemaakt kennen we alleen het
            totaal. Dan is "excl. btw € 0,00" geen informatie maar een leugen. */}
        <Kaart className="flex flex-col gap-1 p-4 text-sm">
          {Number(factuur.totaal_excl) > 0 ? (
            <>
              <p className="flex justify-between gap-4 text-muted">
                <span>Excl. btw</span>
                <span className="tabular-nums">{euro(Number(factuur.totaal_excl))}</span>
              </p>
              <p className="flex justify-between gap-4 text-muted">
                <span>Btw</span>
                <span className="tabular-nums">
                  {euro(Number(factuur.btw_9) + Number(factuur.btw_21))}
                </span>
              </p>
            </>
          ) : (
            <p className="text-muted">
              {Number(factuur.totaal_incl) > 0
                ? 'De verdeling over btw-tarieven is niet bekend.'
                : 'Het bedrag van deze factuur is niet bekend.'}
            </p>
          )}
          <p className="mt-1 flex justify-between gap-4 border-t border-line pt-2 font-semibold">
            <span>Totaal</span>
            <span className="tabular-nums">
              {Number(factuur.totaal_incl) > 0 ? euro(Number(factuur.totaal_incl)) : '—'}
            </span>
          </p>
        </Kaart>

        {factuur.interne_notitie && (
          <p className="text-sm text-muted">{factuur.interne_notitie}</p>
        )}

        <Knop soort="rustig" className="w-fit" bezig={pdfBezig} onClick={() => toonPdf(factuur.id, 'definitief')}>
          <FileText className="size-4" aria-hidden />
          Pdf bekijken
        </Knop>

        <VerstuurdeActies factuur={factuur} melden={toon} />

        {toast}

        <p className="max-w-prose text-sm text-muted">
          Deze factuur heeft een nummer en ligt daarmee vast: wat de klant heeft gekregen mag niet
          meer veranderen, en nummers moeten doorlopen zonder gaten.
        </p>
      </div>
    )
  }

  /* ------------------------------------------------------- concept --- */
  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/facturen/uitgaand"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug
      </Link>

      <Kopje>{nieuw ? 'Nieuwe factuur' : 'Concept bewerken'}</Kopje>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Klant</span>
        <select
          className={invoer}
          value={klantId}
          onChange={(e) => setKlantId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Kies een klant…</option>
          {(klanten ?? [])
            .filter((k) => k.actief)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam}
              </option>
            ))}
        </select>
        <Link to="/facturen/klanten" className="w-fit text-sm text-muted underline">
          Klant toevoegen of aanpassen
        </Link>
      </label>

      <Veld
        label="Onderwerp"
        placeholder="Lunch 15 oktober"
        value={onderwerp}
        onChange={(e) => setOnderwerp(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Veld
          label="Leverdatum"
          type="date"
          value={leverdatum}
          onChange={(e) => setLeverdatum(e.target.value)}
        />
        <Veld
          label="of periode"
          placeholder="juli t/m september 2026"
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <Kopje>Regels</Kopje>
        <Prijslijst
          onKies={(r) => setRegels((v) => [...v, { ...r, volgorde: v.length }])}
        />
        {regels.map((r, i) => (
          <RegelKaart
            key={r.id ?? `nieuw-${r.volgorde}-${i}`}
            r={r}
            onWijzig={(nieuwe) => setRegels((v) => v.map((x, j) => (j === i ? nieuwe : x)))}
            onWeg={() => setRegels((v) => v.filter((_, j) => j !== i))}
            onOmhoog={i > 0 ? () => setRegels((v) => verwissel(v, i, i - 1)) : undefined}
            onOmlaag={
              i < regels.length - 1 ? () => setRegels((v) => verwissel(v, i, i + 1)) : undefined
            }
          />
        ))}
        <Knop
          soort="rustig"
          className="w-fit"
          onClick={() =>
            setRegels((v) => [
              ...v,
              {
                volgorde: v.length, product_id: null, omschrijving: '',
                aantal: 1, prijs_incl: 0, btw_tarief: 9,
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          Losse regel
        </Knop>
      </section>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Notitie op de factuur</span>
        <textarea
          className={`${invoer} min-h-20`}
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
        />
      </label>

      <Bedragen regels={regels} />

      {/* Versturen pas als er iets te versturen is: een opgeslagen concept met
          regels. Anders stuur je een lege factuur de deur uit. */}
      {!nieuw && factuur && regels.length > 0 && (
        <div className="border-t border-line pt-4">
          <Versturen
            factuur={factuur}
            klant={klanten?.find((k) => k.id === factuur.klant_id)}
            melden={toon}
            onKlaar={() => setVerstuurOpen(false)}
            key={verstuurOpen ? 'open' : 'dicht'}
          />
          <p className="mt-2 max-w-prose text-sm text-muted">
            Bewaar eerst je wijzigingen; wat hier verstuurd wordt is wat er is opgeslagen.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Knop soort="primair" bezig={opslaan.isPending} onClick={bewaar}>
          Opslaan als concept
        </Knop>
        {!nieuw && factuurId && (
          <Knop soort="rustig" bezig={pdfBezig} onClick={() => toonPdf(factuurId, 'concept')}>
            <FileText className="size-4" aria-hidden />
            Voorbeeld
          </Knop>
        )}
        {!nieuw && factuurId && (
          <Knop
            soort="gevaar"
            bezig={weg.isPending}
            onClick={() =>
              weg.mutate(factuurId, {
                onSuccess: () => navigeer('/facturen/uitgaand'),
                onError: (e) => toon(e instanceof Error ? e.message : 'Weggooien lukte niet.'),
              })
            }
          >
            <Trash2 className="size-4" aria-hidden />
            Weggooien
          </Knop>
        )}
      </div>

      {toast}
    </div>
  )
}
