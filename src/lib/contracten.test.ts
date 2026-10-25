/* De ketenregeling.
 *
 * Een fout hier is duur: tel je een contract te weinig, dan bied je een vierde
 * tijdelijk contract aan dat van rechtswege vast is geworden. Tel je er een te
 * veel, dan bied je onnodig een vast contract aan. Vandaar dat dit stuk los
 * van het scherm staat en hier wordt nagerekend. */

import { describe, expect, it } from 'vitest'
import { eindeVan, ketenVan, urenTekst, type Contract } from './contracten'

let teller = 0
const c = (anders: Partial<Contract>): Contract => ({
  id: `c${++teller}`,
  medewerker_id: 'm1',
  werkgever: 'boskma',
  soort: 'nuluren',
  duur: 'bepaalde',
  begint: '2024-01-01',
  eindigt: '2024-12-31',
  uren_vast: null,
  uren_min: null,
  uren_max: null,
  uurloon: null,
  functie: null,
  proefperiode: null,
  beeindigd_op: null,
  beeindigd_reden: null,
  document_id: null,
  bron: 'handmatig',
  opmerking: null,
  ...anders,
})

const vandaag = '2026-10-25'

describe('tellen van de keten', () => {
  it('telt drie contracten achter elkaar als 1, 2, 3', () => {
    const keten = ketenVan(
      [
        c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
        c({ begint: '2025-01-01', eindigt: '2025-12-31' }),
        c({ begint: '2026-01-01', eindigt: '2026-12-31' }),
      ],
      vandaag,
    )
    expect(keten.schakels.map((s) => s.nummer)).toEqual([1, 2, 3])
    expect(keten.aantal).toBe(3)
  })

  it('zegt dat een volgend contract vanzelf vast wordt na drie', () => {
    const keten = ketenVan(
      [
        c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
        c({ begint: '2025-01-01', eindigt: '2025-12-31' }),
        c({ begint: '2026-01-01', eindigt: '2026-12-31' }),
      ],
      vandaag,
    )
    expect(keten.volgendeWordtVast).toBe(true)
    expect(keten.reden).toMatch(/contract 3 van 3/)
  })

  it('zwijgt bij twee contracten', () => {
    const keten = ketenVan(
      [c({ begint: '2025-01-01', eindigt: '2025-12-31' }), c({ begint: '2026-01-01', eindigt: '2026-12-31' })],
      vandaag,
    )
    expect(keten.volgendeWordtVast).toBe(false)
    expect(keten.reden).toBeNull()
  })

  /* Een pauze van meer dan zes maanden zet de telling op nul. Precies zes
     maanden is niet genoeg — "meer dan" staat er. */
  it('begint opnieuw na een pauze van meer dan zes maanden', () => {
    const keten = ketenVan(
      [
        c({ begint: '2023-01-01', eindigt: '2023-12-31' }),
        c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
        // Ruim zeven maanden stil.
        c({ begint: '2025-08-15', eindigt: '2026-08-14' }),
      ],
      vandaag,
    )
    expect(keten.schakels.map((s) => s.nummer)).toEqual([1, 2, 1])
    expect(keten.schakels[2].nieuweKeten).toBe(true)
    expect(keten.aantal).toBe(1)
  })

  it('telt door bij een pauze van precies zes maanden', () => {
    const keten = ketenVan(
      [
        c({ begint: '2025-01-01', eindigt: '2025-06-30' }),
        // 31 december is precies zes maanden na 30 juni; nog net dezelfde keten.
        c({ begint: '2025-12-30', eindigt: '2026-12-29' }),
      ],
      vandaag,
    )
    expect(keten.schakels.map((s) => s.nummer)).toEqual([1, 2])
  })

  it('rekent de pauze in dagen uit', () => {
    const keten = ketenVan(
      [c({ begint: '2025-01-01', eindigt: '2025-06-30' }), c({ begint: '2025-07-10' })],
      vandaag,
    )
    expect(keten.schakels[1].pauze).toBe(10)
  })
})

