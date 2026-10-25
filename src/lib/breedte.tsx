import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

/* Hoe breed het werkblad mag zijn.
 *
 * De app staat standaard op 64rem. Dat is prettig voor een pagina met lopende
 * tekst: een regel die over de volle breedte van een groot scherm loopt leest
 * slecht, want je oog raakt het begin van de volgende regel kwijt.
 *
 * Maar een pagina met twee kolommen heeft juist ruimte nodig; twee kolommen in
 * 64rem worden twee smalle stroken. Zo'n pagina zegt dat zelf met <Breed/>.
 *
 * Waarom een context en geen vaste breedte per route: de breedte hoort bij wat
 * een pagina laat zien, niet bij zijn adres. Staat het in de schil, dan moet
 * iemand die een pagina verbouwt op twee plekken zijn.
 *
 * useLayoutEffect en niet useEffect: die draait vóór het schilderen, dus je
 * ziet de pagina niet eerst smal en dan breed worden.
 */

const SMAL = '64rem'
const BREED = '80rem'

type Stand = { breedte: string; zetBreed: (aan: boolean) => void }

const Context = createContext<Stand>({ breedte: SMAL, zetBreed: () => {} })

export function BreedteProvider({ children }: { children: ReactNode }) {
  const [breed, setBreed] = useState(false)
  return (
    <Context.Provider value={{ breedte: breed ? BREED : SMAL, zetBreed: setBreed }}>
      {children}
    </Context.Provider>
  )
}

export function useBreedte() {
  return useContext(Context).breedte
}

/** Zet op een pagina die ruimte nodig heeft. Ruimt zichzelf op bij weggaan. */
export function Breed() {
  const { zetBreed } = useContext(Context)
  useLayoutEffect(() => {
    zetBreed(true)
    return () => zetBreed(false)
  }, [zetBreed])
  return null
}

/* Of het scherm breed genoeg is voor twee kolommen.
 *
 * Meestal regel je dat met een CSS-klasse en hoeft de code er niets van te
 * weten. Maar een lijst in twee kolommen moet in tweeën worden geknipt, en dat
 * is rekenwerk: welke namen links staan en welke rechts. Dat kan CSS niet, dus
 * moet de code het weten.
 *
 * De grens is dezelfde als Tailwinds xl. Staat hij op twee plekken, dan lopen
 * ze een keer uit elkaar; daarom hier als constante. */
export const TWEE_KOLOMMEN = '(min-width: 1280px)'

export function useBreedScherm(vraag = TWEE_KOLOMMEN): boolean {
  const [breed, setBreed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(vraag).matches,
  )
  useLayoutEffect(() => {
    const mq = window.matchMedia?.(vraag)
    if (!mq) return
    const luister = () => setBreed(mq.matches)
    luister()
    mq.addEventListener('change', luister)
    return () => mq.removeEventListener('change', luister)
  }, [vraag])
  return Boolean(breed)
}
