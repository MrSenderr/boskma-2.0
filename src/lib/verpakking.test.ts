/* De gevallen uit de zelftest van de oude inkoop-app, plus wat er sindsdien
   aan twijfelgevallen bij kwam. Hier wordt bepaald wat een portie kost, dus
   een fout hier werkt door in elke adviesprijs. */

import { describe, expect, it } from 'vitest'
import { adviesprijs, kostprijzen, ontleed } from './verpakking'

describe('de verpakkingsinhoud ontleden', () => {
  it('leest het laatste getal als maat en de rest als aantal', () => {
    expect(ontleed('40x85 gram')).toMatchObject({ eenheden: 40, kilo: 3.4 })
    expect(ontleed('25x20 gram')).toMatchObject({ eenheden: 25, kilo: 0.5 })
  })

  it('vermenigvuldigt bij drie getallen de eerste twee', () => {
    expect(ontleed('4x6x33 cl')).toMatchObject({ eenheden: 24, liter: 7.92 })
    expect(ontleed('24x33 cl')).toMatchObject({ eenheden: 24, liter: 7.92 })
  })

  /* "2x5 kilo" is niet tien losse dingen maar twee zakken van vijf kilo. Per
     stuk is hier per zák — en dat is zelden het getal dat je zoekt. */
  it('herkent bulk: een eenheid van een kilo of meer', () => {
    expect(ontleed('2x5 kilo')).toMatchObject({ eenheden: 2, kilo: 10, bulk: true })
    expect(ontleed('1 kilo')).toMatchObject({ eenheden: 1, kilo: 1, bulk: true })
    expect(ontleed('6x1,5 liter')).toMatchObject({ eenheden: 6, liter: 9, bulk: true })
  })

  it('noemt kleine verpakkingen geen bulk', () => {
    expect(ontleed('900 ml')).toMatchObject({ eenheden: 1, liter: 0.9, bulk: false })
    expect(ontleed('40x85 gram')).toMatchObject({ bulk: false })
  })

  it('leest bij stuks het getal als aantal, niet als maat', () => {
    expect(ontleed('500 stuks')).toMatchObject({ eenheden: 500, kilo: null })
  })

  it('telt meters niet mee als gewicht of inhoud', () => {
    expect(ontleed('3x300 meter')).toMatchObject({ eenheden: 3, kilo: null, liter: null })
  })

  it('weet dat per kilo en per stuk al een eenheidsprijs zijn', () => {
    expect(ontleed('Per kilo')).toMatchObject({ losverkocht: 'kilo' })
    expect(ontleed('Per stuk')).toMatchObject({ losverkocht: 'stuk' })
  })

  /* Een bos bieslook is nu eenmaal een bos: alles wat geen kilo is telt als
     stuk, anders zou het artikel helemaal uit de lijst vallen. */
  it('rekent een bos of krop als stuk', () => {
    expect(ontleed('Per bos')).toMatchObject({ losverkocht: 'stuk', losnaam: 'bos' })
  })

  it('geeft niets terug bij iets wat het niet snapt', () => {
    expect(ontleed('onzin zonder maat')).toBeNull()
    expect(ontleed('')).toBeNull()
    expect(ontleed(null)).toBeNull()
    expect(ontleed('12 dozijn')).toBeNull()
  })
})

describe('de kostprijzen', () => {
  it('deelt de verpakkingsprijs door het aantal eenheden', () => {
    const k = kostprijzen(8.5, '40x85 gram')
    expect(k.perStuk).toBeCloseTo(0.2125, 4)
    expect(k.perKilo).toBeCloseTo(2.5, 4)
    expect(k.perLiter).toBeNull()
  })

  it('neemt bij per kilo de factuurprijs als kiloprijs', () => {
    expect(kostprijzen(3.95, 'Per kilo')).toMatchObject({ perStuk: null, perKilo: 3.95 })
  })

  it('neemt bij per stuk de factuurprijs als stuksprijs', () => {
    expect(kostprijzen(1.55, 'Per stuk')).toMatchObject({ perStuk: 1.55, perKilo: null })
  })

  it('geeft geen prijzen als de verpakking onbekend is', () => {
    const k = kostprijzen(10, 'onzin zonder maat')
    expect(k).toMatchObject({ perStuk: null, perKilo: null, perLiter: null, verpakking: null })
  })

  it('geeft geen prijzen zonder prijs', () => {
    expect(kostprijzen(null, '40x85 gram').perStuk).toBeNull()
  })
})

describe('de adviesprijs', () => {
  /* Naar boven op vijf cent: je hangt geen prijs van € 2,37 aan de muur. */
  it('rekent terug vanaf het foodcost-doel, met btw, op vijf cent naar boven', () => {
    expect(adviesprijs(0.45, 0.28, 0.09)).toBeCloseTo(1.8, 2)
  })

  it('rondt altijd naar boven af, nooit naar beneden', () => {
    expect(adviesprijs(0.5, 0.28, 0.09)).toBeGreaterThanOrEqual((0.5 / 0.28) * 1.09)
  })

  /* Een doel voor alles deugt niet: een Magnum van € 1,91 kun je nooit voor
     € 6,80 verkopen, daar is 60% gewoon goed. */
  it('gebruikt het doel dat je meegeeft', () => {
    expect(adviesprijs(1.91, 0.6, 0.09)).toBeCloseTo(3.5, 2)
  })

  it('geeft niets zonder stuksprijs of zonder doel', () => {
    expect(adviesprijs(null, 0.28, 0.09)).toBeNull()
    expect(adviesprijs(1, 0, 0.09)).toBeNull()
  })
})
