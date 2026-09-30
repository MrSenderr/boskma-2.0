import { describe, expect, it } from 'vitest'
import {
  afwijkendeDagen,
  beoordeel,
  dagoverzicht,
  maandagVan,
  schoonTijd,
  statistiek,
  weeknummer,
  type Shift,
} from './rooster'
import type { Eitjebestand, Regel } from './eitje'
import type { Kandidaat } from './koppelen'

const EVI: Kandidaat = { id: 'evi', voornaam: 'Evi', achternaam: 'Dudink', uit_dienst_op: null }

function shift(anders: Partial<Shift> = {}): Shift {
  return {
    bron_id: '1',
    datum: '2026-09-08',
    voornaam: 'Evi',
    achternaam: 'Dudink',
    medewerker_id: 'evi',
    team: null,
    soort: null,
    begint: '12:00',
    eindigt: '20:00',
    minuten: 480,
    pauze_minuten: 0,
    ...anders,
  }
}

function regel(anders: Partial<Regel> = {}): Regel {
  return {
    bron_id: '1',
    datum: '2026-09-08',
    voornaam: 'Evi',
    achternaam: 'Dudink',
    team: 'Snackerie',
    soort: null,
    begint: '12:00',
    eindigt: '20:00',
    minuten: 480,
    pauze_minuten: 0,
    maaltijden: null,
    ...anders,
  }
}

const bestand = (regels: Regel[]): Eitjebestand => ({
  soort: 'planning',
  periode: { van: '2026-09-07', tot: '2026-09-13' },
  geexporteerdOp: null,
  exportNummer: null,
  vestigingen: null,
  regels,
  waarschuwingen: [],
})

describe('weken', () => {
  it('vindt de maandag, ook op zondag', () => {
    expect(maandagVan('2026-09-09')).toBe('2026-09-07')
    expect(maandagVan('2026-09-13')).toBe('2026-09-07')
    expect(maandagVan('2026-09-07')).toBe('2026-09-07')
  })

  it('telt weken zoals Nederland dat doet', () => {
    expect(weeknummer('2026-09-07')).toBe(37)
    expect(weeknummer('2026-01-01')).toBe(1)
  })
})

describe('beoordelen vóór het importeren', () => {
  it('ziet wat nieuw is', () => {
    const uit = beoordeel(bestand([regel()]), new Map(), [EVI], new Map())
    expect(uit.nieuw).toBe(1)
    expect(uit.regels[0].medewerker_id).toBe('evi')
  })

  it('ziet dat dezelfde shift al staat', () => {
    const bestaand = new Map([['1', shift()]])
    expect(beoordeel(bestand([regel()]), bestaand, [EVI], new Map()).ongewijzigd).toBe(1)
  })

  it('ziet een gewijzigde eindtijd, met wat er stond', () => {
    const bestaand = new Map([['1', shift()]])
    const uit = beoordeel(
      bestand([regel({ eindigt: '21:00', minuten: 540 })]),
      bestaand,
      [EVI],
      new Map(),
    )
    expect(uit.gewijzigd).toBe(1)
    expect(uit.regels[0].was).toBe('2026-09-08 12:00–20:00 (8:00)')
  })

  it('importeert dezelfde week twee keer zonder te verdubbelen', () => {
    // Dat is de hele reden dat bron_id de sleutel is: de tweede keer is alles
    // ongewijzigd, niet nogmaals nieuw.
    const eerste = beoordeel(bestand([regel(), regel({ bron_id: '2' })]), new Map(), [EVI], new Map())
    expect(eerste.nieuw).toBe(2)
    const alStaat = new Map([
      ['1', shift()],
      ['2', shift({ bron_id: '2' })],
    ])
    const tweede = beoordeel(bestand([regel(), regel({ bron_id: '2' })]), alStaat, [EVI], new Map())
    expect(tweede).toMatchObject({ nieuw: 0, gewijzigd: 0, ongewijzigd: 2 })
  })

  it('verzamelt namen die nergens bij passen, met hoe vaak ze voorkomen', () => {
    const uit = beoordeel(
      bestand([
        regel({ bron_id: '1', voornaam: 'Jasper', achternaam: null }),
        regel({ bron_id: '2', voornaam: 'Jasper', achternaam: null }),
        regel({ bron_id: '3', voornaam: null, achternaam: null }),
      ]),
      new Map(),
      [EVI],
      new Map(),
    )
    expect(uit.onbekend).toEqual([{ sleutel: 'jasper', naam: 'Jasper', aantal: 2, reden: 'onbekend' }])
    expect(uit.open).toBe(1)
  })
})

