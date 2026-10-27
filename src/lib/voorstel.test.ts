import { describe, expect, it } from 'vitest'
import type { Afwezig, Opgave } from './beschikbaarheid'
import type { Sjabloonregel, VasteDienst } from './weeksjabloon'
import {
  belemmering,
  dagenIn,
  maakVoorstel,
  punten,
  samenvatten,
  weekdag,
  wensenUit,
  volgendBlok,
  type Opdracht,
  type Persoon,
} from './voorstel'

const mens = (id: string, voornaam: string, extra: Partial<Persoon> = {}): Persoon => ({
  id,
  voornaam,
  achternaam: 'Test',
  uit_dienst_op: null,
  ...extra,
})

const EVI = mens('evi', 'Evi')
const DAAN = mens('daan', 'Daan')
const BRIAN = mens('brian', 'Brian')

/* Zaterdag 14 november 2026. */
const ZA = '2026-11-14'

const regel = (anders: Partial<Sjabloonregel>): Sjabloonregel => ({
  id: Math.random().toString(36).slice(2),
  dag: 6,
  soort: 'avond',
  begint: '17:00:00',
  eindigt: '20:00:00',
  aantal: 1,
  opmerking: null,
  ...anders,
})

const opgave = (anders: Partial<Opgave>): Opgave => ({
  bron_id: Math.random().toString(36).slice(2),
  datum: ZA,
  status: 'available',
  opmerking: null,
  naam: 'Evi Test',
  medewerker_id: 'evi',
  ...anders,
})

const afwezig = (anders: Partial<Afwezig>): Afwezig => ({
  bron_id: Math.random().toString(36).slice(2),
  soort: 'verlof',
  van: ZA,
  tot: ZA,
  status: 'accepted',
  reden: null,
  naam: 'Evi Test',
  medewerker_id: 'evi',
  ...anders,
})

const opdracht = (anders: Partial<Opdracht> = {}): Opdracht => ({
  van: ZA,
  tot: ZA,
  sjabloon: [regel({})],
  vast: [],
  mensen: [EVI],
  opgaven: [],
  afwezig: [],
  ...anders,
})

describe('de kalender', () => {
  it('telt zondag als zeven, zoals het sjabloon dat doet', () => {
    expect(weekdag('2026-11-14')).toBe(6)
    expect(weekdag('2026-11-15')).toBe(7)
    expect(weekdag('2026-11-16')).toBe(1)
  })

  it('loopt een periode dag voor dag af', () => {
    expect(dagenIn('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15', '2026-11-16'])
  })

  it('geeft niets terug bij een periode die niet bestaat', () => {
    expect(dagenIn('2026-11-16', '2026-11-14')).toEqual([])
  })
})

describe('wie er niet kan', () => {
  it('houdt ziekte en goedgekeurd verlof hard tegen', () => {
    expect(belemmering(EVI, ZA, [], [afwezig({ soort: 'ziek', status: 'loopt' })])).toMatchObject({
      hard: true,
    })
    expect(belemmering(EVI, ZA, [], [afwezig({})])).toMatchObject({ hard: true, tekst: 'verlof' })
  })

  /* Aangevraagd verlof houdt niemand tegen, maar je hoort het te zien: keur je
     het alsnog goed, dan klopt het rooster niet meer. */
  it('laat verlof dat nog niet is goedgekeurd door, met een waarschuwing', () => {
    expect(belemmering(EVI, ZA, [], [afwezig({ status: 'pending' })])).toMatchObject({
      hard: false,
    })
  })

  it('houdt "ik kan niet" hard tegen, met de reden erbij', () => {
    const uit = belemmering(EVI, ZA, [opgave({ status: 'unavailable', opmerking: 'bruiloft' })], [])
    expect(uit).toMatchObject({ hard: true })
    expect(uit?.tekst).toContain('bruiloft')
  })

  /* "Deels beschikbaar" is geen nee. Wie om zeven uur weg moet kan de spits nog
     draaien; dat hoor je te zien en niet weggefilterd te krijgen. */
  it('laat deels beschikbaar door als waarschuwing', () => {
    const uit = belemmering(
      EVI,
      ZA,
      [opgave({ status: 'partly_unavailable', opmerking: 'school' })],
      [],
    )
    expect(uit).toMatchObject({ hard: false })
    expect(uit?.tekst).toContain('school')
  })

  it('plant niemand in die al uit dienst is', () => {
    const weg = mens('oud', 'Oud', { uit_dienst_op: '2026-11-01' })
    expect(belemmering(weg, ZA, [], [])).toMatchObject({ hard: true, tekst: 'uit dienst' })
  })

  it('zegt niets als er niets aan de hand is', () => {
    expect(belemmering(EVI, ZA, [], [])).toBeNull()
  })
})

