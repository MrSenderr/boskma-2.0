export type Thema = 'systeem' | 'licht' | 'donker'

const SLEUTEL = 'boskma-thema'

export function huidigThema(): Thema {
  const opgeslagen = localStorage.getItem(SLEUTEL)
  return opgeslagen === 'licht' || opgeslagen === 'donker' ? opgeslagen : 'systeem'
}

export function zetThema(thema: Thema) {
  if (thema === 'systeem') {
    localStorage.removeItem(SLEUTEL)
    document.documentElement.removeAttribute('data-theme')
  } else {
    localStorage.setItem(SLEUTEL, thema)
    document.documentElement.setAttribute('data-theme', thema === 'donker' ? 'dark' : 'light')
  }
}

/** Bij het opstarten aanroepen, vóór React tekent, zodat er niets flikkert. */
export function herstelThema() {
  zetThema(huidigThema())
}
