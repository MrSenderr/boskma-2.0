/* Wat het loonbureau te doen krijgt.
 *
 * De toetsen draaien om twee vergissingen die geld kosten. Een contract laten
 * opstellen voor iemand die juist níet verlengt is er één. De andere is zwijgen
 * bij een einde dienstverband: dan loopt de loonstrook door. */

import { describe, expect, it } from 'vitest'
import { bouwContractverzoek, klaarVoorLoonbureau, uitkomstVan } from './contractverzoek'
import type { Contract } from './contracten'
import type { Voorstel } from './contractvoorstellen'
import type { Persoon } from './personeel'

const vorig = {
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
} as unknown as Contract

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
    uurloon: 8.25,
    functie: 'Medewerker fastservice II',
    gemiddelde_uren: null,
    uiterlijk: '2026-11-30',
    verstuurd_op: '2026-10-20T09:00:00Z',
    ontvangst_bevestigd_op: '2026-10-21T09:00:00Z',
    keuze_verlenging: null,
    keuze_verlenging_op: null,
    keuze_vaste_uren: null,
    keuze_vaste_uren_op: null,
    ingetrokken_op: null,
    naar_loonbureau_op: null,
    brief: null,
    op_papier: false,
    ...anders,
  }) as Voorstel

describe('wat het loonbureau moet doen', () => {
  it('vraagt een contract bij een geaccepteerde verlenging', () => {
    const u = uitkomstVan(v({ keuze_verlenging: 'akkoord' }), vorig)!
    expect(u.contractNodig).toBe(true)
    expect(u.titel).toBe('Verlenging')
    expect(u.regels[0]).toBe('Contract voor bepaalde tijd, van 1 januari 2027 tot en met 31 december 2027.')
    expect(u.regels).toContain('Uurloon € 8,25 bruto.')
  })

  it('schrijft de uren als zin, niet als fragment', () => {
    const oproep = uitkomstVan(v({ keuze_verlenging: 'akkoord' }), vorig)!
    expect(oproep.regels).toContain('Geen vaste uren; oproepkracht.')
    const bereik = uitkomstVan(
      v({ keuze_verlenging: 'akkoord', soort: 'min_max', uren_min: 4, uren_max: 12 }),
      vorig,
    )!
    expect(bereik.regels).toContain('4 tot 12 uur per week.')
  })

  it('schrijft bij onbepaalde tijd geen einddatum op', () => {
    const u = uitkomstVan(
      v({ keuze_verlenging: 'akkoord', duur: 'onbepaalde', eindigt: null }),
      vorig,
    )!
    expect(u.regels[0]).toBe('Contract voor onbepaalde tijd, ingaand 1 januari 2027.')
  })

  /* De dure vergissing de andere kant op: wie niet verlengt gaat uit dienst,
     en het loonbureau moet de laatste dag weten. */
  it('meldt een einde dienstverband met de laatste dag, zonder contract', () => {
    const u = uitkomstVan(v({ keuze_verlenging: 'niet_akkoord' }), vorig)!
    expect(u.contractNodig).toBe(false)
    expect(u.titel).toBe('Einde dienstverband')
    expect(u.regels).toContain('Laatste dag van het dienstverband: 31 december 2026.')
  })

  it('doet hetzelfde bij een voorstel om niet te verlengen', () => {
    const u = uitkomstVan(v({ aard: 'stoppen', keuze_verlenging: null }), vorig)!
    expect(u.contractNodig).toBe(false)
    expect(u.regels[0]).toBe('Het contract wordt niet verlengd.')
  })

  /* Zonder einddatum in de app niet gokken. Een verkeerde laatste dag is een
     verkeerde eindafrekening. */
  it('vraagt na als de laatste dag niet bekend is', () => {
    const u = uitkomstVan(v({ aard: 'stoppen' }), null)!
    expect(u.regels[1]).toMatch(/graag navragen/)
  })

  it('vraagt een contract bij aangenomen vaste uren', () => {
    const u = uitkomstVan(
      v({ aard: 'vaste_uren', soort: 'vaste_uren', uren_vast: 13.92, keuze_vaste_uren: 'aangenomen', duur: null, eindigt: null }),
      vorig,
    )!
    expect(u.contractNodig).toBe(true)
    expect(u.titel).toBe('Vaste uren')
    expect(u.regels[0]).toBe('Wijziging van de uren, ingaand 1 januari 2027.')
    expect(u.regels).toContain('13,92 vaste uren per week.')
  })

  it('meldt geweigerde vaste uren zonder contract', () => {
    const u = uitkomstVan(v({ aard: 'vaste_uren', keuze_vaste_uren: 'geweigerd' }), vorig)!
    expect(u.contractNodig).toBe(false)
    expect(u.titel).toBe('Blijft oproepkracht')
    expect(u.regels[1]).toMatch(/twaalf maanden/)
  })

  it('zet verlenging en vaste uren in één afspraak', () => {
    const u = uitkomstVan(
      v({
        aard: 'verlengen_en_vaste_uren',
        soort: 'vaste_uren',
        uren_vast: 14,
        keuze_verlenging: 'akkoord',
        keuze_vaste_uren: 'aangenomen',
      }),
      vorig,
    )!
    expect(u.titel).toBe('Verlenging met vaste uren')
    expect(u.regels).toContain('14 vaste uren per week.')
  })

  /* Verlengen én de uren weigeren mag: dan komt er een contract als
     oproepkracht. Zou het blad dan zwijgen over de uren, dan zou het loonbureau
     de aangeboden uren kunnen overnemen. */
  it('verlengt als oproepkracht wanneer de uren zijn geweigerd', () => {
    const u = uitkomstVan(
      v({
        aard: 'verlengen_en_vaste_uren',
        soort: 'vaste_uren',
        uren_vast: 14,
        keuze_verlenging: 'akkoord',
        keuze_vaste_uren: 'geweigerd',
      }),
      vorig,
    )!
    expect(u.contractNodig).toBe(true)
    expect(u.titel).toBe('Verlenging')
    expect(u.regels).toContain('Het aanbod voor vaste uren is geweigerd; geen vaste uren.')
    expect(u.regels.some((r) => r.includes('14'))).toBe(false)
  })

  it('geeft niets terug zolang er geen antwoord is', () => {
    expect(uitkomstVan(v(), vorig)).toBeNull()
  })
})

