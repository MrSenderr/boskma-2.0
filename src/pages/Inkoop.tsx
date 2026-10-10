import { NavLink, Outlet } from 'react-router-dom'
import { Kopje } from '../components/ui'

/* Inkoop: wat de groothandel je in rekening bracht, en wat dat met je prijzen
   doet. Dezelfde opbouw als Facturen en Rooster, zodat de tabbladen overal
   hetzelfde werken. */

const TABS = [
  { pad: 'documenten', label: 'Facturen' },
  { pad: 'prijzen', label: 'Prijsmutaties' },
  { pad: 'stuksprijzen', label: 'Stuksprijzen' },
  { pad: 'producten', label: 'Producten' },
  { pad: 'uploaden', label: 'Toevoegen' },
  { pad: 'instellingen', label: 'Instellingen' },
]

export function Inkoop() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Kopje>Inkoop</Kopje>
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