describe('de punten', () => {
  const basis = {
    opgegevenBeschikbaar: false,
    houdtBeschikbaarheidBij: true,
    wens: undefined,
    dienstenDezeWeek: 0,
    zachteBelemmering: false,
  }

  it('beloont wie heeft opgegeven dat hij kan', () => {
    expect(punten({ ...basis, opgegevenBeschikbaar: true })).toBeGreaterThan(punten(basis))
  })

  /* Dit is de kern van wat er eerst misging. Een paar mensen vullen hun
     beschikbaarheid nooit in; die regelen het via hun vaste dagen. Zou zwijgen
     bij hen hetzelfde wegen als bij iemand die het wél bijhoudt, dan kwamen ze
     nooit meer aan een extra dienst — en dat zijn juist de mensen die er altijd
     staan. */
  it('straft niemand voor een opgave die hij nooit doet', () => {
    const nooit = punten({ ...basis, houdtBeschikbaarheidBij: false })
    const welMaarStil = punten(basis)
    expect(nooit).toBeGreaterThan(welMaarStil)
    expect(nooit).toBe(punten({ ...basis, opgegevenBeschikbaar: true }))
  })

  it('houdt rekening met wat iemand van die dag vindt', () => {
    expect(punten({ ...basis, wens: 'graag' })).toBeGreaterThan(punten(basis))
    expect(punten({ ...basis, wens: 'liever_niet' })).toBeLessThan(punten(basis))
  })

  it('spreidt het werk over de week', () => {
    expect(punten({ ...basis, dienstenDezeWeek: 3 })).toBeLessThan(
      punten({ ...basis, dienstenDezeWeek: 1 }),
    )
  })

  it('zet wie er niet de hele dienst is achteraan', () => {
    expect(punten({ ...basis, zachteBelemmering: true })).toBeLessThan(punten(basis))
  })
})

describe('het voorstel', () => {
  it('zet een vaste dienst neer zonder dat er iets te kiezen valt', () => {
    const vast: VasteDienst = {
      id: 'v1',
      medewerker_id: 'daan',
      dag: 6,
      soort: 'avond',
      begint: '17:00:00',
      eindigt: '20:00:00',
      opmerking: null,
    }
    const uit = maakVoorstel(opdracht({ vast: [vast], mensen: [EVI, DAAN] }))
    expect(uit).toHaveLength(1)
    expect(uit[0]).toMatchObject({ naam: 'Daan Test', reden: 'afspraak' })
  })

  /* Een afspraak is geen aanwezigheid. Wie verlof heeft staat er niet, en die
     plek hoort open te blijven zodat je hem ziet — niet stilletjes door een
     ander ingevuld, en al helemaal niet door de afwezige zelf. */
  it('laat een vaste dienst open als die persoon er niet is', () => {
    const vast: VasteDienst = {
      id: 'v1',
      medewerker_id: 'evi',
      dag: 6,
      soort: 'avond',
      begint: '17:00:00',
      eindigt: '20:00:00',
      opmerking: null,
    }
    const uit = maakVoorstel(opdracht({ vast: [vast], afwezig: [afwezig({})] }))
    expect(uit[0]).toMatchObject({ medewerker_id: null, reden: 'open' })
    expect(uit[0].uitleg).toContain('verlof')
  })

  it('verdeelt de overgebleven plekken en legt uit waarom', () => {
    const uit = maakVoorstel(
      opdracht({ sjabloon: [regel({ aantal: 1 })], mensen: [EVI], opgaven: [opgave({})] }),
    )
    expect(uit[0]).toMatchObject({ naam: 'Evi Test', reden: 'verdeeld' })
    expect(uit[0].uitleg).toContain('opgegeven')
  })

  it('zet niemand twee keer op dezelfde dag', () => {
    const uit = maakVoorstel(opdracht({ sjabloon: [regel({ aantal: 2 })], mensen: [EVI] }))
    expect(uit).toHaveLength(2)
    expect(uit.filter((d) => d.medewerker_id === 'evi')).toHaveLength(1)
    expect(uit.filter((d) => !d.medewerker_id)).toHaveLength(1)
  })

  /* Een lege plek is een vraag die je ziet; een verkeerde naam is een fout die
     je pas merkt als er niemand staat. */
  it('laat een plek open in plaats van te gokken', () => {
    const uit = maakVoorstel(opdracht({ afwezig: [afwezig({})] }))
    expect(uit[0]).toMatchObject({ medewerker_id: null, reden: 'open' })
  })

  it('plant niemand in die op die weekdag "nee" heeft gezegd', () => {
    const uit = maakVoorstel(
      opdracht({ mensen: [EVI], wensen: new Map([['evi', { 6: 'nee' as const }]]) }),
    )
    expect(uit[0].medewerker_id).toBeNull()
  })

  it('neemt iemand mee die deels beschikbaar is, met de waarschuwing erbij', () => {
    const uit = maakVoorstel(
      opdracht({ opgaven: [opgave({ status: 'partly_unavailable', opmerking: 'school' })] }),
    )
    expect(uit[0].medewerker_id).toBe('evi')
    expect(uit[0].waarschuwing).toContain('school')
  })

  /* Wie zijn beschikbaarheid nooit invult, hoort gewoon mee te doen. */
  it('kiest wie niets invult boven wie het bijhoudt maar zweeg', () => {
    const uit = maakVoorstel(
      opdracht({
        mensen: [EVI, BRIAN],
        // Evi houdt het bij maar liet zaterdag open; Brian vult nooit iets in.
        opgaven: [opgave({ datum: '2026-11-13', status: 'available' })],
      }),
    )
    expect(uit[0].naam).toBe('Brian Test')
    expect(uit[0].uitleg).toContain('vult geen beschikbaarheid in')
  })

  it('spreidt diensten over de week in plaats van dezelfde persoon te stapelen', () => {
    const uit = maakVoorstel(
      opdracht({
        van: '2026-11-13',
        tot: '2026-11-14',
        sjabloon: [regel({ dag: 5 }), regel({ dag: 6 })],
        mensen: [EVI, DAAN],
      }),
    )
    expect(new Set(uit.map((d) => d.medewerker_id)).size).toBe(2)
  })

  /* Twee keer draaien moet hetzelfde opleveren. Een rooster dat elke keer
     anders uitvalt kun je niet vergelijken met het vorige. */
  it('levert twee keer hetzelfde op', () => {
    const o = opdracht({ sjabloon: [regel({ aantal: 2 })], mensen: [EVI, DAAN, BRIAN] })
    expect(maakVoorstel(o)).toEqual(maakVoorstel(o))
  })

  it('maakt van een regel met aantal 3 ook drie plekken', () => {
    expect(maakVoorstel(opdracht({ sjabloon: [regel({ aantal: 3 })] }))).toHaveLength(3)
  })

  it('slaat een dag zonder sjabloonregels over', () => {
    // Maandag staat niet in het sjabloon: dan is de zaak dicht.
    expect(maakVoorstel(opdracht({ van: '2026-11-16', tot: '2026-11-16' }))).toEqual([])
  })
})

