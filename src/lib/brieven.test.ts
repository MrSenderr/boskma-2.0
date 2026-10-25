/* De brief bij een contractvoorstel.
 *
 * Deze toetsen bewaken geen rekenwerk maar beloften. Wat hier staat is wat een
 * medewerker leest op het moment dat hij ja of nee zegt, en wat bij een geschil
 * als bewijsstuk op tafel komt. Een zin die er stilletjes uit valt — dat hij
 * mag weigeren, of dat het gemiddelde geen heel jaar beslaat — merkt niemand
 * tot het misgaat. */

import { describe, expect, it } from 'vitest'
import { alsTekst, brieftekst, urenzin, type Brief } from './brieven'
import type { Contract } from './contracten'
import type { Voorstel } from './contractvoorstellen'

const huidig = {
  id: 'c1',
  begint: '2026-01-01',
  eindigt: '2026-12-31',
  soort: 'nuluren',
  duur: 'bepaalde',
} as Contract

const v = (anders: Partial<Voorstel> = {}): Partial<Voorstel> => ({
  aard: 'verlengen',
  soort: 'nuluren',
  duur: 'bepaalde',
  begint: '2027-01-01',
  eindigt: '2027-12-31',
  uurloon: 8.25,
  functie: 'Medewerker fastservice II',
  uiterlijk: '2026-11-30',
  ...anders,
})

const tekst = (b: Brief) => alsTekst(b).toLowerCase()

describe('verlengen', () => {
  const brief = brieftekst({ voorstel: v(), voornaam: 'Thijmen', huidig })
  const t = tekst(brief)

  it('noemt de medewerker bij zijn naam', () => {
    expect(brief.aanhef).toBe('Hoi Thijmen,')
  })

  it('zegt wanneer het huidige contract afloopt en wat er wordt aangeboden', () => {
    expect(t).toContain('loopt af op 31 december 2026')
    expect(t).toContain('van 1 januari 2027 tot en met 31 december 2027')
    expect(t).toContain('€ 8,25 bruto per uur')
  })

  it('zegt vóór welke datum het antwoord binnen moet zijn', () => {
    expect(t).toContain('vóór 30 november 2026')
  })

  /* Nee zeggen moet een echte optie zijn, en wat er dan gebeurt moet erbij
     staan. Anders voelt een voorstel als een mededeling. */
  it('zegt wat er gebeurt als hij nee zegt', () => {
    expect(t).toContain('zeg je nee')
    expect(t).toContain('loopt je contract gewoon af')
  })

  it('schrijft bij onbepaalde tijd geen einddatum op', () => {
    const b = brieftekst({
      voorstel: v({ duur: 'onbepaalde', eindigt: null }),
      voornaam: 'Thijmen',
      huidig,
    })
    expect(tekst(b)).toContain('onbepaalde tijd, vanaf 1 januari 2027')
    expect(tekst(b)).toContain('geen einddatum meer')
  })
})

describe('niet verlengen', () => {
  const brief = brieftekst({ voorstel: v({ aard: 'stoppen' }), voornaam: 'Thijmen', huidig })
  const t = tekst(brief)

  /* Dit is een aanzegging (art. 7:668 BW). Dát het niet doorgaat en wannéér het
     afloopt horen vooraan te staan, niet verstopt achter een inleiding. */
  it('zegt in de eerste zinnen dat het niet doorgaat en wanneer', () => {
    expect(brief.blokken[0]).toMatchObject({ soort: 'alinea' })
    expect(t.split('\n')[2]).toContain('niet verlengd')
    expect(t).toContain('loopt af op 31 december 2026')
    expect(t).toContain('laatste werkdag')
  })

  it('vertelt wat er daarna gebeurt met het loon', () => {
    expect(t).toContain('eindafrekening')
    expect(t).toContain('vakantiedagen')
  })

  it('vraagt alleen om een bevestiging, geen keuze', () => {
    expect(t).toContain('gelezen hebt')
    expect(t).not.toContain('daarna kies je')
  })

  // Geen standaard bedankzin: wie dat wil zeggen zegt het in eigen woorden.
  it('bedankt niet namens Sander', () => {
    expect(t).not.toContain('bedankt')
  })
})

