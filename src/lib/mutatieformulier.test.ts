/* Het mutatieformulier naar het loonbureau.
 *
 * De toets die hier het zwaarst weegt: de voorwaarden komen uit het contract
 * dat in de app staat, niet uit de losse velden op de persoonskaart. Tot
 * 25 oktober 2026 stonden ze op twee plekken, en dan kan wat je op het scherm
 * ziet iets anders zijn dan wat het loonbureau krijgt. */

import { describe, expect, it } from 'vitest'
import { bouwMutatieformulier } from './mutatieformulier'
import type { Contract } from './contracten'
import type { Persoon } from './personeel'

/* Op de kaart staat nog een oude afspraak; in de contractentabel de nieuwe.
   Zo is aan het formulier te zien welke van de twee is gebruikt. */
const thijmen = {
  id: 'p1',
  voornaam: 'Thijmen',
  achternaam: 'Bakker',
  geboortedatum: '2008-11-10',
  in_dienst_sinds: '2025-06-01',
  contracttype: 'nuluren',
  contractduur: 'bepaalde',
  functie: 'Oude functie',
  uurloon: 7.1,
  ingangsdatum: '2025-06-01',
  einddatum: '2025-12-31',
  proefperiode: true,
  contract_door_loonbureau: true,
  onboarding_data: {},
} as unknown as Persoon

const nieuw = {
  id: 'c1',
  medewerker_id: 'p1',
  werkgever: 'boskma',
  soort: 'vaste_uren',
  duur: 'bepaalde',
  begint: '2026-01-01',
  eindigt: '2026-12-31',
  uren_vast: 14,
  uren_min: null,
  uren_max: null,
  uurloon: 8.25,
  functie: 'Medewerker fastservice II',
  proefperiode: false,
  beeindigd_op: null,
  beeindigd_reden: null,
  document_id: null,
  bron: 'handmatig',
  opmerking: null,
} as Contract

describe('met een contract in de app', () => {
  const blad = bouwMutatieformulier(thijmen, nieuw)

  it('neemt de voorwaarden uit het contract', () => {
    expect(blad).toContain('1 januari 2026')
    expect(blad).toContain('31 december 2026')
    expect(blad).toContain('14 uur per week')
    expect(blad).toContain('€ 8,25')
    expect(blad).toContain('Medewerker fastservice II')
  })

  it('neemt niet de oude velden van de kaart', () => {
    expect(blad).not.toContain('Oude functie')
    expect(blad).not.toContain('€ 7,10')
    expect(blad).not.toContain('1 juni 2025 ')
  })
})

describe('zonder contract in de app', () => {
  /* Een nieuw dienstverband: het loonbureau moet het contract nog opstellen,
     dus er ís nog niets om uit te lezen. Dan zijn de velden op de kaart het
     enige wat er is — geen restant, maar de bron van dat moment. */
  const blad = bouwMutatieformulier(thijmen, null)

  it('valt terug op de velden van de kaart', () => {
    expect(blad).toContain('Oude functie')
    expect(blad).toContain('€ 7,10')
    expect(blad).toContain('1 juni 2025')
  })
})

describe('onbepaalde tijd', () => {
  it('zet er geen einddatum bij', () => {
    const vast = { ...nieuw, duur: 'onbepaalde', eindigt: null } as Contract
    expect(bouwMutatieformulier(thijmen, vast)).not.toContain('Einddatum')
  })
})
