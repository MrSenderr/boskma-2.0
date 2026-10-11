/* De app op je beginscherm zetten.

   Dan opent hij zonder adresbalk, staat hij tussen je andere apps en kun je
   meldingen krijgen. Het is geen echte installatie uit een appwinkel; de
   browser maakt er een snelkoppeling van die zich als app gedraagt.

   Elke telefoon doet dat anders, en dat is precies het probleem: op een iPhone
   zit het achter de deelknop, op Android achter het menu, en Chrome op Android
   kan het ook zelf aanbieden. Vandaar dat hier eerst wordt uitgezocht waar
   iemand zit. */

export type Toestel = 'ios' | 'android' | 'anders'

export function soortToestel(ua = navigator.userAgent): Toestel {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPads melden zich sinds iPadOS als Mac; het aanraakscherm verraadt ze.
  if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    return 'ios'
  }
  if (/android/i.test(ua)) return 'android'
  return 'anders'
}

/** Draait de app al vanaf het beginscherm? Dan valt er niets uit te leggen. */
export function alGeinstalleerd(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    // Safari op iOS kent display-mode niet en heeft zijn eigen vlaggetje.
    return (window.navigator as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/* Weggeklikt is per toestel, niet per persoon: het gaat om déze telefoon, en
   op een tweede toestel moet de uitleg gewoon weer komen. */
const SLEUTEL = 'boskma-telefoonuitleg'

export function isWeggeklikt(): boolean {
  try {
    return window.localStorage.getItem(SLEUTEL) === 'weg'
  } catch {
    return false
  }
}

export function klikWeg() {
  try {
    window.localStorage.setItem(SLEUTEL, 'weg')
  } catch {
    /* privévenster; dan komt hij de volgende keer nog een keer */
  }
}

export type Stap = string

/** De stappen voor dit toestel. Leeg betekent: hier valt het niet uit te leggen. */
export function stappenVoor(toestel: Toestel): Stap[] {
  if (toestel === 'ios') {
    return [
      'Tik onderin op het deelknopje — het vierkantje met het pijltje omhoog.',
      'Veeg omlaag en tik op "Zet op beginscherm".',
      'Tik rechtsboven op "Voeg toe".',
    ]
  }
  if (toestel === 'android') {
    return [
      'Tik rechtsboven op de drie puntjes.',
      'Tik op "App installeren" of "Toevoegen aan startscherm".',
      'Bevestig met "Installeren".',
    ]
  }
  return []
}
