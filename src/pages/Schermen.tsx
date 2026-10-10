import { Outlet, useLocation } from 'react-router-dom'
import { Kopje } from '../components/ui'
import { titelVoor } from '../lib/menu'

/* De onderdelen van deze module staan in het linkermenu, niet meer als
   tabbladen hierboven. Dit scherm zegt alleen nog waar je bent — en haalt die
   naam uit hetzelfde menu, zodat de kop en het menu nooit uit elkaar lopen. */

export function Schermen() {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col gap-6">
      <Kopje>{titelVoor(pathname)}</Kopje>
      <Outlet />
    </div>
  )
}
