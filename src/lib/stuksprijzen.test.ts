import { describe, expect, it } from 'vitest'
import { doelVan, metKostprijzen, zoek, type Artikel, type LaatstePrijs } from './stuksprijzen'

const rij = (r: Partial<LaatstePrijs>): LaatstePrijs => ({
  leverancier_id: 1,
  leveranciernaam: 'Veldboer Eenhoorn',
  artikelnr: '390400',
  naam: 'Frites 10 mm',
  merk: 'Farm Frites',
  inhoud: '2x5 kilo',
  eenheid: 'Doos',
  prijs: '15.79',
  factuurdatum: '2026-10-09',
  factuurnummer: 'F636352',
  op_bestellijst: true,
  groep: 'Diepvries',
  ...r,
})

describe('het foodcost-doel per groep', () => {
  const doelen = { algemeen: 0.28, btw: 0.09, vetOpslag: 0.03, perGroep: { IJs: 0.6 } }

  it('pakt het doel van de groep als die er is', () => {
    expect(doelVan('IJs', doelen)).toBe(0.6)
  })

  /* Een Magnum van € 1,91 kun je nooit voor € 6,80 verkopen; daar is 60%
     gewoon goed. Voor de rest geldt het algemene doel. */
  it('valt anders terug op het algemene doel', () => {
    expect(doelVan('Diepvries', doelen)).toBe(0.28)
    expect(doelVan(null, doelen)).toBe(0.28)
  })
})

describe('de artikelen met hun kostprijzen', () => {
  it('rekent de verpakking om en sorteert op naam', () => {
    const { bekend } = metKostprijzen([
      rij({ artikelnr: 'b', naam: 'Zoute stokjes', inhoud: '40x85 gram', prijs: '8.50' }),
      rij({ artikelnr: 'a', naam: 'Appelmoes', inhoud: 'Per kilo', prijs: '2.00' }),
    ])
    expect(bekend.map((a) => a.naam)).toEqual(['Appelmoes', 'Zoute stokjes'])
    expect(bekend[1].perStuk).toBeCloseTo(0.2125, 4)
    expect(bekend[0].perKilo).toBeCloseTo(2, 2)
  })

  /* Een artikel waarvan we de verpakking niet snappen mag niet stilletjes
     verdwijnen: dan lijkt de lijst compleet terwijl hij dat niet is. */
  it('zet onbegrepen verpakkingen apart in plaats van ze weg te laten', () => {
    const { bekend, onbekend } = metKostprijzen([
      rij({ artikelnr: 'a', naam: 'Iets raars', inhoud: 'doos' }),
      rij({ artikelnr: 'b', naam: 'Gewoon', inhoud: '6x1 liter' }),
    ])
    expect(bekend.map((a) => a.naam)).toEqual(['Gewoon'])
    expect(onbekend.map((a) => a.naam)).toEqual(['Iets raars'])
  })

  it('struikelt niet over een naam die ontbreekt', () => {
    const { bekend } = metKostprijzen([rij({ naam: null, inhoud: 'Per stuk' })])
    expect(bekend).toHaveLength(1)
  })
})

describe('zoeken', () => {
  const artikelen = metKostprijzen([
    rij({ artikelnr: '390400', naam: 'Frites 10 mm', merk: 'Farm Frites' }),
    rij({ artikelnr: '603845', naam: 'Tomaten maat B', merk: 'AGF Vers', inhoud: 'Per kilo' }),
  ]).bekend as Artikel[]

  it('vindt op naam, merk en artikelnummer', () => {
    expect(zoek(artikelen, 'tomaat')).toHaveLength(0)
    expect(zoek(artikelen, 'tomaten')).toHaveLength(1)
    expect(zoek(artikelen, 'farm')).toHaveLength(1)
    expect(zoek(artikelen, '603845')).toHaveLength(1)
  })

  it('trekt zich niets aan van hoofdletters en spaties', () => {
    expect(zoek(artikelen, '  FRITES ')).toHaveLength(1)
  })

  it('geeft alles terug als je niets zoekt', () => {
    expect(zoek(artikelen, '')).toHaveLength(2)
  })
})
