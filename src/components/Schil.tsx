import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Users, ClipboardCheck, Settings, Menu, X, LogOut, Sun, Moon, Monitor } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../lib/auth'
import { huidigThema, zetThema, type Thema } from '../lib/thema'

const MENU = [
  { pad: '/', label: 'Vandaag', icoon: CalendarDays, exact: true },
  { pad: '/personeel', label: 'Personeel', icoon: Users, exact: false },
  { pad: '/haccp', label: 'HACCP', icoon: ClipboardCheck, exact: false },
  { pad: '/instellingen', label: 'Instellingen', icoon: Settings, exact: false },
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

export function Schil() {
  const [open, setOpen] = useState(false)
  const { email, uitloggen } = useAuth()
  const locatie = useLocation()
  const titel = MENU.find((m) => (m.exact ? m.pad === locatie.pathname : locatie.pathname.startsWith(m.pad)))?.label ?? 'Boskma'

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
          {MENU.map(({ pad, label, icoon: Icoon, exact }) => (
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

        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 pb-2 text-xs text-[#F0EBD5]/50">{email}</p>
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

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
