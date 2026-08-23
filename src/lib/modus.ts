import { useEffect, useState } from 'react'

/* Beheer of medewerker. Zie docs/modules/haccp/haccpmodule.md — één app, twee
   gezichten.

   Dit is een schakelaar voor het scherm, geen afscherming. Een medewerker komt
   straks sowieso alleen in het medewerkersgezicht omdat zijn rol dat bepaalt;
   deze schakelaar is er zodat Sander kan zien wat zij zien. De echte grens ligt
   in de database. */

export type Modus = 'beheer' | 'medewerker'

const SLEUTEL = 'boskma-modus'

export function huidigeModus(): Modus {
  return localStorage.getItem(SLEUTEL) === 'medewerker' ? 'medewerker' : 'beheer'
}

/** Zodat elk scherm meteen meebeweegt als de modus wisselt. */
const luisteraars = new Set<(m: Modus) => void>()

export function zetModus(m: Modus) {
  if (m === 'beheer') localStorage.removeItem(SLEUTEL)
  else localStorage.setItem(SLEUTEL, m)
  luisteraars.forEach((f) => f(m))
}

export function useModus(): [Modus, (m: Modus) => void] {
  const [modus, setState] = useState<Modus>(huidigeModus)
  useEffect(() => {
    luisteraars.add(setState)
    return () => {
      luisteraars.delete(setState)
    }
  }, [])
  return [modus, zetModus]
}