describe('statistiek', () => {
  const gepland = [shift({ bron_id: 'p1', minuten: 480 })]
  const gewerkt = [shift({ bron_id: 'w1', minuten: 540, eindigt: '21:00' })]

  it('legt gepland en gewerkt naast elkaar', () => {
    const [evi] = statistiek(gepland, gewerkt)
    expect(evi).toMatchObject({ naam: 'Evi Dudink', gepland: 480, gewerkt: 540, verschil: 60, shifts: 1, dagen: 1 })
  })

  it('telt iemand die alleen op de planning staat ook mee', () => {
    // Wel zichtbaar met zijn geplande uren, maar geen verschil: over die dag
    // is nog geen urenregistratie ingelezen, dus er valt niets te vergelijken.
    const [evi] = statistiek(gepland, [])
    expect(evi).toMatchObject({ gepland: 480, gewerkt: 0, vergelijkbaar: 0, verschil: 0 })
  })

  it('houdt een ongekoppelde naam apart van een gekoppelde medewerker', () => {
    const los = shift({ bron_id: 'w2', medewerker_id: null, voornaam: 'Jasper', achternaam: null })
    expect(statistiek([], [...gewerkt, los])).toHaveLength(2)
  })

  it('brengt de voornaam uit de urenexport samen met de volledige naam uit het rooster', () => {
    const uitUren = shift({ bron_id: 'w3', achternaam: null })
    const uit = statistiek(gepland, [uitUren])
    expect(uit).toHaveLength(1)
    expect(uit[0].naam).toBe('Evi Dudink')
  })

  it('telt een nul-urenregel niet als gewerkte dienst', () => {
    const nul = shift({ bron_id: 'w4', minuten: 0, begint: '11:00', eindigt: '11:00' })
    expect(statistiek([], [nul])[0]).toMatchObject({ shifts: 0, dagen: 0 })
  })

  it('telt twee diensten op één dag als één dag', () => {
    const tweede = shift({ bron_id: 'w5', begint: '08:00', eindigt: '10:00', minuten: 120 })
    expect(statistiek([], [...gewerkt, tweede])[0]).toMatchObject({ shifts: 2, dagen: 1, langste: 540 })
  })
})

describe('afwijkende dagen', () => {
  it('noemt alleen de dagen waarop het echt scheelt', () => {
    const gepland = [shift({ bron_id: 'p1' }), shift({ bron_id: 'p2', datum: '2026-09-09' })]
    const gewerkt = [
      shift({ bron_id: 'w1', minuten: 495 }), // een kwartier langer: onder de drempel
      shift({ bron_id: 'w2', datum: '2026-09-09', minuten: 600 }),
    ]
    const uit = afwijkendeDagen(gepland, gewerkt)
    expect(uit).toHaveLength(1)
    expect(uit[0]).toMatchObject({ datum: '2026-09-09', verschil: 120 })
  })

  it('zwijgt over een dag waarvan nog geen uren zijn ingelezen', () => {
    expect(afwijkendeDagen([shift()], [])).toHaveLength(0)
  })
})