describe('mag het naar het loonbureau', () => {
  it('wacht tot elk antwoord binnen is', () => {
    expect(klaarVoorLoonbureau(v())).toBe(false)
    expect(klaarVoorLoonbureau(v({ keuze_verlenging: 'akkoord' }))).toBe(true)
  })

  it('wacht bij een dubbel voorstel op beide antwoorden', () => {
    const half = v({ aard: 'verlengen_en_vaste_uren', keuze_verlenging: 'akkoord' })
    expect(klaarVoorLoonbureau(half)).toBe(false)
    expect(klaarVoorLoonbureau({ ...half, keuze_vaste_uren: 'aangenomen' })).toBe(true)
  })

  /* Een afgewezen verlenging maakt de vraag over de uren overbodig: er komt
     geen contract waar die uren in horen. Blijven wachten zou betekenen dat
     een einde dienstverband nooit wordt gemeld. */
  it('wacht niet op de uren als de verlenging is afgewezen', () => {
    expect(
      klaarVoorLoonbureau(v({ aard: 'verlengen_en_vaste_uren', keuze_verlenging: 'niet_akkoord' })),
    ).toBe(true)
  })

  it('heeft bij stoppen alleen de ontvangstbevestiging nodig', () => {
    expect(klaarVoorLoonbureau(v({ aard: 'stoppen', ontvangst_bevestigd_op: null }))).toBe(false)
    expect(klaarVoorLoonbureau(v({ aard: 'stoppen' }))).toBe(true)
  })

  it('gaat één keer', () => {
    expect(
      klaarVoorLoonbureau(
        v({ keuze_verlenging: 'akkoord', naar_loonbureau_op: '2026-10-22T09:00:00Z' }),
      ),
    ).toBe(false)
  })

  it('gaat niet bij een concept of iets wat is ingetrokken', () => {
    expect(klaarVoorLoonbureau(v({ keuze_verlenging: 'akkoord', verstuurd_op: null }))).toBe(false)
    expect(
      klaarVoorLoonbureau(v({ keuze_verlenging: 'akkoord', ingetrokken_op: '2026-10-22T09:00:00Z' })),
    ).toBe(false)
  })
})

describe('het blad zelf', () => {
  const thijmen = {
    id: 'p1',
    voornaam: 'Thijmen',
    achternaam: 'Bakker',
    geboortedatum: '2008-11-10',
    in_dienst_sinds: '2026-01-01',
  } as unknown as Persoon

  const voorstel = v({ keuze_verlenging: 'akkoord', keuze_verlenging_op: '2026-10-22T09:00:00Z' })
  const blad = bouwContractverzoek({
    persoon: thijmen,
    voorstel,
    vorig,
    uitkomst: uitkomstVan(voorstel, vorig)!,
  })

  it('vraagt om het contract en zet de afspraak erin', () => {
    expect(blad).toContain('graag het contract opstellen')
    expect(blad).toContain('Thijmen Bakker')
    expect(blad).toContain('31 december 2027')
  })

  /* Het loonbureau stelt een contract op; wanneer het voorstel is verstuurd,
     wanneer het is gelezen en wat er precies is aangeboden doet daar niets
     toe. Dat spoor staat in de app en in het dossier. Stond hier tot
     25 oktober 2026 wel op, en dat was een halve bladzijde ruis. */
  it('bevat geen bewijsspoor en niet de brief zelf', () => {
    expect(blad).not.toContain('Akkoord op')
    expect(blad).not.toContain('Voorstel verstuurd')
    expect(blad).not.toContain('Gelezen door medewerker')
    expect(blad).not.toContain('Wat is aangeboden')
    expect(blad).not.toContain('Gemiddelde waarop het aanbod rust')
  })

  /* Het loonbureau heeft het BSN en het identiteitsbewijs al. Wat je niet hoeft
     te versturen verstuur je niet. */
  it('bevat geen BSN, adres of identiteitsbewijs', () => {
    expect(blad).not.toMatch(/BSN|IBAN|Adres|identiteitsbewijs/i)
  })

  it('zegt bij een einde dienstverband dat er geen contract nodig is', () => {
    const stop = v({ aard: 'stoppen' })
    const b = bouwContractverzoek({
      persoon: thijmen,
      voorstel: stop,
      vorig,
      uitkomst: uitkomstVan(stop, vorig)!,
    })
    expect(b).toContain('hoeft geen contract te worden opgesteld')
    expect(b).toContain('Einde dienstverband')
  })
})
