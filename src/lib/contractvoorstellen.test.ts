/* Contractvoorstellen.
 *
 * De toetsen gaan vooral over wat er níet mag. Een voorstel dat er goed uitziet
 * en juridisch niet kan is het dure geval: een vierde tijdelijk contract is van
 * rechtswege vast, en een aanbod vaste uren onder het twaalfmaandsgemiddelde
 * kan tot vijf jaar terug worden opgeëist. */

import { describe, expect, it } from 'vitest'
import { ketenVan, type Contract } from './contracten'
import {
  controleer,
  magVerstuurd,
  metVasteUren,
  metVerlenging,
  samenvatting,
  schoonVoorstel,
  standVan,
  vulVoorstelIn,
  type Voorstel,
} from './contractvoorstellen'

let teller = 0
const c = (anders: Partial<Contract>): Contract => ({
  id: `c${++teller}`,
  medewerker_id: 'p1',
  werkgever: 'boskma',
  soort: 'nuluren',
  duur: 'bepaalde',
  begint: '2026-01-01',
  eindigt: '2026-12-31',
  uren_vast: null,
  uren_min: null,
  uren_max: null,
  uurloon: 8.24,
  functie: 'Medewerker fastservice II',
  proefperiode: null,
  beeindigd_op: null,
  beeindigd_reden: null,
  document_id: null,
  bron: 'handmatig',
  opmerking: null,
  ...anders,
})

const vandaag = '2026-10-25'
const leegKeten = ketenVan([], vandaag)

describe('wat er in een voorstel zit', () => {
  it('weet wanneer er verlengd wordt en wanneer uren worden aangeboden', () => {
    expect(metVerlenging('verlengen')).toBe(true)
    expect(metVerlenging('verlengen_en_vaste_uren')).toBe(true)
    expect(metVerlenging('vaste_uren')).toBe(false)
    expect(metVasteUren('verlengen_en_vaste_uren')).toBe(true)
    expect(metVasteUren('stoppen')).toBe(false)
  })
})

describe('vooringevuld', () => {
  const huidig = c({ begint: '2026-01-01', eindigt: '2026-12-31' })
  const keten = ketenVan([huidig], vandaag)

  it('laat een verlenging aansluiten op het vorige contract, voor een jaar', () => {
    const v = vulVoorstelIn({ aard: 'verlengen', huidig, keten, vandaag })
    expect(v.begint).toBe('2027-01-01')
    expect(v.eindigt).toBe('2027-12-31')
    expect(v.duur).toBe('bepaalde')
    expect(v.soort).toBe('nuluren')
    expect(v.uurloon).toBe(8.24)
  })

  it('zet de aanzegdatum als uiterlijke datum', () => {
    expect(vulVoorstelIn({ aard: 'verlengen', huidig, keten, vandaag }).uiterlijk).toBe('2026-11-30')
  })

  /* Na drie tijdelijke contracten ontstaat er vanzelf een vast contract. Dan
     bepaalde tijd voorinvullen zou een voorstel opleveren dat niet uitkomt. */
  it('biedt onbepaalde tijd aan als een volgend contract toch vast wordt', () => {
    const drie = [
      c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
      c({ begint: '2025-01-01', eindigt: '2025-12-31' }),
      c({ begint: '2026-01-01', eindigt: '2026-12-31' }),
    ]
    const v = vulVoorstelIn({ aard: 'verlengen', huidig: drie[2], keten: ketenVan(drie, vandaag), vandaag })
    expect(v.duur).toBe('onbepaalde')
    expect(v.eindigt).toBeNull()
  })

  it('vult bij een aanbod vaste uren het gemiddelde in', () => {
    const v = vulVoorstelIn({ aard: 'vaste_uren', huidig, keten, gemiddelde: 14.5, vandaag })
    expect(v.soort).toBe('vaste_uren')
    expect(v.uren_vast).toBe(14.5)
    expect(v.gemiddelde_uren).toBe(14.5)
  })

  it('biedt bij stoppen niets aan', () => {
    const v = vulVoorstelIn({ aard: 'stoppen', huidig, keten, vandaag })
    expect(v.soort).toBeUndefined()
    expect(v.uiterlijk).toBe('2026-11-30')
  })
})

