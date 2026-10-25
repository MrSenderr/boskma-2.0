/* Contractvoorstellen.
 *
 * De toetsen gaan vooral over wat er níet mag. Een voorstel dat er goed uitziet
 * en juridisch niet kan is het dure geval: een vierde tijdelijk contract is van
 * rechtswege vast, en een aanbod vaste uren onder het twaalfmaandsgemiddelde
 * kan tot vijf jaar terug worden opgeëist. */

import { describe, expect, it } from 'vitest'
import { ketenVan, type Contract } from './contracten'
import {
  AARDNAAM,
  TE_KIEZEN,
  aanbodWachtOpVerlenging,
  controleer,
  herinnering,
  magVerstuurd,
  metVasteUren,
  metVerlenging,
  openstaand,
  samenvatting,
  schoonVoorstel,
  standVan,
  type Voorstel,
  vulVoorstelIn,
  wachtOpMedewerker,
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

  it('vult bij een aanbod vaste uren het gemiddelde in, met de periode erbij', () => {
    const v = vulVoorstelIn({
      aard: 'vaste_uren',
      huidig,
      keten,
      gemiddelde: {
        uren: 14.5,
        over: 'juli t/m oktober 2026',
        volledig: false,
        maandenGedekt: 4,
      },
      vandaag,
    })
    expect(v.soort).toBe('vaste_uren')
    expect(v.uren_vast).toBe(14.5)
    expect(v.gemiddelde_uren).toBe(14.5)
    /* De periode reist mee. Zonder dit zou de brief "de afgelopen twaalf
       maanden" zeggen over vier maanden. */
    expect(v.gemiddelde_bron).toBe('deels_berekend')
    expect(v.gemiddelde_over).toBe('juli t/m oktober 2026')
  })

  it('noemt het gewoon berekend als er twaalf maanden zijn ingelezen', () => {
    const v = vulVoorstelIn({
      aard: 'vaste_uren',
      huidig,
      keten,
      gemiddelde: {
        uren: 14.5,
        over: 'de twaalf maanden tot oktober 2026',
        volledig: true,
        maandenGedekt: 12,
      },
      vandaag,
    })
    expect(v.gemiddelde_bron).toBe('berekend')
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
     hoort het niet de deur uit te gaan. Het loonbureau kan het leveren; de
     melding wijst daarheen in plaats van te zeggen dat het niet kan. */
  it('houdt een aanbod tegen als het gemiddelde onbekend is', () => {
    const bezwaren = controleer(
      { aard: 'vaste_uren', uren_vast: 14, gemiddelde_uren: null },
      leegKeten,
      vandaag,
    )
    expect(bezwaren[0].ernst).toBe('fout')
    expect(bezwaren[0].wat).toMatch(/geen gemiddelde bekend/)
    expect(bezwaren[0].wat).toMatch(/loonbureau/)
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

describe('een gemiddelde dat geen heel jaar beslaat', () => {
  /* Dit is sinds 25 oktober 2026 de werkelijkheid: de uren staan pas vanaf
     juli in de app. Tegenhouden zou betekenen dat er helemaal geen aanbod
     komt, en géén aanbod doen is duurder — dan loopt de vordering over álle
     uren in plaats van over het verschil. */
  it('laat het door, met een waarschuwing', () => {
    const bezwaren = controleer(
      {
        aard: 'vaste_uren',
        uren_vast: 16,
        gemiddelde_uren: 15,
        gemiddelde_bron: 'deels_berekend',
        gemiddelde_over: 'juli t/m oktober 2026',
      },
      leegKeten,
      vandaag,
    )
    expect(magVerstuurd(bezwaren)).toBe(true)
    expect(bezwaren.some((b) => b.ernst === 'letop' && /juli t\/m oktober 2026/.test(b.wat))).toBe(true)
  })

  /* De waarschuwing hangt aan de bron, niet aan de woorden in de omschrijving:
     die mag Sander zelf typen, en dan zou een juridisch bindend aanbod aan een
     woordkeus hangen. */
  it('zwijgt als het wél over twaalf maanden gaat', () => {
    const bezwaren = controleer(
      {
        aard: 'vaste_uren',
        uren_vast: 16,
        gemiddelde_uren: 15,
        gemiddelde_bron: 'berekend',
        gemiddelde_over: 'wat Sander hier ook typt',
      },
      leegKeten,
      vandaag,
    )
    expect(bezwaren).toEqual([])
  })

  /* Op 25 oktober 2026 bij de eerste proef: het getal met de hand ingevuld,
     het periodeveld leeg gelaten, en de app liet het door. In de brief viel de
     zin over waarop het aanbod rust dan stilletjes weg. */
  it('vraagt om de periode als het getal met de hand is ingevuld', () => {
    const bezwaren = controleer(
      {
        aard: 'vaste_uren',
        uren_vast: 5,
        gemiddelde_uren: 5,
        gemiddelde_bron: 'loonbureau',
        gemiddelde_over: '',
      },
      leegKeten,
      vandaag,
    )
    expect(magVerstuurd(bezwaren)).toBe(false)
    expect(bezwaren.some((b) => /over welke periode/i.test(b.wat))).toBe(true)
  })

  it('maakt van een leeg periodeveld geen lege tekst in de tabel', () => {
    const uit = schoonVoorstel({
      aard: 'vaste_uren',
      gemiddelde_uren: 5,
      gemiddelde_bron: 'loonbureau',
      gemiddelde_over: '   ',
    })
    expect(uit.gemiddelde_over).toBeNull()
  })

  /* Het getal van het loonbureau is de bron zelf; daar hoeft verder niets bij
     gezegd te worden. */
  it('zwijgt bij een opgave van het loonbureau', () => {
    const bezwaren = controleer(
      {
        aard: 'vaste_uren',
        uren_vast: 16,
        gemiddelde_uren: 15,
        gemiddelde_bron: 'loonbureau',
        gemiddelde_over: 'november 2025 t/m oktober 2026',
      },
      leegKeten,
      vandaag,
    )
    expect(bezwaren).toEqual([])
  })

  // De brief mag niet "twaalf maanden" zeggen over vier maanden.
  it('schrijft in de brief de echte periode op', () => {
    const regels = samenvatting({
      aard: 'vaste_uren',
      uren_vast: 16,
      gemiddelde_uren: 15,
      gemiddelde_over: 'juli t/m oktober 2026',
    })
    expect(regels.some((r) => r === 'Het gemiddelde over juli t/m oktober 2026 is 15 uur.')).toBe(
      true,
    )
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

describe('wat er nog van de medewerker moet komen', () => {
  const v = (anders: Partial<Voorstel>): Voorstel =>
    ({
      id: 'v1',
      aard: 'verlengen',
      uiterlijk: '2026-11-30',
      verstuurd_op: '2026-10-20T10:00:00Z',
      ingetrokken_op: null,
      geopend_op: null,
      ontvangst_bevestigd_op: null,
      keuze_verlenging: null,
      keuze_vaste_uren: null,
      op_papier: false,
      ...anders,
    }) as Voorstel

  it('vraagt alleen om de antwoorden die bij de aard horen', () => {
    expect(openstaand(v({ aard: 'verlengen' }))).toEqual({ verlenging: true, vasteUren: false })
    expect(openstaand(v({ aard: 'vaste_uren' }))).toEqual({ verlenging: false, vasteUren: true })
    expect(openstaand(v({ aard: 'stoppen' }))).toEqual({ verlenging: false, vasteUren: false })
    expect(openstaand(v({ aard: 'verlengen_en_vaste_uren' }))).toEqual({
      verlenging: true,
      vasteUren: true,
    })
  })

  /* Bij stoppen valt er niets te kiezen; dan is het bevestigen van de ontvangst
     het hele antwoord. Zou de app blijven wachten op een keuze, dan stond er
     tot in het oneindige een seintje. */
  it('is bij stoppen klaar zodra de ontvangst is bevestigd', () => {
    expect(wachtOpMedewerker(v({ aard: 'stoppen' }))).toBe(true)
    expect(
      wachtOpMedewerker(v({ aard: 'stoppen', ontvangst_bevestigd_op: '2026-10-21T10:00:00Z' })),
    ).toBe(false)
  })

  it('wacht bij verlengen ook na de bevestiging nog op de keuze', () => {
    const bevestigd = v({ ontvangst_bevestigd_op: '2026-10-21T10:00:00Z' })
    expect(wachtOpMedewerker(bevestigd)).toBe(true)
    expect(wachtOpMedewerker({ ...bevestigd, keuze_verlenging: 'akkoord' })).toBe(false)
  })

  it('wacht niet op een concept of op iets wat is ingetrokken', () => {
    expect(wachtOpMedewerker(v({ verstuurd_op: null }))).toBe(false)
    expect(wachtOpMedewerker(v({ ingetrokken_op: '2026-10-22T10:00:00Z' }))).toBe(false)
  })
})

describe('het seintje dat een voorstel blijft liggen', () => {
  const v = (anders: Partial<Voorstel> = {}): Voorstel =>
    ({
      id: 'v1',
      aard: 'verlengen',
      uiterlijk: '2026-11-30',
      verstuurd_op: '2026-10-20T10:00:00Z',
      ingetrokken_op: null,
      ontvangst_bevestigd_op: null,
      op_papier: false,
      ...anders,
    }) as Voorstel

  it('zwijgt zolang er nog ruim tijd is', () => {
    expect(herinnering(v(), '2026-10-25')).toBeNull()
  })

  it('komt twee weken vooraf, en wordt een week vooraf dringend', () => {
    expect(herinnering(v(), '2026-11-16')).toEqual({ dagen: 14, dringend: false })
    expect(herinnering(v(), '2026-11-23')).toEqual({ dagen: 7, dringend: true })
  })

  /* Over de datum heen blijft het staan. De aanzegging is dan te laat en dat
     wordt niet minder waar door het weg te halen. */
  it('blijft staan als de datum voorbij is', () => {
    expect(herinnering(v(), '2026-12-05')).toEqual({ dagen: -5, dringend: true })
  })

  it('zwijgt zodra hij het gelezen heeft of het op papier is gegaan', () => {
    expect(herinnering(v({ ontvangst_bevestigd_op: '2026-10-21T10:00:00Z' }), '2026-11-23')).toBeNull()
    expect(herinnering(v({ op_papier: true }), '2026-11-23')).toBeNull()
  })

  /* Normaal zet het antwoorden de bevestiging mee. Toch ook hierop toetsen:
     een antwoord bewijst de ontvangst, en één rij waar dat niet samenloopt
     hoort geen seintje op te leveren over iets wat al beantwoord is. */
  it('zwijgt zodra er een antwoord ligt', () => {
    expect(herinnering(v({ keuze_verlenging: 'akkoord' }), '2026-11-23')).toBeNull()
    expect(herinnering(v({ keuze_vaste_uren: 'geweigerd' }), '2026-11-23')).toBeNull()
  })

  it('zwijgt bij een concept en bij een ingetrokken voorstel', () => {
    expect(herinnering(v({ verstuurd_op: null }), '2026-11-23')).toBeNull()
    expect(herinnering(v({ ingetrokken_op: '2026-10-22T10:00:00Z' }), '2026-11-23')).toBeNull()
  })

  // Zonder uiterlijke datum valt er niets af te tellen.
  it('zwijgt zonder uiterlijke datum', () => {
    expect(herinnering(v({ uiterlijk: null }), '2026-11-23')).toBeNull()
  })
})

describe('eerst het aanbod, dan de verlenging', () => {
  const huidig = c({ begint: '2026-01-01', eindigt: '2026-12-31', soort: 'nuluren' })
  const keten = ketenVan([huidig], vandaag)
  const aanbod = (keuze: 'aangenomen' | 'geweigerd', anders: Partial<Voorstel> = {}): Voorstel =>
    ({
      id: 'a1',
      medewerker_id: 'p1',
      aard: 'vaste_uren',
      uren_vast: 14,
      opgesteld_op: '2026-09-01T09:00:00Z',
      verstuurd_op: '2026-09-01T09:05:00Z',
      ingetrokken_op: null,
      keuze_vaste_uren: keuze,
      keuze_verlenging: null,
      ...anders,
    }) as Voorstel

  /* Combineren is eruit: eerst het aanbod, dan met de uitkomst in de hand de
     verlenging. Dan moet die uitkomst ook niet kwijtraken. */
  it('verlengt met vaste uren als die zijn aangenomen', () => {
    const v = vulVoorstelIn({
      aard: 'verlengen',
      huidig,
      keten,
      beantwoordAanbod: aanbod('aangenomen'),
      vandaag,
    })
    expect(v.soort).toBe('vaste_uren')
    expect(v.uren_vast).toBe(14)
  })

  it('verlengt als oproepkracht als ze zijn geweigerd', () => {
    const v = vulVoorstelIn({
      aard: 'verlengen',
      huidig,
      keten,
      beantwoordAanbod: aanbod('geweigerd'),
      vandaag,
    })
    expect(v.soort).toBe('nuluren')
    expect(v.uren_vast).toBeNull()
  })

  it('volgt zonder aanbod gewoon het lopende contract', () => {
    const vast = c({ begint: '2026-01-01', eindigt: '2026-12-31', soort: 'vaste_uren', uren_vast: 20 })
    const v = vulVoorstelIn({ aard: 'verlengen', huidig: vast, keten: ketenVan([vast], vandaag), vandaag })
    expect(v.soort).toBe('vaste_uren')
    expect(v.uren_vast).toBe(20)
  })

  it('vindt het aanbod dat nog op een verlenging wacht', () => {
    expect(aanbodWachtOpVerlenging([aanbod('aangenomen')])?.id).toBe('a1')
  })

  it('zwijgt als er al een verlenging op volgde', () => {
    const later = {
      id: 'v2',
      aard: 'verlengen',
      opgesteld_op: '2026-10-01T09:00:00Z',
      ingetrokken_op: null,
    } as unknown as Voorstel
    expect(aanbodWachtOpVerlenging([aanbod('aangenomen'), later])).toBeNull()
  })

  it('zwijgt bij een aanbod dat nog niet beantwoord is of is ingetrokken', () => {
    expect(aanbodWachtOpVerlenging([aanbod('aangenomen', { keuze_vaste_uren: null })])).toBeNull()
    expect(
      aanbodWachtOpVerlenging([aanbod('aangenomen', { ingetrokken_op: '2026-09-05T09:00:00Z' })]),
    ).toBeNull()
  })

  // Het combineren is uit de keuzelijst, maar bestaande voorstellen blijven werken.
  it('biedt combineren niet meer aan, maar kent het nog wel', () => {
    expect(TE_KIEZEN).toEqual(['verlengen', 'stoppen', 'vaste_uren'])
    expect(AARDNAAM.verlengen_en_vaste_uren).toBeTruthy()
  })
})

describe('de klok bij twee stappen', () => {
  const loopt = c({ begint: '2026-01-01', eindigt: '2026-12-31' })
  const aanbod = (uiterlijk: string | null) =>
    controleer(
      {
        aard: 'vaste_uren',
        uren_vast: 14,
        gemiddelde_uren: 14,
        gemiddelde_bron: 'berekend',
        uiterlijk,
      },
      leegKeten,
      vandaag,
      loopt,
    )

  /* Aanzeggen moet uiterlijk 30 november; op een aanbod heeft hij een maand.
     Doe je het aanbod in november, dan is zijn antwoord er pas in december en
     moet je aanzeggen zonder te weten wat hij kiest. */
  it('waarschuwt als het antwoord na de aanzegdatum komt', () => {
    const bezwaren = aanbod('2026-12-15')
    expect(bezwaren.some((b) => b.ernst === 'letop' && /aanzeggen moet uiterlijk/.test(b.wat))).toBe(
      true,
    )
    // Tegenhouden doet het niet: soms moet het toch.
    expect(magVerstuurd(bezwaren)).toBe(true)
  })

  it('zwijgt als het antwoord op tijd binnen is', () => {
    expect(aanbod('2026-11-15').some((b) => /aanzeggen moet uiterlijk/.test(b.wat))).toBe(false)
  })

  it('zwijgt bij een contract voor onbepaalde tijd', () => {
    const vast = c({ begint: '2026-01-01', eindigt: null, duur: 'onbepaalde' })
    const bezwaren = controleer(
      { aard: 'vaste_uren', uren_vast: 14, gemiddelde_uren: 14, gemiddelde_bron: 'berekend', uiterlijk: '2026-12-15' },
      leegKeten,
      vandaag,
      vast,
    )
    expect(bezwaren.some((b) => /aanzeggen moet uiterlijk/.test(b.wat))).toBe(false)
  })

  it('zwijgt bij een verlenging; die gaat niet over dit aanbod', () => {
    const bezwaren = controleer(
      { aard: 'verlengen', duur: 'bepaalde', begint: '2027-01-01', eindigt: '2027-12-31' },
      leegKeten,
      vandaag,
      loopt,
    )
    expect(bezwaren.some((b) => /aanzeggen moet uiterlijk/.test(b.wat))).toBe(false)
  })
})
