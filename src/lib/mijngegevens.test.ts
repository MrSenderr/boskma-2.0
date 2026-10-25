/* Wat de medewerker zelf wijzigt.
 *
 * Eén vraag telt hier: moet het loonbureau dit horen? Zegt de app ten onrechte
 * nee, dan gaat de loonstrook naar het oude adres of het loon naar de oude
 * rekening. Zegt hij ten onrechte ja, dan blijft er een melding staan waar
 * niemand iets mee kan. */

import { describe, expect, it } from 'vitest'
import { NAAR_LOONBUREAU, moetNaarLoonbureau, type Wijziging } from './mijngegevens'

const w = (anders: Partial<Wijziging>): Wijziging =>
  ({
    id: 1,
    medewerker_id: 'p1',
    veld: 'iban',
    oude_waarde: 'NL00BANK0000000001',
    nieuwe_waarde: 'NL00BANK0000000002',
    goedkeuring_nodig: true,
    status: 'doorgevoerd',
    aangevraagd_op: '2026-10-20T09:00:00Z',
    verwerkt_op: '2026-10-21T09:00:00Z',
    naar_loonbureau_op: null,
    ...anders,
  }) as Wijziging

describe('moet het loonbureau dit horen', () => {
  it('ja bij een rekeningnummer en bij een adres', () => {
    expect(moetNaarLoonbureau(w({}))).toBe(true)
    expect(moetNaarLoonbureau(w({ veld: 'woonplaats', goedkeuring_nodig: false }))).toBe(true)
  })

  /* Een kledingmaat of noodcontact raakt de loonbetaling niet. Daar een
     melding van maken betekent dat de echte melding tussen de ruis verdwijnt. */
  it('nee bij velden die hen niet aangaan', () => {
    expect(moetNaarLoonbureau(w({ veld: 'tshirt_maat', goedkeuring_nodig: false }))).toBe(false)
    expect(moetNaarLoonbureau(w({ veld: 'noodcontact_tel', goedkeuring_nodig: false }))).toBe(false)
    expect(moetNaarLoonbureau(w({ veld: 'telefoonnummer', goedkeuring_nodig: false }))).toBe(false)
  })

  /* Een verzoek dat nog op akkoord wacht is nog niet doorgevoerd. Dat alvast
     doorgeven zou betekenen dat het loonbureau een rekeningnummer krijgt dat
     jij misschien afwijst. */
  it('nee zolang het nog op akkoord wacht', () => {
    expect(moetNaarLoonbureau(w({ status: 'open' }))).toBe(false)
  })

  it('ja zodra het is goedgekeurd', () => {
    expect(moetNaarLoonbureau(w({ status: 'doorgevoerd' }))).toBe(true)
  })

  // Een afgewezen wijziging is niet doorgevoerd; er is niets om door te geven.
  it('nee bij een afgewezen wijziging', () => {
    expect(moetNaarLoonbureau(w({ status: 'afgewezen' }))).toBe(false)
  })

  it('nee als het al is doorgegeven', () => {
    expect(moetNaarLoonbureau(w({ naar_loonbureau_op: '2026-10-22T09:00:00Z' }))).toBe(false)
  })

  /* Een veld dat meteen wordt doorgevoerd zonder akkoord — zoals een adres —
     moet er wél meteen in, want de wijziging staat al in de gegevens. */
  it('ja bij een adres dat meteen is doorgevoerd', () => {
    expect(
      moetNaarLoonbureau(w({ veld: 'straat', goedkeuring_nodig: false, status: 'open' })),
    ).toBe(true)
  })
})

describe('welke velden het loonbureau aangaan', () => {
  it('zijn het adres en het rekeningnummer', () => {
    expect(NAAR_LOONBUREAU).toContain('iban')
    expect(NAAR_LOONBUREAU).toContain('postcode')
    expect(NAAR_LOONBUREAU).not.toContain('tshirt_maat')
    /* Een mailadres wacht wel op akkoord maar hoeft niet naar het loonbureau;
       daar mailt de app zelf mee, niet zij. */
    expect(NAAR_LOONBUREAU).not.toContain('email')
  })
})
