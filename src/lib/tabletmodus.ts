/* Tabletmodus via het adres. Zie docs/Modules/tablets.md.

   Eerder leidde de app dit af uit het ingelogde account. Dat moest door drie
   lagen kloppen — database, API-cache, app — en liep steeds ergens anders vast.
   Nu bepaalt het adres het: je opent /keuken of /zaak, en de tablet staat goed.
   Eén ding om te controleren als er iets niet klopt, en te testen op elke
   telefoon met welk account dan ook. */

export type Tablet = 'algemeen' | 'keuken' | 'zaak'

const SLEUTEL = 'boskma.tablet'

const SOORTEN: Tablet[] = ['algemeen', 'keuken', 'zaak']

export function isTabletSoort(w: unknown): w is Tablet {
  return typeof w === 'string' && (SOORTEN as string[]).includes(w)
}

export function huidigeTablet(): Tablet | null {
  const w = localStorage.getItem(SLEUTEL)
  return isTabletSoort(w) ? w : null
}

export function zetTablet(soort: Tablet) {
  localStorage.setItem(SLEUTEL, soort)
}

export function stopTablet() {
  localStorage.removeItem(SLEUTEL)
}

/** Wat er op welke tablet in het menu staat. Kort houden: een tablet doet één
 *  ding, en hoe minder er staat hoe sneller je vindt wat je zoekt. */
export const TABLETMENU: Record<Tablet, { naam: string; paden: string[] }> = {
  // De tablet in de zaak die iedereen gebruikt: alles wat een medewerker doet.
  algemeen: {
    naam: 'Zaak',
    paden: [
      '/',
      '/temperaturen',
      '/taken',
      '/mep',
      '/werkkaarten',
      '/recepten',
      '/werkwijzen',
      '/melden',
      '/levering',
      '/frituurvet',
    ],
  },
  keuken: {
    naam: 'Keuken',
    paden: ['/', '/mep', '/werkkaarten', '/recepten', '/werkwijzen'],
  },
  zaak: {
    naam: 'Zaak',
    paden: ['/', '/temperaturen', '/taken', '/melden', '/levering', '/frituurvet'],
  },
}
