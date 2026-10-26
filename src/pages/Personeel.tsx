import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, UserPlus, Users } from 'lucide-react'
import { Kaart, Knop, Kopje, Laden, Mislukt, Pil, Veld } from '../components/ui'
import { Breed, useBreedScherm } from '../lib/breedte'
import { useContractwaker, wanneer, type Signaal } from '../lib/contractwaker'
import { useContractStanden } from '../lib/getekendContract'
import { vandaagIso } from '../lib/datums'
import { KETEN_MAX_CONTRACTEN, useHuidigeContracten, type HuidigContract } from '../lib/contracten'
import {
  inArchief,
  naamVan,
  sinds,
  toestandVan,
  usePersonen,
  usePersoonToevoegen,
  type Fase,
  type Persoon,
} from '../lib/personeel'
import { geledenTekst, useAppBezoek } from '../lib/bezoek'

/* Iemand met de hand toevoegen: voor wie niet via werkenbij binnenkomt maar
   bijvoorbeeld gewoon aan de deur staat. Zie
   docs/modules/personeel/personeelsmodule.md. */
function Toevoegen({ sluit }: { sluit: () => void }) {
  const navigeer = useNavigate()
  const toevoegen = usePersoonToevoegen()
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email, setEmail] = useState('')
  const [fase, setFase] = useState<Fase>('medewerker')
  const [fout, setFout] = useState<string | null>(null)

  async function bewaren(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    if (!voornaam.trim() || !achternaam.trim()) {
      setFout('Vul een voor- en achternaam in.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setFout('Vul een geldig mailadres in. Daarmee logt hij later in.')
      return
    }
    try {
      const id = await toevoegen.mutateAsync({ voornaam, achternaam, email, fase })
      navigeer(`/personeel/${id}`)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Toevoegen lukte niet.')
    }
  }

  const keuze = (waarde: Fase, label: string, uitleg: string) => (
    <button
      key={waarde}
      type="button"
      onClick={() => setFase(waarde)}
      aria-pressed={fase === waarde}
      className={`flex-1 rounded-[4px] border-[1.5px] px-3 py-2.5 text-left transition-colors ${
        fase === waarde ? 'border-accent bg-surface-2' : 'border-line-strong hover:bg-surface-2'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-sm text-muted">{uitleg}</span>
    </button>
  )

  return (
    <Kaart className="p-5">
      <form onSubmit={bewaren} className="flex flex-col gap-4">
        <Kopje>Iemand toevoegen</Kopje>

        <div className="grid gap-4 sm:grid-cols-2">
          <Veld
            label="Voornaam"
            value={voornaam}
            autoFocus
            onChange={(e) => setVoornaam(e.target.value)}
          />
          <Veld
            label="Achternaam"
            value={achternaam}
            onChange={(e) => setAchternaam(e.target.value)}
          />
        </div>

        <Veld
          label="Mailadres"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Waar zet ik hem neer?</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            {keuze('medewerker', 'Medewerker', 'Aangenomen, invullink moet nog weg')}
            {keuze('sollicitant', 'Sollicitant', 'Eerst nog een gesprek')}
          </div>
        </div>

        {fout && <p className="text-sm text-bad">{fout}</p>}

        <p className="text-sm text-muted">
          Meer hoef je niet te weten. De rest — adres, rekeningnummer, BSN — vult
          hij zelf in via de invullink, die je hierna op zijn kaart verstuurt.
        </p>

        <div className="flex flex-wrap gap-2">
          <Knop soort="primair" type="submit" bezig={toevoegen.isPending}>
            Toevoegen
          </Knop>
          <Knop soort="rustig" type="button" onClick={sluit}>
            Annuleren
          </Knop>
        </div>
      </form>
    </Kaart>
  )
}

/* Hoe lang een contract nog loopt, in één regel. Alleen bij een contract voor
   bepaalde tijd dat nog loopt: bij onbepaalde tijd valt er niets af te tellen,
   en bij een afgelopen contract zegt het seintje het al. */
function contracttekst(c: HuidigContract | undefined, nummer?: number): string | null {
  if (!c || !c.loopt || c.duur !== 'bepaalde' || !c.eindigt) return null
  const tot = new Date(`${c.eindigt}T12:00:00`).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return nummer
    ? `tot ${tot} · contract ${nummer} van ${KETEN_MAX_CONTRACTEN}`
    : `tot ${tot}`
}

/* Eén regel in de lijst.
 *
 * Sinds 25 oktober 2026 staat hier ook wát er met iemand moet gebeuren. Dat
 * rekende de contractwaker al uit, maar het stond alleen op het startscherm —
 * en dan moet je elke kaart openklikken om te zien of er iets speelt.
 *
 * Speelt er niets, dan staat er niets. Lege ruimte zegt dan: hier hoef je
 * niets. Wie wel aandacht vraagt springt eruit juist omdat de rest stil is. */
function Regel({
  p,
  inDeApp,
  signaal,
  contract,
}: {
  p: Persoon
  inDeApp?: string
  signaal?: Signaal
  contract?: HuidigContract
}) {
  const toestand = toestandVan(p)
  const contractregel = signaal ? contracttekst(contract, signaal.ketenNummer) : null

  return (
    <Link
      to={`/personeel/${p.id}`}
      data-touch
      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{naamVan(p)}</span>
        {/* Twee regels mag: wat er moet gebeuren halverwege afkappen maakt het
            onleesbaar, en dat is juist de regel waar het om gaat. */}
        {signaal && (
          <span
            className={`block text-sm ${
              signaal.ernst === 'fout'
                ? 'text-bad'
                : signaal.ernst === 'neutraal'
                  ? 'text-muted'
                  : 'text-warn'
            }`}
          >
            {signaal.wat}
          </span>
        )}
        {contractregel && (
          <span className="block truncate text-xs text-muted">{contractregel}</span>
        )}
        {/* Alleen bij medewerkers: een sollicitant hoort nog niet in de app. */}
        {p.fase === 'medewerker' && (
          <span className="block text-xs text-muted">in de app: {geledenTekst(inDeApp)}</span>
        )}
      </span>
      {signaal ? (
        <Pil soort={signaal.ernst}>
          {signaal.pil ?? wanneer(signaal.dagen, signaal.uiterlijk)}
        </Pil>
      ) : (
        <Pil soort={toestand.soort}>{toestand.label}</Pil>
      )}
      <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-muted sm:block">
        {sinds(p.aangemeld_op)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
    </Link>
  )
}

/* Een lijst in twee kolommen als het scherm er ruimte voor heeft.
 *
 * Kolomsgewijs geknipt, niet om en om: de eerste helft links, de tweede
 * rechts. Dan lees je alfabetisch van boven naar beneden, zoals in een
 * telefoonboek. Om en om zou je oog bij elke naam moeten overspringen.
 *
 * Onder de vier namen gebeurt er niets: twee kolommen van twee regels is geen
 * overzicht maar versnippering. */
function Kolommen({
  mensen,
  inDeApp,
  signalen,
  contracten,
}: {
  mensen: Persoon[]
  inDeApp?: Map<string, string>
  signalen?: Map<string, Signaal>
  contracten?: Map<string, HuidigContract>
}) {
  const breed = useBreedScherm()
  const tweeKolommen = breed && mensen.length >= 4
  const helft = Math.ceil(mensen.length / 2)
  const delen = tweeKolommen ? [mensen.slice(0, helft), mensen.slice(helft)] : [mensen]

  return (
    /* Eén kolom blijft beperkt in breedte: een naam links en een pil helemaal
       rechts op een breed scherm laat je oog te ver reizen. Op een telefoon
       doet deze grens niets, daar is het scherm toch smaller. */
    <div className={tweeKolommen ? 'grid grid-cols-2 gap-4' : 'max-w-3xl'}>
      {delen.map((deel, i) => (
        <Kaart key={i}>
          {deel.map((p) => (
            <Regel
              key={p.id}
              p={p}
              inDeApp={inDeApp?.get(p.id)}
              signaal={signalen?.get(p.id)}
              contract={contracten?.get(p.id)}
            />
          ))}
        </Kaart>
      ))}
    </div>
  )
}

function Groep({
  titel,
  aantal,
  mensen,
  leeg,
  inDeApp,
  signalen,
  contracten,
}: {
  titel: string
  aantal: number
  mensen: Persoon[]
  leeg: string
  inDeApp?: Map<string, string>
  signalen?: Map<string, Signaal>
  contracten?: Map<string, HuidigContract>
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <Kopje>{titel}</Kopje>
        <span className="text-sm tabular-nums text-muted">{aantal}</span>
      </div>
      {mensen.length === 0 ? (
        <Kaart className="p-6 text-sm text-muted">{leeg}</Kaart>
      ) : (
        <Kolommen
          mensen={mensen}
          inDeApp={inDeApp}
          signalen={signalen}
          contracten={contracten}
        />
      )}
    </section>
  )
}

export function Personeel() {
  const { data, isPending, error, refetch } = usePersonen()
  const bezoek = useAppBezoek()
  const waker = useContractwaker()
  const standen = useContractStanden()
  const { data: contracten } = useHuidigeContracten()
  const [toonArchief, setToonArchief] = useState(false)
  const [toevoegen, setToevoegen] = useState(false)

  if (isPending) return <Laden tekst="Personeel laden…" />
  if (error) return <Mislukt tekst={error.message} opnieuw={() => refetch()} />

  const lopend = data.filter((p) => !inArchief(p))
  const sollicitanten = lopend.filter((p) => p.fase === 'sollicitant')
  const medewerkers = lopend.filter((p) => p.fase === 'medewerker')
  const archief = data.filter(inArchief)
  const inDeApp = new Map((bezoek.data ?? []).map((b) => [b.persoon_id, b.laatst_gezien]))

  /* Het dringendste seintje per persoon. De waker levert ze al op volgorde van
     dringendheid, dus de eerste die je tegenkomt is de juiste. */
  const dringendste = new Map<string, Signaal>()
  for (const s of waker.data ?? []) {
    if (!dringendste.has(s.persoonId)) dringendste.set(s.persoonId, s)
  }

  /* Een getekend contract dat nog in het dossier ligt hoort hier ook te staan.
     Dat komt niet van de waker maar uit de documenten; alleen als er voor die
     persoon nog niets dringenders is, want één regel per naam. */
  for (const c of standen.data ?? []) {
    if (dringendste.has(c.persoonId) || c.stand === 'in_orde') continue
    if (c.stand === 'versturen') {
      dringendste.set(c.persoonId, {
        persoonId: c.persoonId,
        naam: c.naam,
        soort: 'naar_loonbureau',
        wat: c.verwacht
          ? 'Getekend contract nog niet naar het loonbureau'
          : 'Getekend contract ligt in het dossier — nog niet verstuurd',
        uiterlijk: vandaagIso(),
        dagen: 0,
        ernst: c.verwacht ? 'fout' : 'letop',
        pil: 'te versturen',
      })
      continue
    }
    /* Er is helemaal geen getekend contract. Dat stond tot nu toe alleen op het
       startscherm, opgevouwen onder een telling; wie hier langs de namen loopt
       zag het niet. Wacht het loonbureau erop ('uploaden'), dan is er iets
       binnengekomen dat je nog moet klaarzetten; anders is er simpelweg nooit
       iets getekend. In beide gevallen geel: het is iets dat moet gebeuren,
       maar er staat geen dag op. */
    dringendste.set(c.persoonId, {
      persoonId: c.persoonId,
      naam: c.naam,
      soort: 'geen_getekend',
      wat:
        c.stand === 'uploaden'
          ? 'Het loonbureau stelde het contract op — nog niets getekend in de app'
          : 'Geen getekend contract in het dossier',
      uiterlijk: vandaagIso(),
      dagen: 0,
      ernst: 'letop',
      pil: 'te tekenen',
    })
  }
  const gebruiken = medewerkers.filter((p) => inDeApp.has(p.id)).length

  return (
    <div className="flex flex-col gap-8">
      {/* Twee kolommen in de lijsten; die hebben ruimte nodig. */}
      <Breed />
      {toevoegen ? (
        <Toevoegen sluit={() => setToevoegen(false)} />
      ) : (
        <div>
          <Knop soort="rustig" onClick={() => setToevoegen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Iemand toevoegen
          </Knop>
        </div>
      )}

      <Groep
        titel="Sollicitanten"
        aantal={sollicitanten.length}
        mensen={sollicitanten}
        leeg="Geen openstaande sollicitaties."
      />

      <Groep
        titel="Medewerkers"
        aantal={medewerkers.length}
        mensen={medewerkers}
        leeg="Nog geen medewerkers. Neem een sollicitant aan, of voeg iemand toe."
        inDeApp={inDeApp}
        signalen={dringendste}
        contracten={contracten}
      />

      {medewerkers.length > 0 && (
        <p className="-mt-6 text-sm text-muted">
          {gebruiken === 0
            ? 'Nog niemand heeft de app opengedaan sinds het bijhouden aanstaat.'
            : `${gebruiken} van de ${medewerkers.length} medewerkers ${
                gebruiken === 1 ? 'heeft' : 'hebben'
              } de app opengedaan sinds het bijhouden aanstaat.`}
        </p>
      )}

      {archief.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setToonArchief((v) => !v)}
            className="flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-text"
          >
            <Users className="size-4" aria-hidden />
            Archief ({archief.length})
            <span aria-hidden>{toonArchief ? '▾' : '▸'}</span>
          </button>
          {toonArchief && <Kolommen mensen={archief} inDeApp={inDeApp} />}
        </section>
      )}
    </div>
  )
}