describe('de samenvatting', () => {
  it('telt wat er staat en wat er open bleef', () => {
    const uit = maakVoorstel(opdracht({ sjabloon: [regel({ aantal: 3 })], mensen: [EVI, DAAN] }))
    expect(samenvatten(uit)).toMatchObject({ diensten: 3, ingevuld: 2, open: 1 })
  })

  it('zet de drukste bovenaan', () => {
    const uit = maakVoorstel(
      opdracht({
        van: '2026-11-13',
        tot: '2026-11-14',
        sjabloon: [regel({ dag: 5 }), regel({ dag: 6 })],
        mensen: [EVI],
      }),
    )
    expect(samenvatten(uit).perPersoon[0]).toMatchObject({ naam: 'Evi Test', diensten: 2 })
  })
})

describe('de wenslijst', () => {
  it('zet de kolommen om naar weekdagnummers', () => {
    const uit = wensenUit([
      { persoon_id: 'brian', di: 'liever_niet', wo: 'graag', do: null, vr: 'graag', za: null, zo: null },
    ])
    expect(uit.get('brian')).toEqual({ 2: 'liever_niet', 3: 'graag', 5: 'graag' })
  })

  /* Van de dertien mensen hebben er twee iets ingevuld. Een lege kolom is geen
     "maakt niet uit" maar een onbekende: die hoort geen punten te geven en
     geen punten te kosten. */
  it('slaat iemand over die niets heeft ingevuld', () => {
    const uit = wensenUit([{ persoon_id: 'evi', di: null, wo: null, do: null, vr: null, za: null, zo: null }])
    expect(uit.has('evi')).toBe(false)
  })

  it('negeert een waarde die geen wens is', () => {
    const uit = wensenUit([{ persoon_id: 'evi', di: 'misschien', wo: 'graag' }])
    expect(uit.get('evi')).toEqual({ 3: 'graag' })
  })

  it('slaat een rij zonder persoon over', () => {
    expect(wensenUit([{ persoon_id: null, di: 'graag' }]).size).toBe(0)
  })
})

describe('het volgende roosterblok', () => {
  /* Vier weken, beginnend op de maandag over twee weken. Dat is het ritme dat
     in eitje staat: roosters van vier weken, twee weken van tevoren. */
  it('begint op de maandag over twee weken en duurt vier weken', () => {
    // Dinsdag 27 oktober 2026.
    expect(volgendBlok('2026-10-27')).toEqual({ van: '2026-11-09', tot: '2026-12-06' })
  })

  it('rekent vanaf de maandag, ook als je het op zondag opent', () => {
    // Zondag 1 november hoort bij de week van maandag 26 oktober.
    expect(volgendBlok('2026-11-01')).toEqual({ van: '2026-11-09', tot: '2026-12-06' })
  })
})