describe('opschonen', () => {
  /* Van gedachten veranderen tijdens het invullen mag geen resten
     achterlaten. Een einddatum in een aanbod dat geen contract is zou in de
     brief en in de tabel terechtkomen. */
  it('knipt de contractvelden van een los aanbod vaste uren af', () => {
    const uit = schoonVoorstel({
      aard: 'vaste_uren',
      soort: 'nuluren',
      duur: 'bepaalde',
      begint: '2027-01-01',
      eindigt: '2027-12-31',
      uren_vast: 14,
      uren_min: 4,
      uren_max: 20,
      gemiddelde_uren: 14,
    })
    expect(uit.soort).toBe('vaste_uren')
    expect(uit.duur).toBeNull()
    expect(uit.eindigt).toBeNull()
    expect(uit.begint).toBe('2027-01-01')
    expect(uit.uren_vast).toBe(14)
    expect(uit.uren_min).toBeNull()
  })

  /* Verlengen als oproepkracht én daarnaast vaste uren aanbieden: de uren zijn
     dan het aanbod, niet de soort van het contract. Wegknippen zou het aanbod
     leegmaken. */
  it('laat aangeboden uren staan bij een verlenging als oproepkracht', () => {
    const uit = schoonVoorstel({
      aard: 'verlengen_en_vaste_uren',
      soort: 'nuluren',
      duur: 'bepaalde',
      begint: '2027-01-01',
      eindigt: '2027-12-31',
      uren_vast: 14,
      gemiddelde_uren: 13.5,
    })
    expect(uit.uren_vast).toBe(14)
    expect(uit.eindigt).toBe('2027-12-31')
  })

  it('haalt de einddatum weg bij onbepaalde tijd', () => {
    expect(schoonVoorstel({ aard: 'verlengen', duur: 'onbepaalde', eindigt: '2027-12-31' }).eindigt).toBeNull()
  })

  it('houdt bij stoppen alleen over wat er bij hoort', () => {
    const uit = schoonVoorstel({
      aard: 'stoppen',
      soort: 'nuluren',
      duur: 'bepaalde',
      eindigt: '2026-12-31',
      uurloon: 8.25,
      uiterlijk: '2026-11-30',
    })
    expect(uit.soort).toBeUndefined()
    expect(uit.uurloon).toBeUndefined()
    expect(uit.uiterlijk).toBe('2026-11-30')
  })

  it('bewaart het gemiddelde niet bij een voorstel zonder urenaanbod', () => {
    expect(schoonVoorstel({ aard: 'verlengen', gemiddelde_uren: 14 }).gemiddelde_uren).toBeNull()
  })
})

