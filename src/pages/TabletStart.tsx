import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { isTabletSoort, zetTablet, type Tablet } from '../lib/tabletmodus'

/* /keuken en /zaak zetten de tabletmodus aan en sturen door naar het
   startscherm. Vanaf dan blijft de app in die stand tot je hem uitzet — ook als
   je naar een recept doorklikt. Zie docs/Modules/tablets.md. */

export function TabletStart({ soort }: { soort: Tablet }) {
  useEffect(() => {
    zetTablet(soort)
  }, [soort])

  return <Navigate to="/" replace />
}

/** Ook /tablet/keuken werkt, voor als je het zo intypt. */
export function TabletStartUitPad() {
  const { soort } = useParams()
  const geldig: Tablet | null = isTabletSoort(soort) ? soort : null
  useEffect(() => {
    if (geldig) zetTablet(geldig)
  }, [geldig])
  return <Navigate to="/" replace />
}