describe('drie jaar', () => {
  it('weet wanneer de keten drie jaar wordt', () => {
    const keten = ketenVan([c({ begint: '2024-03-01', eindigt: '2025-02-28' })], vandaag)
    expect(keten.begonOp).toBe('2024-03-01')
    expect(keten.driejaarOp).toBe('2027-03-01')
  })

  /* Over de drie jaar heen is het net zo goed vast, ook bij twee contracten. */
  it('meldt het ook als de drie jaar voorbij zijn bij minder dan drie contracten', () => {
    const keten = ketenVan(
      [
        c({ begint: '2022-01-01', eindigt: '2024-01-01' }),
        c({ begint: '2024-01-02', eindigt: '2026-12-31' }),
      ],
      vandaag,
    )
    expect(keten.aantal).toBe(2)
    expect(keten.volgendeWordtVast).toBe(true)
    expect(keten.reden).toMatch(/drie jaar/)
  })
})

describe('een vast contract', () => {
  it('breekt de telling en maakt de vraag overbodig', () => {
    const keten = ketenVan(
      [
        c({ begint: '2024-01-01', eindigt: '2024-12-31' }),
        c({ begint: '2025-01-01', eindigt: null, duur: 'onbepaalde' }),
      ],
      vandaag,
    )
    expect(keten.heeftVast).toBe(true)
    expect(keten.volgendeWordtVast).toBe(false)
    expect(keten.aantal).toBe(0)
  })

  it('geeft een vast contract geen nummer in de keten', () => {
    const keten = ketenVan([c({ duur: 'onbepaalde', eindigt: null })], vandaag)
    expect(keten.schakels[0].nummer).toBe(0)
  })
})

describe('contracten bij de vorige eigenaar', () => {
  /* Bij een overname telt de tijd bij Kai mee (opvolgend werkgeverschap).
     Voor de telling maakt de werkgever dus niets uit. */
  it('tellen gewoon mee in de keten', () => {
    const keten = ketenVan(
      [
        c({ werkgever: 'kai', begint: '2025-01-01', eindigt: '2025-12-31' }),
        c({ werkgever: 'boskma', begint: '2026-01-01', eindigt: '2026-12-31' }),
      ],
      vandaag,
    )
    expect(keten.schakels.map((s) => s.nummer)).toEqual([1, 2])
  })
})

describe('losse dingen', () => {
  it('zet de volgorde goed, ook als ze door elkaar binnenkomen', () => {
    const keten = ketenVan(
      [c({ begint: '2026-01-01', eindigt: '2026-12-31' }), c({ begint: '2025-01-01', eindigt: '2025-12-31' })],
      vandaag,
    )
    expect(keten.schakels.map((s) => s.contract.begint)).toEqual(['2025-01-01', '2026-01-01'])
  })

  it('doet niets vreemds zonder contracten', () => {
    const keten = ketenVan([], vandaag)
    expect(keten).toMatchObject({ aantal: 0, schakels: [], volgendeWordtVast: false, reden: null })
  })

  /* Een contract dat eerder afliep dan de einddatum telt vanaf dat moment,
     anders lijkt een pauze korter dan hij was. */
  it('rekent met de dag dat het echt ophield', () => {
    const vroeg = c({ begint: '2025-01-01', eindigt: '2025-12-31', beeindigd_op: '2025-03-01' })
    expect(eindeVan(vroeg)).toBe('2025-03-01')
    const keten = ketenVan([vroeg, c({ begint: '2025-10-01', eindigt: '2026-09-30' })], vandaag)
    expect(keten.schakels[1].nieuweKeten).toBe(true)
  })

  it('schrijft de uren op per soort contract', () => {
    expect(urenTekst(c({ soort: 'nuluren' }))).toBe('geen vaste uren')
    expect(urenTekst(c({ soort: 'vaste_uren', uren_vast: 32 }))).toBe('32 uur per week')
    expect(urenTekst(c({ soort: 'min_max', uren_min: 10, uren_max: 40 }))).toBe('10 tot 40 uur per week')
    expect(urenTekst(c({ soort: 'bandbreedte', uren_min: 10, uren_max: 13 }))).toBe('10 tot 13 uur per week')
    expect(urenTekst(c({ soort: 'vaste_uren' }))).toBe('uren onbekend')
  })
})
