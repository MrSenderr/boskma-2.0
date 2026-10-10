/* De blokindeling en de omgang met bedragen die als tekst binnenkomen. Bij
   inkoop gaat het om geld, dus dat rekenwerk staat los van het scherm. */

import { describe, expect, it } from 'vitest'
import { aantalTekst, dagEnDatum, euro, getal, inBlokken, klopt, type Documentregel } from './inkoop'

const regel = (r: Partial<Documentregel>): Documentregel => ({
  id: 1,
  document_id: 1,
  regelnr: 1,
  afleverdatum: null,
  leveringsnr: null,
  referentie: null,
  artikelnr: '390400',
  omschrijving: 'Frites 10 mm',
  merk: null,
  inhoud: null,
  aantal: '1',
  eenheid: 'Doos',
  prijs: '15.79',
  bedrag: '15.79',
  btw_pct: 9,
  soort: 'Levering',
  artikelnr_norm: '390400',
  artikelnaam: 'Frites 10 mm gastro chilled',
  op_bestellijst: true,
  ...r,
})

describe('bedragen die als tekst binnenkomen', () => {
  it('worden een getal', () => {
    expect(getal('2581.32')).toBe(2581.32)
    expect(getal(12)).toBe(12)
  })

  it('worden nul als er niets staat', () => {
    expect(getal(null)).toBe(0)
    expect(getal(undefined)).toBe(0)
    expect(getal('')).toBe(0)
    expect(getal('geen getal')).toBe(0)
  })

  it('komen er als bedragen in euro uit', () => {
    expect(euro('2581.32')).toBe('€ 2.581,32')
    expect(euro(null)).toBe('€ 0,00')
  })

  it('tonen bij aantallen geen nullen die niets zeggen', () => {
    expect(aantalTekst('22.000')).toBe('22')
    expect(aantalTekst('1.500')).toBe('1,5')
    expect(aantalTekst('-2.000')).toBe('-2')
  })
})

describe('de datum van een levering', () => {
  it('komt met de dag erbij, want dinsdag en donderdag wordt bezorgd', () => {
    expect(dagEnDatum('2026-08-30')).toBe('zo 30 aug')
  })

  it('wordt een streepje als hij ontbreekt', () => {
    expect(dagEnDatum(null)).toBe('—')
    expect(dagEnDatum('geen datum')).toBe('—')
  })
})

describe('of een factuur klopt', () => {
  it('klopt als hij verwerkt is en nul verschil heeft', () => {
    expect(klopt({ status: 'verwerkt', verschil: '0.00' })).toBe(true)
  })

  it('klopt niet bij een verschil, ook niet van één cent', () => {
    expect(klopt({ status: 'verwerkt', verschil: '0.01' })).toBe(false)
    expect(klopt({ status: 'verwerkt', verschil: '-0.01' })).toBe(false)
  })

  it('klopt niet zolang hij nog nagekeken moet worden', () => {
    expect(klopt({ status: 'controleren', verschil: '0.00' })).toBe(false)
  })
})

describe('de leveringsblokken van een factuur', () => {
  it('zet regels van dezelfde levering bij elkaar', () => {
    const blokken = inBlokken([
      regel({ id: 1, afleverdatum: '2026-08-30', leveringsnr: 'LEY_041046', bedrag: '10.00' }),
      regel({ id: 2, afleverdatum: '2026-08-30', leveringsnr: 'LEY_041046', bedrag: '5.50' }),
      regel({ id: 3, afleverdatum: '2026-09-01', leveringsnr: 'LEY_041100', bedrag: '3.00' }),
    ])
    expect(blokken).toHaveLength(2)
    expect(blokken[0].regels).toHaveLength(2)
    expect(blokken[0].bedrag).toBeCloseTo(15.5, 2)
    expect(blokken[1].afleverdatum).toBe('2026-09-01')
  })

  /* Emballage bovenaan hoort bij geen enkele levering. Die mag niet stilletjes
     bij het eerste blok worden getrokken: dan lijkt statiegeld onderdeel van
     een bestelling die het niet is. */
  it('houdt emballage zonder datum apart', () => {
    const blokken = inBlokken([
      regel({ id: 1, soort: 'Emballage', bedrag: '-12.00' }),
      regel({ id: 2, afleverdatum: '2026-08-30', leveringsnr: 'LEY_041046', bedrag: '10.00' }),
    ])
    expect(blokken).toHaveLength(2)
    expect(blokken[0].afleverdatum).toBeNull()
    expect(blokken[0].bedrag).toBeCloseTo(-12, 2)
  })

  /* Een factuur kan leveringen van weken eerder bevatten. De volgorde blijft
     die van de factuur zelf, anders staat er iets anders op het scherm dan op
     papier. */
  it('laat de volgorde van de factuur staan', () => {
    const blokken = inBlokken([
      regel({ id: 1, afleverdatum: '2026-09-10', leveringsnr: 'B' }),
      regel({ id: 2, afleverdatum: '2026-08-01', leveringsnr: 'A' }),
    ])
    expect(blokken.map((b) => b.leveringsnr)).toEqual(['B', 'A'])
  })

  it('geeft niets terug als er geen regels zijn', () => {
    expect(inBlokken([])).toEqual([])
  })
})
