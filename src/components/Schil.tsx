import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Users, ClipboardCheck, Settings, Menu, X, LogOut, Sun, Moon, Monitor, Thermometer, UserCircle, FolderOpen, ListChecks, MonitorPlay, ChefHat, BookOpen, UtensilsCrossed, Wallet, ListOrdered } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../lib/auth'
import { huidigThema, zetThema, type Thema } from '../lib/thema'
import { useTestmodus } from '../lib/instellingen'
import { useModus, zetModus, type Modus } from '../lib/modus'
import { useWieBenIk } from '../lib/wie'
import { LIJSTEN } from '../lib/taken'
import { magIk, useMijnRechten } from '../lib/rechten'
import { TimerBalk } from './TimerBalk'

const MENU: { pad: string; label: string; icoon: typeof Users; exact: boolean; voor: Modus | 'beide' }[] = [
  // Vandaag bestaat voor allebei de gezichten, met een andere inhoud.
  { pad: '/', label: 'Vandaag', icoon: CalendarDays, exact: true, voor: 'beide' },
  { pad: '/personeel', label: 'Personeel', icoon: Users, exact: false, voor: 'beheer' },
  { pad: '/haccp', label: 'HACCP', icoon: ClipboardCheck, exact: false, voor: 'beheer' },
  { pad: '/mep', label: 'MEP', icoon: ChefHat, exact: false, voor: 'beide' },
  { pad: '/werkkaarten', label: 'Werkkaarten', icoon: UtensilsCrossed, exact: false, voor: 'beide' },
  { pad: '/recepten', label: 'Recepten', icoon: BookOpen, exact: false, voor: 'beide' },
  { pad: '/werkwijzen', label: 'Werkwijzen', icoon: ListOrdered, exact: false, voor: 'beide' },
  { pad: '/schermen', label: 'Schermen', icoon: MonitorPlay, exact: false, voor: 'beheer' },
  { pad: '/instellingen', label: 'Instellingen', icoon: Settings, exact: false, voor: 'beheer' },
  // Het medewerkersgezicht. Straks het enige dat je personeel te zien krijgt.
  { pad: '/temperaturen', label: 'Temperaturen', icoon: Thermometer, exact: false, voor: 'medewerker' },
  { pad: '/taken', label: 'Taken', icoon: ListChecks, exact: false, voor: 'medewerker' },
  { pad: '/mijn-gegevens', label: 'Mijn gegevens', icoon: UserCircle, exact: false, voor: 'medewerker' },
  { pad: '/mijn-dossier', label: 'Mijn dossier', icoon: FolderOpen, exact: false, voor: 'medewerker' },
]

/* Schermen die geen menu-item hebben maar wel een naam in de kop verdienen.
   Zonder dit staat er "Boskma" boven een levering, het frituurvet, een melding
   of een werklijst — en dan weet je niet waar je bent. */
const EXTRA_TITELS: { pad: string; label: string }[] = [
  // De kas hangt aan een recht en staat daarom niet in MENU; de kop moet hem
  // wél kennen.
  { pad: '/kas', label: 'Kas' },
  { pad: '/levering', label: 'Levering' },
  { pad: '/frituurvet', label: 'Frituurvet' },
  { pad: '/melden', label: 'Melden' },
  ...LIJSTEN.map((l) => ({ pad: `/lijst/${l.waarde}`, label: l.label })),
]

function ThemaKnop() {
  const [thema, setThemaState] = useState<Thema>(huidigThema)
  const volgende: Record<Thema, Thema> = { systeem: 'licht', licht: 'donker', donker: 'systeem' }
  const Icoon = thema === 'licht' ? Sun : thema === 'donker' ? Moon : Monitor
  const naam = thema === 'licht' ? 'Licht' : thema === 'donker' ? 'Donker' : 'Volgt je toestel'

  return (
    <button
      type="button"
      onClick={() => {
        const nieuw = volgende[thema]
        zetThema(nieuw)
        setThemaState(nieuw)
      }}
      title={`Weergave: ${naam}`}
      aria-label={`Weergave: ${naam}. Klik om te wisselen.`}
      className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icoon className="size-5" aria-hidden />
    </button>
  )
}

