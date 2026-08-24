import { NavLink, Outlet } from 'react-router-dom'
import { Kopje } from '../components/ui'
import { magIk, useMijnRechten } from '../lib/rechten'
import { useRooster, vandaagStr, volgendeOpendag } from '../lib/openingstijden'

/* Mise en place. Zie docs/Modules/mep.md. */

export function Mep() {
  const { data: rechten } = useMijnRechten()
  const { data: rooster } = useRooster()
  const volgende = volgendeOpendag(rooster, vandaagStr())
  const dagnaam = new Date(volgende + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long' })

  const tabs = [
    { pad: 'vandaag', label: 'Vandaag' },
    { pad: 'klaarzetten', label: `Voor ${dagnaam}` },
    ...(magIk(rechten, 'mep') ? [{ pad: 'lijst', label: 'MEP-taken' }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Kopje>Mise en place</Kopje>
        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <NavLink
              key={t.pad}
              to={t.pad}
              data-touch
              className={({ isActive }) =>
                `rounded-[4px] px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
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
