import { NavLink, Outlet } from 'react-router-dom'
import { Kopje } from '../components/ui'

/* Facturen: wat binnenkomt en wat de deur uit gaat. Dezelfde opbouw als
   Rooster, zodat de tabbladen overal hetzelfde werken. */

const TABS = [
  { pad: 'inkomend', label: 'Inkomend' },
  { pad: 'uitgaand', label: 'Uitgaand' },
]

export function Facturen() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Kopje>Facturen</Kopje>
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <NavLink
              key={t.pad}
              to={t.pad}
              data-touch
              className={({ isActive }) =>
                `rounded-[4px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand text-on-brand'
                    : 'border border-line-strong text-text hover:bg-surface-2'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