describe('dagoverzicht', () => {
  it('legt de gewerkte uren op de geplande shift van diezelfde persoon', () => {
    const dag = dagoverzicht(
      [shift({ bron_id: 'p1' })],
      [shift({ bron_id: 'w1', minuten: 540, eindigt: '21:00' })],
    ).get('2026-09-08')!
    expect(dag).toHaveLength(1)
    expect(dag[0]).toMatchObject({
      naam: 'Evi Dudink',
      gepland: 480,
      gewerkt: 540,
      geplandTijd: '12:00 – 20:00',
      gewerktTijd: '12:00 – 21:00',
      onverwacht: false,
    })
  })

  it('zet iemand die niet gepland stond apart neer', () => {
    const dag = dagoverzicht([], [shift({ bron_id: 'w1' })]).get('2026-09-08')!
    expect(dag[0].onverwacht).toBe(true)
  })

  it('houdt twee open diensten op één dag uit elkaar', () => {
    const open = (id: string) =>
      shift({ bron_id: id, voornaam: null, achternaam: null, medewerker_id: null })
    const dag = dagoverzicht([open('a'), open('b')], []).get('2026-09-08')!
    expect(dag).toHaveLength(2)
    expect(dag.every((r) => r.open && r.naam === 'Open dienst')).toBe(true)
  })

  it('telt twee diensten van dezelfde persoon op één dag bij elkaar op', () => {
    const dag = dagoverzicht(
      [shift({ bron_id: 'p1' }), shift({ bron_id: 'p2', begint: '08:00', eindigt: '10:00', minuten: 120 })],
      [],
    ).get('2026-09-08')!
    expect(dag).toHaveLength(1)
    expect(dag[0].gepland).toBe(600)
  })
})

describe('alleen vergelijken wat te vergelijken valt', () => {
  const volgendeWeek = shift({ bron_id: 'p9', datum: '2026-09-15' })

  it('rekent een week waarvan de uren nog niet zijn ingelezen niet als gemist', () => {
    const uit = statistiek([shift({ bron_id: 'p1' }), volgendeWeek], [shift({ bron_id: 'w1' })])
    expect(uit[0]).toMatchObject({ gepland: 960, vergelijkbaar: 480, gewerkt: 480, verschil: 0 })
  })

  it('noemt die dag ook niet bij de afwijkingen', () => {
    const uit = afwijkendeDagen([shift({ bron_id: 'p1' }), volgendeWeek], [shift({ bron_id: 'w1' })])
    expect(uit).toHaveLength(0)
  })

  it('blijft wel zien wie er op een gewone werkdag niet was', () => {
    // Die dag staan er wél uren van collegas, dus de dag is ingelezen.
    const tim = (id: string) =>
      shift({ bron_id: id, medewerker_id: 'tim', voornaam: 'Tim', achternaam: 'Overweg' })
    const uit = afwijkendeDagen([shift({ bron_id: 'p1' }), tim('p2')], [tim('w2')])
    expect(uit).toHaveLength(1)
    expect(uit[0]).toMatchObject({ naam: 'Evi Dudink', gewerkt: 0, verschil: -480 })
  })
})

describe('tijden uit de database', () => {
  it('haalt de seconden eraf die Postgres erbij zet', () => {
    expect(schoonTijd('12:00:00')).toBe('12:00')
    expect(schoonTijd('12:00')).toBe('12:00')
    expect(schoonTijd(null)).toBeNull()
  })

  it('ziet een ongewijzigde shift niet aan voor een gewijzigde', () => {
    // Wat er uit de database komt is al geschoond; dit toetst dat de
    // vergelijking daarna klopt en niet op "12:00:00" tegen "12:00" struikelt.
    const bestaand = new Map([['1', { ...shift(), begint: schoonTijd('12:00:00'), eindigt: schoonTijd('20:00:00') }]])
    expect(beoordeel(bestand([regel()]), bestaand, [EVI], new Map()).ongewijzigd).toBe(1)
  })
})