describe('wat niet mag', () => {
  it('houdt een vierde tijdelijk contract tegen', () => {
    const drie = [
      c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
      c({ begint: '2025-01-01', eindigt: '2025-12-31' }),
      c({ begint: '2026-01-01', eindigt: '2026-12-31' }),
    ]
    const keten = ketenVan(drie, vandaag)
    const bezwaren = controleer(
      { aard: 'verlengen', duur: 'bepaalde', begint: '2027-01-01', eindigt: '2027-12-31' },
      keten,
      vandaag,
    )
    expect(bezwaren.some((b) => b.ernst === 'fout' && /van rechtswege/.test(b.wat))).toBe(true)
    expect(magVerstuurd(bezwaren)).toBe(false)
  })

  it('laat onbepaalde tijd dan wél door', () => {
    const drie = [
      c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
      c({ begint: '2025-01-01', eindigt: '2025-12-31' }),
      c({ begint: '2026-01-01', eindigt: '2026-12-31' }),
    ]
    const bezwaren = controleer(
      { aard: 'verlengen', duur: 'onbepaalde', begint: '2027-01-01', eindigt: null },
      ketenVan(drie, vandaag),
      vandaag,
    )
    expect(magVerstuurd(bezwaren)).toBe(true)
  })

  /* De kern van het aanbod vaste uren: minder dan het gemiddelde is geen
     geldig aanbod. */
  it('houdt een aanbod onder het gemiddelde tegen', () => {
    const bezwaren = controleer(
      { aard: 'vaste_uren', soort: 'vaste_uren', uren_vast: 10, gemiddelde_uren: 14.5 },
      leegKeten,
      vandaag,
    )
    expect(bezwaren[0].ernst).toBe('fout')
    expect(bezwaren[0].wat).toMatch(/minstens het gemiddelde/)
  })

  it('laat precies het gemiddelde door, en meer ook', () => {
    expect(
      magVerstuurd(
        controleer({ aard: 'vaste_uren', uren_vast: 14.5, gemiddelde_uren: 14.5 }, leegKeten, vandaag),
      ),
    ).toBe(true)
    expect(
      magVerstuurd(
        controleer({ aard: 'vaste_uren', uren_vast: 16, gemiddelde_uren: 14.5 }, leegKeten, vandaag),
      ),
    ).toBe(true)
  })

  /* Zonder gemiddelde kun je niet weten of het aanbod hoog genoeg is, en dan
     hoort het niet de deur uit te gaan. Dit is vandaag de werkelijkheid: de
     gewerkte uren zijn nog niet volledig ingelezen. */
  it('houdt een aanbod tegen als het gemiddelde onbekend is', () => {
    const bezwaren = controleer(
      { aard: 'vaste_uren', uren_vast: 14, gemiddelde_uren: null },
      leegKeten,
      vandaag,
    )
    expect(bezwaren[0].ernst).toBe('fout')
    expect(bezwaren[0].wat).toMatch(/niet bekend/)
  })

  it('houdt een bandbreedte tegen die te ver uit elkaar ligt', () => {
    const bezwaren = controleer(
      { aard: 'verlengen', soort: 'bandbreedte', duur: 'bepaalde', begint: '2027-01-01', eindigt: '2027-12-31', uren_min: 10, uren_max: 20 },
      leegKeten,
      vandaag,
    )
    expect(bezwaren.some((b) => b.ernst === 'fout' && /30%/.test(b.wat))).toBe(true)
  })

  /* Een min-max van 10/40 mag vandaag gewoon; pas in 2028 niet meer. Een regel
     uit de toekomst hoort het heden niet tegen te houden. */
  it('waarschuwt alleen bij een min-max die te ver uit elkaar ligt', () => {
    const bezwaren = controleer(
      { aard: 'verlengen', soort: 'min_max', duur: 'bepaalde', begint: '2027-01-01', eindigt: '2027-12-31', uren_min: 10, uren_max: 40 },
      leegKeten,
      vandaag,
    )
    expect(bezwaren.some((b) => b.ernst === 'letop' && /2028/.test(b.wat))).toBe(true)
    expect(magVerstuurd(bezwaren)).toBe(true)
  })

  it('meldt een verlopen aanzegdatum bij stoppen als fout', () => {
    const bezwaren = controleer({ aard: 'stoppen', uiterlijk: '2026-09-01' }, leegKeten, vandaag)
    expect(bezwaren[0].ernst).toBe('fout')
    expect(bezwaren[0].wat).toMatch(/maandloon/)
  })

  it('vraagt om een einddatum bij bepaalde tijd', () => {
    const bezwaren = controleer(
      { aard: 'verlengen', duur: 'bepaalde', begint: '2027-01-01', eindigt: null },
      leegKeten,
      vandaag,
    )
    expect(bezwaren.some((b) => /einddatum/.test(b.wat))).toBe(true)
  })
})

