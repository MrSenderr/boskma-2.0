/* Het bestelvoorstel per leverdag.
 *
 * De toetsen gaan over waar een voorstel stilletjes verkeerd kan uitpakken:
 * een losse levering die als leverdag gaat gelden, een aantal dat naar beneden
 * wordt afgerond zodat je op zaterdag zonder zit, en een lijst waarin twee
 * leveranciers door elkaar lopen. */

import { describe, expect, it } from 'vitest'
import {
  DAGNAAM,
  alsTekst,
  leverdagenVan,
  voorgesteldAantal,
  voorstelVoor,
  volgendeDatum,
  type Bestelregel,
} from './bestellen'

const r = (anders: Partial<Bestelregel>): Bestelregel =>
  ({
    dagnr: 2,
    leverdagen: 12,
    laatste_dag: '2026-10-20',
    leverancier_id: 1,
    leveranciernaam: 'Veldboer',
    artikelnr: '10234',
    naam: 'Uien blokjes vers',
    eenheid: 'bak',
    keer: 11,
    gemiddeld: 3.3,
    hoe_vaak_pct: 92,
    laatst_besteld: '2026-10-20',
    laatste_prijs: 4.5,
    ...anders,
  }) as Bestelregel

describe('op welke dagen wordt er geleverd', () => {
  /* In de gegevens staan losse aanvullingen: één woensdag, een paar zondagen.
     Die als leverdag aanbieden zou een voorstel opleveren dat op één levering
     rust. */
  it('laat dagen weg waarop zelden geleverd wordt', () => {
    const dagen = leverdagenVan([
      r({ dagnr: 2, leverdagen: 12 }),
      r({ dagnr: 4, leverdagen: 11 }),
      r({ dagnr: 3, leverdagen: 1 }),
      r({ dagnr: 7, leverdagen: 2 }),
    ])
    expect(dagen.map((d) => d.dagnr)).toEqual([2, 4])
  })

  it('zet de drukste dag vooraan en noemt hem bij naam', () => {
    const dagen = leverdagenVan([r({ dagnr: 4, leverdagen: 11 }), r({ dagnr: 2, leverdagen: 12 })])
    expect(dagen[0].naam).toBe('dinsdag')
    expect(DAGNAAM[4]).toBe('donderdag')
  })

  it('telt hoeveel artikelen er op die dag voorkomen', () => {
    const dagen = leverdagenVan([
      r({ dagnr: 2, artikelnr: 'a' }),
      r({ dagnr: 2, artikelnr: 'b' }),
      r({ dagnr: 2, artikelnr: 'c' }),
    ])
    expect(dagen[0].artikelen).toBe(3)
  })
})

describe('wat er in het voorstel komt', () => {
  const regels = [
    r({ artikelnr: 'a', naam: 'Uien', hoe_vaak_pct: 92 }),
    r({ artikelnr: 'b', naam: 'Komkommer', hoe_vaak_pct: 50 }),
    r({ artikelnr: 'c', naam: 'Cherrytomaten', hoe_vaak_pct: 49 }),
    r({ artikelnr: 'd', naam: 'Donderdagding', dagnr: 4, hoe_vaak_pct: 90 }),
  ]

  it('scheidt wat je bijna altijd bestelt van wat je soms bestelt', () => {
    const { vast, soms } = voorstelVoor(regels, 2)
    expect(vast.map((x) => x.naam)).toEqual(['Uien', 'Komkommer'])
    expect(soms.map((x) => x.naam)).toEqual(['Cherrytomaten'])
  })

  // Een donderdagartikel hoort niet in het dinsdagvoorstel.
  it('kijkt alleen naar de gekozen dag', () => {
    const { vast, soms } = voorstelVoor(regels, 2)
    expect([...vast, ...soms].some((x) => x.naam === 'Donderdagding')).toBe(false)
  })

  it('zet het vaakst bestelde bovenaan', () => {
    expect(voorstelVoor(regels, 2).vast[0].naam).toBe('Uien')
  })
})

describe('het voorgestelde aantal', () => {
  /* Naar boven afronden: te weinig betekent dat je het op zaterdag niet hebt,
     te veel dat het een week langer ligt. */
  it('rondt naar boven af op halven', () => {
    expect(voorgesteldAantal(3.3)).toBe(3.5)
    expect(voorgesteldAantal(3.6)).toBe(4)
    expect(voorgesteldAantal(14.6)).toBe(15)
    expect(voorgesteldAantal(2)).toBe(2)
  })

  // Nul bestellen heeft geen zin; dan hoort het er niet in te staan.
  it('gaat nooit onder één', () => {
    expect(voorgesteldAantal(0.2)).toBe(1)
    expect(voorgesteldAantal(0)).toBe(1)
    expect(voorgesteldAantal(null)).toBe(1)
  })
})

describe('de lijst om door te geven', () => {
  const keuzes = [
    { regel: r({ naam: 'Uien blokjes vers', artikelnr: '10234' }), aantal: 3.5 },
    {
      regel: r({ naam: 'Kroket', artikelnr: '30112', leveranciernaam: 'Het Grootslag' }),
      aantal: 2,
    },
    { regel: r({ naam: 'Komkommer', artikelnr: '20991' }), aantal: 4 },
  ]

  /* Je bestelt bij elke leverancier apart. Eén lijst door elkaar moet je dan
     alsnog uit elkaar trekken. */
  it('groepeert per leverancier', () => {
    const tekst = alsTekst(keuzes, 'dinsdag', '27 oktober')
    expect(tekst).toContain('Bestelling dinsdag 27 oktober')
    const grootslag = tekst.indexOf('Het Grootslag')
    const veldboer = tekst.indexOf('Veldboer')
    expect(grootslag).toBeGreaterThan(-1)
    expect(veldboer).toBeGreaterThan(grootslag)
    // Onder Veldboer staan de twee groenteregels, niet de kroket.
    expect(tekst.slice(veldboer)).toContain('Uien blokjes vers')
    expect(tekst.slice(veldboer)).not.toContain('Kroket')
  })

  it('schrijft aantallen met een komma en de eenheid erbij', () => {
    expect(alsTekst(keuzes, 'dinsdag')).toContain('- 3,5 bak Uien blokjes vers (10234)')
  })

  it('zet het artikelnummer erbij, zodat de leverancier het terugvindt', () => {
    expect(alsTekst(keuzes, 'dinsdag')).toContain('(30112)')
  })
})

describe('voor welke datum je bestelt', () => {
  // Een dinsdag gezien vanaf zondag 25 oktober 2026 is 27 oktober.
  it('neemt de eerstvolgende dag van die soort', () => {
    expect(volgendeDatum(2, new Date('2026-10-25T12:00:00'))).toBe('2026-10-27')
    expect(volgendeDatum(4, new Date('2026-10-25T12:00:00'))).toBe('2026-10-29')
  })

  /* Vandaag telt mee: bestel je dinsdagochtend voor diezelfde dag, dan is dat
     de dag die je bedoelt, niet die van volgende week. */
  it('rekent vandaag mee', () => {
    expect(volgendeDatum(2, new Date('2026-10-27T09:00:00'))).toBe('2026-10-27')
  })
})
