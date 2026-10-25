/* Het voorstel wordt een contract.
 *
 * De toets die hier het zwaarst weegt: een aangenomen aanbod vaste uren mag
 * géén extra schakel in de keten opleveren. Zou dat wel gebeuren, dan telt de
 * app een contract te veel en zegt hij bij de volgende verlenging dat die
 * vanzelf vast wordt — terwijl dat niet zo is. Dan bied je onbepaalde tijd aan
 * zonder dat het hoefde. */

import { describe, expect, it } from 'vitest'
import { afrondingVan, voorstelVoorContract } from './afronden'
import { ketenVan, type Contract } from './contracten'
import type { Voorstel } from './contractvoorstellen'

const lopend = {
  id: 'c1',
  medewerker_id: 'p1',
  werkgever: 'boskma',
  soort: 'nuluren',
  duur: 'bepaalde',
  begint: '2026-01-01',
  eindigt: '2026-12-31',
  uren_vast: null,
  uren_min: null,
  uren_max: null,
  uurloon: 8.25,
  functie: 'Medewerker fastservice II',
  proefperiode: null,
  beeindigd_op: null,
  beeindigd_reden: null,
  document_id: null,
  bron: 'overgenomen',
  opmerking: null,
} as Contract

const v = (anders: Partial<Voorstel> = {}): Voorstel =>
  ({
    id: 'v1',
    medewerker_id: 'p1',
    vorig_contract_id: 'c1',
    aard: 'verlengen',
    soort: 'nuluren',
    duur: 'bepaalde',
    begint: '2027-01-01',
    eindigt: '2027-12-31',
    uren_vast: null,
    uren_min: null,
    uren_max: null,
    uurloon: 8.5,
    functie: 'Medewerker fastservice II',
    gemiddelde_uren: null,
    gemiddelde_bron: null,
    gemiddelde_over: null,
    opgesteld_op: '2026-10-25T09:00:00Z',
    verstuurd_op: '2026-10-25T09:05:00Z',
    keuze_verlenging: null,
    keuze_vaste_uren: null,
    ingetrokken_op: null,
    contract_id: null,
    ...anders,
  }) as Voorstel

