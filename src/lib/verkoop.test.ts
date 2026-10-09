/* Het scherm laat het totaal live meelopen, de database bepaalt wat er op de
   factuur komt. Die twee moeten tot op de cent hetzelfde uitkomen — anders zie
   je straks een ander bedrag dan de klant. De som hieronder is dezelfde die
   tegen de database is nagerekend: 476,50 met 37,28 en 4,34 btw. */

import { describe, expect, it } from 'vitest'
import {
  dagenTeLaat,
  deelUitgaandIn,
  euroUitCenten,
  nogTeOntvangen,
  regelCenten,
  totalenVan,
  type Regel,
  type Verkoopfactuur,
} from './verkoop'

const regel = (o: Partial<Regel> = {}): Regel => ({
  volgorde: 0, product_id: null, omschrijving: 'Iets', aantal: 1, prijs_incl: 1, btw_tarief: 9, ...o,
})

describe('wat een regel kost', () => {
  it('rekent aantal maal prijs', () => {
    expect(regelCenten(regel({ aantal: 75, prijs_incl: 6.02 }))).toBe(45150)
  })

  it('struikelt niet over de kommagetallen van de computer', () => {
    // 0.1 + 0.2 is in een computer niet precies 0.3; in centen wel.
    expect(regelCenten(regel({ aantal: 3, prijs_incl: 0.1 }))).toBe(30)
  })

  it('kan ook een half aantal aan', () => {
    expect(regelCenten(regel({ aantal: 2.5, prijs_incl: 4 }))).toBe(1000)
  })
})

describe('de btw eruit halen', () => {
  it('komt uit op hetzelfde als de database', () => {
    const t = totalenVan([
      regel({ omschrijving: 'Lunchbroodje', aantal: 75, prijs_incl: 6.02, btw_tarief: 9 }),
      regel({ omschrijving: 'Blikje fris', aantal: 10, prijs_incl: 2.5, btw_tarief: 21 }),
    ])
    expect(t).toEqual({ incl: 47650, btw9: 3728, btw21: 434, excl: 43488 })
  })

  it('telt per tarief op voordat het afrondt', () => {
    // Drie keer 1 cent apart afronden geeft 0; samen is het 1 cent btw.
    const drie = [1, 2, 3].map((n) => regel({ volgorde: n, aantal: 1, prijs_incl: 0.05 }))
    expect(totalenVan(drie).incl).toBe(15)
    expect(totalenVan(drie).btw9).toBe(1)
  })

  it('laat een regel zonder btw met rust', () => {
    const t = totalenVan([regel({ aantal: 1, prijs_incl: 10, btw_tarief: 0 })])
    expect(t).toEqual({ incl: 1000, btw9: 0, btw21: 0, excl: 1000 })
  })

  it('geeft nul terug zonder regels', () => {
    expect(totalenVan([])).toEqual({ incl: 0, btw9: 0, btw21: 0, excl: 0 })
  })

  it('houdt excl plus btw gelijk aan incl', () => {
    const t = totalenVan([
      regel({ aantal: 7, prijs_incl: 3.33, btw_tarief: 9 }),
      regel({ volgorde: 1, aantal: 2, prijs_incl: 12.95, btw_tarief: 21 }),
    ])
    expect(t.excl + t.btw9 + t.btw21).toBe(t.incl)
  })

  it('schrijft centen als euro', () => {
    expect(euroUitCenten(47650)).toBe('€ 476,50')
  })
})

describe('de lijst met uitgaande facturen', () => {
  const f = (o: Partial<Verkoopfactuur> & { id: number }): Verkoopfactuur => ({
    nummer: null, klant_id: 1, factuurdatum: null, vervaldatum: null, leverdatum: null,
    periode: null, onderwerp: null, notitie_op_factuur: null, interne_notitie: null,
    status: 'concept', totaal_excl: 0, btw_9: 0, btw_21: 0, totaal_incl: 0,
    pdf_pad: null, verzonden_op: null, betaald_op: null, credit_van: null, ...o,
  })
  const vandaag = '2026-10-09'

  it('telt alleen op wat verstuurd en nog niet betaald is', () => {
    const lijst = [
      f({ id: 1, status: 'verzonden', totaal_incl: 100 }),
      f({ id: 2, status: 'betaald', totaal_incl: 50 }),
      f({ id: 3, status: 'concept', totaal_incl: 999 }),
    ]
    expect(nogTeOntvangen(lijst)).toBe(100)
  })

  it('zet de langst openstaande bovenaan', () => {
    const lijst = [
      f({ id: 1, status: 'verzonden', vervaldatum: '2026-10-20' }),
      f({ id: 2, status: 'verzonden', vervaldatum: '2026-09-20' }),
    ]
    expect(deelUitgaandIn(lijst, vandaag).verzonden.map((x) => x.id)).toEqual([2, 1])
  })

  it('telt de dagen te laat', () => {
    expect(dagenTeLaat(f({ id: 1, status: 'verzonden', vervaldatum: '2026-10-04' }), vandaag)).toBe(5)
  })

  it('noemt een concept nooit te laat', () => {
    expect(dagenTeLaat(f({ id: 1, status: 'concept', vervaldatum: '2026-01-01' }), vandaag)).toBe(0)
  })

  it('laat alleen de laatste zestig dagen betaald zien', () => {
    const lijst = [
      f({ id: 1, status: 'betaald', betaald_op: '2026-10-01' }),
      f({ id: 2, status: 'betaald', betaald_op: '2026-06-01' }),
    ]
    expect(deelUitgaandIn(lijst, vandaag).betaald.map((x) => x.id)).toEqual([1])
  })
})