describe('aanbod vaste uren', () => {
  const brief = brieftekst({
    voorstel: v({
      aard: 'vaste_uren',
      soort: 'vaste_uren',
      duur: null,
      eindigt: null,
      uren_vast: 14,
      gemiddelde_uren: 14,
      gemiddelde_bron: 'berekend',
      gemiddelde_over: 'de twaalf maanden tot oktober 2026',
    }),
    voornaam: 'Thijmen',
    huidig,
  })
  const t = tekst(brief)

  it('noemt het aantal uren en vanaf wanneer', () => {
    expect(t).toContain('14 vaste uren per week, vanaf 1 januari 2027')
  })

  /* De kern van deze brief: uitleggen wat hij kiest. Beide kanten moeten erin
     staan, anders is het geen eerlijk aanbod maar een verkooppraatje. */
  it('legt uit dat het twee kanten op werkt', () => {
    expect(t).toContain('betaal ze, ook als het rustig is')
    expect(t).toContain('jij werkt die uren ook')
  })

  it('zegt dat hij mag weigeren, en wat er dan gebeurt', () => {
    expect(t).toContain('je mag nee zeggen')
    expect(t).toContain('blijf je oproepkracht')
    expect(t).toContain('over twaalf maanden krijg je dan opnieuw een aanbod')
    expect(t).toContain('geen gevolgen voor je werk')
  })

  it('zegt waarop het gemiddelde rust', () => {
    expect(t).toContain('de twaalf maanden tot oktober 2026')
  })

  /* Rust het gemiddelde op minder dan twaalf maanden, dan hoort hij dat te
     weten: het is zijn recht om het na te vragen bij het loonbureau. */
  it('zegt het als het gemiddelde geen heel jaar beslaat', () => {
    const b = brieftekst({
      voorstel: v({
        aard: 'vaste_uren',
        uren_vast: 14,
        gemiddelde_uren: 14,
        gemiddelde_bron: 'deels_berekend',
        gemiddelde_over: 'juli t/m oktober 2026',
      }),
      voornaam: 'Thijmen',
      huidig,
    })
    expect(tekst(b)).toContain('nog geen heel jaar')
  })

  it('zwijgt daarover bij een opgave van het loonbureau', () => {
    const b = brieftekst({
      voorstel: v({
        aard: 'vaste_uren',
        uren_vast: 16,
        gemiddelde_uren: 16,
        gemiddelde_bron: 'loonbureau',
        gemiddelde_over: 'november 2025 t/m oktober 2026',
      }),
      voornaam: 'Thijmen',
      huidig,
    })
    expect(tekst(b)).not.toContain('nog geen heel jaar')
  })
})

describe('verlengen én vaste uren', () => {
  const brief = brieftekst({
    voorstel: v({
      aard: 'verlengen_en_vaste_uren',
      soort: 'vaste_uren',
      uren_vast: 14,
      gemiddelde_uren: 14,
      gemiddelde_bron: 'berekend',
      gemiddelde_over: 'de twaalf maanden tot oktober 2026',
    }),
    voornaam: 'Thijmen',
    huidig,
  })

  /* Eén ja-of-nee op het geheel zou betekenen dat wie de uren afwijst ook de
     verlenging afwijst. Dat moet met zoveel woorden in de brief staan. */
  it('zet er een kader bij dat het twee vragen zijn', () => {
    const kader = brief.blokken.find((b) => b.soort === 'kader')
    expect(kader).toBeDefined()
    expect(kader && 'tekst' in kader ? kader.tekst : '').toContain('twee aparte vragen')
  })

  it('zegt bij het antwoorden dat de vragen apart gaan', () => {
    expect(tekst(brief)).toContain('twee vragen apart')
  })

  it('bevat allebei de blokken', () => {
    const t = tekst(brief)
    expect(t).toContain('wat ik je aanbied')
    expect(t).toContain('wat vaste uren betekenen')
  })
})

describe('de toelichting van Sander', () => {
  it('komt in de brief te staan', () => {
    const b = brieftekst({
      voorstel: v({ toelichting: 'Fijn dat je er bent, ga zo door.' }),
      voornaam: 'Thijmen',
      huidig,
    })
    expect(alsTekst(b)).toContain('Fijn dat je er bent, ga zo door.')
  })
})

describe('de urenzin', () => {
  it('schrijft elke vorm als zin', () => {
    expect(urenzin({ soort: 'nuluren' })).toBe('Geen vaste uren: je werkt op afroep.')
    expect(urenzin({ soort: 'vaste_uren', uren_vast: 14.5 })).toBe('14,5 vaste uren per week.')
    expect(urenzin({ soort: 'min_max', uren_min: 4, uren_max: 12 })).toBe(
      'Tussen 4 en 12 uur per week.',
    )
  })
})

describe('zonder naam', () => {
  // Liever een algemene aanhef dan "Hoi ,".
  it('valt terug op iets leesbaars', () => {
    expect(brieftekst({ voorstel: v(), voornaam: null, huidig }).aanhef).toBe('Hoi daar,')
  })
})

describe('de uren staan maar op één plek', () => {
  /* In een brief met beide vragen horen de uren niet in het rijtje van de
     verlenging: daar lezen ze als onderdeel ervan, terwijl het kader eronder
     juist zegt dat hij ze apart mag weigeren. */
  it('noemt de uren bij A+C alleen in het aanbod, niet bij de verlenging', () => {
    const b = brieftekst({
      voorstel: v({ aard: 'verlengen_en_vaste_uren', soort: 'vaste_uren', uren_vast: 14 }),
      voornaam: 'Thijmen',
      huidig,
    })
    const lijsten = b.blokken.filter((x) => x.soort === 'lijst')
    const aanbod = lijsten[0]
    expect(aanbod && 'regels' in aanbod ? aanbod.regels.join(' ') : '').not.toContain('14')
    expect(alsTekst(b)).toContain('14 vaste uren per week, vanaf')
  })

  it('noemt ze bij een gewone verlenging wél in het rijtje', () => {
    const b = brieftekst({ voorstel: v(), voornaam: 'Thijmen', huidig })
    const lijst = b.blokken.find((x) => x.soort === 'lijst')
    expect(lijst && 'regels' in lijst ? lijst.regels.join(' ') : '').toContain('op afroep')
  })
})