describe('wat er met de geschiedenis moet gebeuren', () => {
  it('maakt van een geaccepteerde verlenging een nieuw contract', () => {
    const uit = afrondingVan(v({ keuze_verlenging: 'akkoord' }), lopend)
    expect(uit.wat).toBe('nieuw')
    if (uit.wat !== 'nieuw') return
    expect(uit.contract.begint).toBe('2027-01-01')
    expect(uit.contract.eindigt).toBe('2027-12-31')
    expect(uit.contract.soort).toBe('nuluren')
    expect(uit.contract.uurloon).toBe(8.5)
    expect(uit.contract.bron).toBe('voorstel')
  })

  it('laat de einddatum weg bij onbepaalde tijd', () => {
    const uit = afrondingVan(
      v({ keuze_verlenging: 'akkoord', duur: 'onbepaalde', eindigt: null }),
      lopend,
    )
    expect(uit.wat).toBe('nieuw')
    if (uit.wat !== 'nieuw') return
    expect(uit.contract.eindigt).toBeNull()
  })

  it('maakt van verlengen én vaste uren één contract met vaste uren', () => {
    const uit = afrondingVan(
      v({
        aard: 'verlengen_en_vaste_uren',
        soort: 'vaste_uren',
        uren_vast: 14,
        keuze_verlenging: 'akkoord',
        keuze_vaste_uren: 'aangenomen',
      }),
      lopend,
    )
    expect(uit.wat).toBe('nieuw')
    if (uit.wat !== 'nieuw') return
    expect(uit.contract.soort).toBe('vaste_uren')
    expect(uit.contract.uren_vast).toBe(14)
  })

  /* Verlengen én de uren weigeren: een nieuw contract als oproepkracht. In het
     voorstel stond 'vaste uren', maar dat ging over het áánbod. Dat overnemen
     zou een contract opleveren met precies de uren die hij net afwees. */
  it('verlengt als oproepkracht wanneer de uren zijn geweigerd', () => {
    const uit = afrondingVan(
      v({
        aard: 'verlengen_en_vaste_uren',
        soort: 'vaste_uren',
        uren_vast: 14,
        keuze_verlenging: 'akkoord',
        keuze_vaste_uren: 'geweigerd',
      }),
      lopend,
    )
    expect(uit.wat).toBe('nieuw')
    if (uit.wat !== 'nieuw') return
    expect(uit.contract.soort).toBe('nuluren')
    expect(uit.contract.uren_vast).toBeNull()
    expect(uit.contract.opmerking).toMatch(/geweigerd/)
  })

  /* De kern. Alleen vaste uren aangenomen is een wijziging van het lopende
     contract, geen nieuw contract. */
  it('werkt bij een los aanbod vaste uren het lopende contract bij', () => {
    const uit = afrondingVan(
      v({
        aard: 'vaste_uren',
        soort: 'vaste_uren',
        duur: null,
        eindigt: null,
        uren_vast: 13.92,
        keuze_vaste_uren: 'aangenomen',
      }),
      lopend,
    )
    expect(uit.wat).toBe('bijwerken')
    if (uit.wat !== 'bijwerken') return
    expect(uit.contractId).toBe('c1')
    expect(uit.velden.soort).toBe('vaste_uren')
    expect(uit.velden.uren_vast).toBe(13.92)
    expect(uit.velden.opmerking).toMatch(/13,92 uur per week/)
    expect(uit.velden.opmerking).toMatch(/1 januari 2027/)
  })

  /* Waar het om gaat: de keten wordt er niet langer van. Met een extra rij zou
     de app bij de volgende verlenging zeggen dat die vanzelf vast wordt. */
  it('maakt de keten niet langer bij een aangenomen aanbod vaste uren', () => {
    const drie = [
      { ...lopend, id: 'a', begint: '2024-01-01', eindigt: '2024-12-31' },
      { ...lopend, id: 'b', begint: '2025-01-01', eindigt: '2025-12-31' },
      { ...lopend, id: 'c1' },
    ] as Contract[]
    const voor = ketenVan(drie, '2026-10-25')

    const uit = afrondingVan(
      v({ aard: 'vaste_uren', uren_vast: 14, keuze_vaste_uren: 'aangenomen' }),
      drie[2],
    )
    expect(uit.wat).toBe('bijwerken')

    // Bijwerken verandert een bestaande rij; het aantal blijft drie.
    const na = ketenVan(
      drie.map((c) => (c.id === 'c1' ? { ...c, soort: 'vaste_uren' as const } : c)),
      '2026-10-25',
    )
    expect(na.aantal).toBe(voor.aantal)
  })

  it('doet niets bij stoppen of een afgewezen verlenging', () => {
    expect(afrondingVan(v({ aard: 'stoppen' }), lopend).wat).toBe('niets')
    expect(afrondingVan(v({ keuze_verlenging: 'niet_akkoord' }), lopend).wat).toBe('niets')
  })

  it('doet niets zolang er geen antwoord is', () => {
    const uit = afrondingVan(v(), lopend)
    expect(uit.wat).toBe('niets')
    if (uit.wat !== 'niets') return
    expect(uit.reden).toMatch(/nog niets aangenomen/)
  })

  it('doet niets bij een ingetrokken voorstel', () => {
    expect(afrondingVan(v({ keuze_verlenging: 'akkoord', ingetrokken_op: 'x' }), lopend).wat).toBe(
      'niets',
    )
  })

  /* Zonder lopend contract valt er niets bij te werken, en gokken welk contract
     bedoeld is zou de verkeerde rij kunnen raken. */
  it('zegt het als er geen lopend contract is om bij te werken', () => {
    const uit = afrondingVan(
      v({ aard: 'vaste_uren', uren_vast: 14, keuze_vaste_uren: 'aangenomen' }),
      null,
    )
    expect(uit.wat).toBe('niets')
    if (uit.wat !== 'niets') return
    expect(uit.reden).toMatch(/geen lopend contract/)
  })
})

describe('welk voorstel bij een getekend contract hoort', () => {
  it('neemt het nieuwste beantwoorde voorstel zonder contract', () => {
    const oud = v({ id: 'oud', opgesteld_op: '2026-01-01T09:00:00Z', keuze_verlenging: 'akkoord' })
    const nieuw = v({ id: 'nieuw', opgesteld_op: '2026-10-01T09:00:00Z', keuze_verlenging: 'akkoord' })
    expect(voorstelVoorContract([oud, nieuw])?.id).toBe('nieuw')
  })

  it('slaat over wat al een contract heeft, is ingetrokken of niet beantwoord', () => {
    expect(voorstelVoorContract([v({ keuze_verlenging: 'akkoord', contract_id: 'c9' })])).toBeNull()
    expect(voorstelVoorContract([v({ keuze_verlenging: 'akkoord', ingetrokken_op: 'x' })])).toBeNull()
    expect(voorstelVoorContract([v()])).toBeNull()
    // Een afgewezen verlenging levert geen contract op.
    expect(voorstelVoorContract([v({ keuze_verlenging: 'niet_akkoord' })])).toBeNull()
  })
})
