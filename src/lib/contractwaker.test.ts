/* De contractwaker. Een dag ernaast betekent een aanzegging die te laat komt,
   en dat kost een maandloon.

   Rekent sinds 25 oktober 2026 met de contracttabel. De oude toetsen staan er
   nog, nu met contracten in plaats van kaartvelden; daar zijn de gevallen bij
   gekomen die vóór die omzetting stil bleven. */

import { describe, expect, it } from 'vitest'
import {
  dagenTussen,
  plusMaanden,
  signalen,
  signalenVoor,
  ketenTekst,
  voorstelSignalen,
} from './contractwaker'
import type { Voorstel } from './contractvoorstellen'
import type { Contract } from './contracten'
import type { Persoon } from './personeel'

function persoon(extra: Partial<Persoon>): Persoon {
  return {
    id: 'p1',
    voornaam: 'Test',
    achternaam: 'Persoon',
    status: 'aangenomen',
    fase: 'medewerker',
    aangemeld_op: null,
    aangenomen_op: null,
    onboarding_verstuurd_op: null,
    onboarding_ingevuld_op: null,
    loonbureau_verstuurd_op: null,
    loonbureau_bevestigd_op: null,
    uit_dienst_op: null,
    is_eigenaar: false,
    in_dienst_sinds: null,
    ...extra,
  }
}

let teller = 0
function contract(extra: Partial<Contract>): Contract {
  return {
    id: `c${++teller}`,
    medewerker_id: 'p1',
    werkgever: 'boskma',
    soort: 'vaste_uren',
    duur: 'bepaalde',
    begint: '2026-01-01',
    eindigt: '2026-12-31',
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
    ...extra,
  }
}