function ModusSchakelaar({ modus, zet }: { modus: Modus; zet: (m: Modus) => void }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-white/10 p-3">
      <span className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#F0EBD5]/45">
        Je werkt als
      </span>
      <div className="flex gap-1 rounded-[4px] bg-black/25 p-1">
        {(['beheer', 'medewerker'] as Modus[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => zet(m)}
            aria-pressed={modus === m}
            className={`min-h-11 flex-1 rounded-[3px] px-2 text-sm font-semibold transition-colors ${
              modus === m
                ? 'bg-[#F0EBD5] text-[#003A41]'
                : 'text-[#F0EBD5]/65 hover:bg-white/5'
            }`}
          >
            {m === 'beheer' ? 'Beheer' : 'Medewerker'}
          </button>
        ))}
      </div>
    </div>
  )
}

function TestBalk() {
  const { data } = useTestmodus()
  if (!data?.aan) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-warn px-4 py-2 text-sm font-semibold text-[#00272C]">
      <span>Testmodus staat aan.</span>
      <span className="font-normal">
        Uitgaande mail gaat naar {data.adres} — niet naar medewerkers of het loonbureau.
      </span>
    </div>
  )
}

export function Schil() {
  const [open, setOpen] = useState(false)
  const { email, uitloggen } = useAuth()
  const [modus, zetModusState] = useModus()
  const { data: wie } = useWieBenIk()
  const { data: rechten } = useMijnRechten()
  const locatie = useLocation()

  // Een medewerker komt nooit in het beheergezicht, ook niet via de schakelaar.
  // De echte grens ligt in de database; dit is alleen het scherm.
  const isBeheerder = wie?.rol === 'beheerder'
  const gezicht: Modus = isBeheerder ? modus : 'medewerker'
  const zichtbaar = MENU.filter((m) => m.voor === gezicht || m.voor === 'beide')
  // De kas hangt aan een eigen recht en staat dus niet in de vaste menulijst:
  // wie het niet mag, hoort de knop niet te zien staan.
  const magKassen = magIk(rechten, 'kas')

  useEffect(() => {
    if (wie && !isBeheerder && modus !== 'medewerker') zetModus('medewerker')
  }, [wie, isBeheerder, modus])
  const titel =
    MENU.find((m) => (m.exact ? m.pad === locatie.pathname : locatie.pathname.startsWith(m.pad)))?.label ??
    EXTRA_TITELS.find((t) => locatie.pathname.startsWith(t.pad))?.label ??
    'Boskma'

  return (
    <div className="flex min-h-dvh">
      {open && (
        <button
          type="button"
          aria-label="Menu sluiten"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#003A41] text-[#F0EBD5] transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Logo className="w-11 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm">Boskma Foodservice</p>
            <p className="truncate text-xs text-[#F0EBD5]/60">Snackerie 't Zonnetje</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {[
            ...zichtbaar,
            ...(magKassen
              ? [{ pad: '/kas', label: 'Kas', icoon: Wallet, exact: false, voor: gezicht }]
              : []),
          ].map(({ pad, label, icoon: Icoon, exact }) => (
            <NavLink
              key={pad}
              to={pad}
              end={exact}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/10 font-semibold' : 'text-[#F0EBD5]/70 hover:bg-white/5'
                }`
              }
            >
              <Icoon className="size-5 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        {isBeheerder && <ModusSchakelaar modus={modus} zet={zetModusState} />}

        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 pb-2 text-xs text-[#F0EBD5]/50">{wie?.naam || email}</p>
          <button
            type="button"
            onClick={uitloggen}
            className="flex w-full items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm text-[#F0EBD5]/70 hover:bg-white/5"
          >
            <LogOut className="size-5 shrink-0" aria-hidden />
            Uitloggen
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Menu sluiten' : 'Menu openen'}
            className="flex size-11 items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
          <h1 className="flex-1 font-display text-lg">{titel}</h1>
          <ThemaKnop />
        </header>

        {/* Alleen voor jou. Een medewerker heeft niets aan "testmodus staat aan"
            en mag de instelling niet eens lezen — die valt terug op de veilige
            aanname en zag daardoor de balk. In medewerkersweergave blijft hij
            ook weg, anders klopt je voorbeeld niet met wat zij zien. */}
        {isBeheerder && gezicht === 'beheer' && <TestBalk />}

        <TimerBalk />

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