describe('de samenvatting', () => {
  it('schrijft een verlenging in gewone zinnen', () => {
    const regels = samenvatting({
      aard: 'verlengen',
      soort: 'nuluren',
      duur: 'bepaalde',
      begint: '2027-01-01',
      eindigt: '2027-12-31',
      uurloon: 8.24,
    })
    expect(regels[0]).toBe('Verlenging van 1 januari 2027 tot en met 31 december 2027.')
    expect(regels.some((r) => r.includes('€ 8,24'))).toBe(true)
  })

  it('zegt er bij een aanbod vaste uren bij dat weigeren mag', () => {
    const regels = samenvatting({ aard: 'vaste_uren', uren_vast: 14.5, gemiddelde_uren: 14.5 })
    expect(regels.some((r) => /mag je weigeren/.test(r))).toBe(true)
    expect(regels.some((r) => r.includes('14,5 vaste uren'))).toBe(true)
    expect(regels.some((r) => r.includes('Dat is het gemiddelde'))).toBe(true)
  })

  /* Een brief die een onwaarheid bevat werkt tegen je op het moment dat het
     erop aankomt. Biedt Sander meer dan het gemiddelde, dan hoort er niet te
     staan dat het aanbod het gemiddelde ís. */
  it('noemt het aanbod alleen het gemiddelde als het dat ook is', () => {
    const regels = samenvatting({ aard: 'vaste_uren', uren_vast: 16, gemiddelde_uren: 13.92 })
    expect(regels.some((r) => r.includes('16 vaste uren'))).toBe(true)
    expect(regels.some((r) => r === 'Het gemiddelde over de afgelopen twaalf maanden is 13,92 uur.')).toBe(true)
    expect(regels.some((r) => /Dat is het gemiddelde/.test(r))).toBe(false)
  })

  it('schrijft de uren als zin, niet als fragment', () => {
    const oproep = samenvatting({
      aard: 'verlengen',
      soort: 'nuluren',
      duur: 'bepaalde',
      begint: '2027-01-01',
      eindigt: '2027-12-31',
    })
    expect(oproep.some((r) => r === 'Geen vaste uren: je werkt op afroep.')).toBe(true)
    const vast = samenvatting({
      aard: 'verlengen',
      soort: 'min_max',
      duur: 'bepaalde',
      begint: '2027-01-01',
      eindigt: '2027-12-31',
      uren_min: 4,
      uren_max: 12,
    })
    expect(vast.some((r) => r === '4 tot 12 uur per week.')).toBe(true)
  })

  it('houdt het bij stoppen kort', () => {
    expect(samenvatting({ aard: 'stoppen' })[0]).toMatch(/niet verlengd/)
  })
})

describe('de stand van een voorstel', () => {
  const v = (anders: Partial<Voorstel>): Voorstel =>
    ({
      id: 'v1',
      ingetrokken_op: null,
      verstuurd_op: null,
      geopend_op: null,
      ontvangst_bevestigd_op: null,
      keuze_verlenging: null,
      keuze_vaste_uren: null,
      ...anders,
    }) as Voorstel

  it('loopt van concept naar beantwoord', () => {
    expect(standVan(v({}))).toBe('concept')
    expect(standVan(v({ verstuurd_op: 'x' }))).toBe('verstuurd')
    expect(standVan(v({ verstuurd_op: 'x', geopend_op: 'y' }))).toBe('gezien')
    expect(standVan(v({ verstuurd_op: 'x', keuze_verlenging: 'akkoord' }))).toBe('beantwoord')
  })

  it('zet ingetrokken boven alles', () => {
    expect(standVan(v({ verstuurd_op: 'x', keuze_verlenging: 'akkoord', ingetrokken_op: 'z' }))).toBe(
      'ingetrokken',
    )
  })
})