describe('datums', () => {
  it('telt maanden op en houdt het einde van de maand heel', () => {
    expect(plusMaanden('2026-01-31', 1)).toBe('2026-02-28')
    expect(plusMaanden('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('telt dagen over de zomertijd heen', () => {
    expect(dagenTussen('2026-03-28', '2026-03-30')).toBe(2)
  })
})

describe('aanzeggen', () => {
  const p = persoon({})
  const jaarcontract = [contract({ begint: '2026-01-01', eindigt: '2026-12-31' })]

  it('verschijnt zes weken voor de aanzegdatum', () => {
    expect(signalenVoor(p, jaarcontract, '2026-10-18')).toHaveLength(0)
    const [s] = signalenVoor(p, jaarcontract, '2026-10-19')
    expect(s.soort).toBe('aanzeggen')
    expect(s.uiterlijk).toBe('2026-11-30')
    expect(s.ernst).toBe('letop')
  })

  it('wordt rood in de laatste week en blijft staan tot de einddatum', () => {
    expect(signalenVoor(p, jaarcontract, '2026-11-25')[0].ernst).toBe('fout')
    const teLaat = signalenVoor(p, jaarcontract, '2026-12-10')[0]
    expect(teLaat.dagen).toBeLessThan(0)
    expect(teLaat.wat).toMatch(/voorbij/)
    expect(signalenVoor(p, jaarcontract, '2027-01-01')).toHaveLength(0)
  })

  it('telt een half jaar als zes maanden', () => {
    const half = [contract({ begint: '2026-11-01', eindigt: '2027-04-30' })]
    expect(signalenVoor(p, half, '2027-03-15')[0].soort).toBe('aanzeggen')
  })

  it('geeft bij een kort contract alleen het einde', () => {
    const kort = [contract({ begint: '2026-11-01', eindigt: '2027-01-31' })]
    const [s] = signalenVoor(p, kort, '2027-01-01')
    expect(s.soort).toBe('einde')
    expect(s.dagen).toBe(30)
  })

  it('negeert onbepaalde tijd', () => {
    const vast = [contract({ soort: 'vaste_uren', duur: 'onbepaalde', eindigt: null })]
    expect(signalenVoor(p, vast, '2026-12-01')).toHaveLength(0)
  })

  /* De aanzegtermijn hoort bij het lopende contract. Een afgelopen contract
     uit 2025 mag geen melding meer geven. */
  it('kijkt naar het contract dat nu loopt, niet naar een oud', () => {
    const twee = [
      contract({ begint: '2025-01-01', eindigt: '2025-12-31' }),
      contract({ begint: '2026-01-01', eindigt: '2026-12-31' }),
    ]
    const uit = signalenVoor(p, twee, '2026-11-25')
    expect(uit).toHaveLength(1)
    expect(uit[0].uiterlijk).toBe('2026-11-30')
  })

  it('zegt bij het seintje hoeveelste contract het is', () => {
    const drie = [
      contract({ begint: '2024-01-01', eindigt: '2024-12-31' }),
      contract({ begint: '2025-01-01', eindigt: '2025-12-31' }),
      contract({ begint: '2026-01-01', eindigt: '2026-12-31' }),
    ]
    const [s] = signalenVoor(p, drie, '2026-11-25')
    expect(s.ketenNummer).toBe(3)
    expect(s.volgendeWordtVast).toBe(true)
    expect(ketenTekst(s)).toBe('Contract 3 van 3')
  })
})

describe('twaalf maanden oproep', () => {
  const oproep = [contract({ soort: 'nuluren', duur: 'onbepaalde', begint: '2026-07-16', eindigt: null })]
  const p = persoon({ in_dienst_sinds: '2026-07-16' })

  it('verschijnt vier weken voor het jaar', () => {
    expect(signalenVoor(p, oproep, '2027-06-17')).toHaveLength(0)
    const [s] = signalenVoor(p, oproep, '2027-06-18')
    expect(s.soort).toBe('vaste_uren')
    expect(s.uiterlijk).toBe('2027-08-16')
  })

  it('geldt niet voor vaste uren', () => {
    const vast = [contract({ soort: 'vaste_uren', duur: 'onbepaalde', eindigt: null })]
    expect(signalenVoor(p, vast, '2027-07-01')).toHaveLength(0)
  })

  /* Hier zweeg de waker vóór 25 oktober 2026. Het raam van één maand viel
     dicht en daarna hoorde je er nooit meer iets over, terwijl de
     verplichting gewoon bleef staan — bij Ilona al sinds 2020. */
  it('blijft melden als de maand voorbij is, en wordt rood', () => {
    const [s] = signalenVoor(p, oproep, '2027-10-16')
    expect(s.soort).toBe('vaste_uren')
    expect(s.ernst).toBe('fout')
    expect(s.dagen).toBeLessThan(0)
    expect(s.wat).toMatch(/over tijd/)
  })

  it('zegt hoeveel maanden het al over tijd is', () => {
    const [s] = signalenVoor(p, oproep, '2028-08-16')
    expect(s.wat).toMatch(/12 maanden geleden al verplicht/)
  })

  /* Bij een overgenomen medewerker begon de telling bij de vorige eigenaar.
     Denzel is in dienst sinds 2023; zijn Kai-contract is van 2026. */
  it('rekent vanaf de dag dat iemand begon, niet vanaf zijn contract', () => {
    const denzel = persoon({ in_dienst_sinds: '2023-03-15' })
    const kai = [
      contract({ werkgever: 'kai', soort: 'nuluren', duur: 'onbepaalde', begint: '2026-03-25', eindigt: null }),
    ]
    const [s] = signalenVoor(denzel, kai, '2026-10-25')
    expect(s.soort).toBe('vaste_uren')
    expect(s.ernst).toBe('fout')
    expect(s.uiterlijk).toBe('2024-04-15')
  })

  it('valt terug op het oudste contract als in dienst sinds leeg is', () => {
    const zonder = persoon({ in_dienst_sinds: null })
    const [s] = signalenVoor(zonder, oproep, '2027-10-16')
    expect(s.uiterlijk).toBe('2027-08-16')
  })
})

describe('geen contract vastgelegd', () => {
  /* De waker leest nu uit een tabel die leeg kan zijn. Stil blijven zou
     betekenen dat juist de slechtst bijgehouden medewerker geen seintje
     oplevert. */
  it('meldt dat er niets te rekenen valt', () => {
    const [s] = signalenVoor(persoon({}), [], '2026-10-25')
    expect(s.soort).toBe('geen_contract')
    expect(s.ernst).toBe('letop')
  })

  it('meldt verder niets, ook geen verjaardag', () => {
    const p = persoon({ geboortedatum: '2010-11-05' })
    expect(signalenVoor(p, [], '2026-10-25')).toHaveLength(1)
  })
})

describe('verjaardag', () => {
  const vast = [contract({ soort: 'vaste_uren', duur: 'onbepaalde', eindigt: null })]

  it('seint twee weken vooruit tot en met 21', () => {
    const p = persoon({ geboortedatum: '2010-11-05' })
    expect(signalenVoor(p, vast, '2026-10-21')).toHaveLength(0)
    const [s] = signalenVoor(p, vast, '2026-10-22')
    expect(s.wat).toBe('Wordt 16 — uurloon en werktijden nakijken')
  })

  it('gaat over de jaargrens', () => {
    const p = persoon({ geboortedatum: '2008-01-03' })
    expect(signalenVoor(p, vast, '2026-12-25')[0].wat).toBe('Wordt 19 — uurloon nakijken')
  })

  it('zwijgt vanaf 22', () => {
    expect(signalenVoor(persoon({ geboortedatum: '2004-11-05' }), vast, '2026-11-01')).toHaveLength(0)
  })
})

describe('wie meetelt', () => {
  const vast = [contract({ soort: 'vaste_uren', duur: 'onbepaalde', eindigt: null })]

  it('slaat sollicitanten, uit dienst en de eigenaar over', () => {
    const basis = { geboortedatum: '2010-11-05' }
    expect(signalenVoor(persoon({ ...basis, fase: 'sollicitant' }), vast, '2026-11-01')).toHaveLength(0)
    expect(signalenVoor(persoon({ ...basis, uit_dienst_op: '2026-10-01' }), vast, '2026-11-01')).toHaveLength(0)
    expect(signalenVoor(persoon({ ...basis, is_eigenaar: true }), vast, '2026-11-01')).toHaveLength(0)
  })

  it('zet het dringendste bovenaan', () => {
    const a = persoon({ id: 'a', voornaam: 'A', geboortedatum: '2010-11-10' })
    const b = persoon({ id: 'b', voornaam: 'B', geboortedatum: '2010-11-03' })
    const per = new Map([
      ['a', [contract({ medewerker_id: 'a', duur: 'onbepaalde', eindigt: null })]],
      ['b', [contract({ medewerker_id: 'b', duur: 'onbepaalde', eindigt: null })]],
    ])
    expect(signalen([a, b], per, '2026-11-01').map((s) => s.persoonId)).toEqual(['b', 'a'])
  })
})

describe('voorstellen die blijven liggen', () => {
  const thijmen = { id: 'p1', voornaam: 'Thijmen', achternaam: 'Bakker' } as unknown as Persoon
  const v = (anders: Partial<Voorstel> = {}): Voorstel =>
    ({
      id: 'v1',
      medewerker_id: 'p1',
      aard: 'verlengen',
      uiterlijk: '2026-11-30',
      verstuurd_op: '2026-10-20T10:00:00Z',
      ingetrokken_op: null,
      ontvangst_bevestigd_op: null,
      op_papier: false,
      ...anders,
    }) as Voorstel

  it('meldt niets zolang er tijd is', () => {
    expect(voorstelSignalen([thijmen], [v()], '2026-10-25')).toEqual([])
  })

  it('vraagt eerst om een gesprek en daarna om papier', () => {
    const vroeg = voorstelSignalen([thijmen], [v()], '2026-11-16')
    expect(vroeg[0].ernst).toBe('letop')
    expect(vroeg[0].wat).toMatch(/spreek hem erop aan/)

    const laat = voorstelSignalen([thijmen], [v()], '2026-11-25')
    expect(laat[0].ernst).toBe('fout')
    expect(laat[0].wat).toMatch(/op papier/)
    expect(laat[0].naam).toBe('Thijmen Bakker')
    expect(laat[0].soort).toBe('voorstel_stil')
  })

  /* Een voorstel van iemand die niet in de lijst staat — uit dienst, of de
     eigenaar — hoort niet op het startscherm. Zonder deze regel zou er een
     seintje staan zonder naam. */
  it('slaat een voorstel over van iemand die niet in de lijst staat', () => {
    expect(voorstelSignalen([], [v()], '2026-11-25')).toEqual([])
  })
})
