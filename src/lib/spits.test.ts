/* Het indelen van de avondspits.
 *
 * Een fout hier zet iemand op een plek waar hij niet hoort te staan — en bij
 * 'nooit' is dat geen ongemak maar een afspraak die gebroken wordt. */

import { describe, expect, it } from 'vitest'
import {
  herhalingen,
  isSpitsdag,
  maakIndeling,
  niveauVan,
  sleutelVan,
  spitsVolk,
  stoelenVan,
  stoelnaam,
  volgendeSpitsdag,
  vulVolgorde,
  waardering,
  belangOp,
  isDoordeweeks,
  type Niveau,
  type Werkplek,
} from './spits'

const plek = (
  naam: string,
  belang: number,
  volgorde: number,
  aantal = 1,
  belang_doordeweeks: number | null = null,
): Werkplek => ({
  id: naam.toLowerCase(),
  naam,
  aantal,
  belang,
  belang_doordeweeks,
  volgorde,
  actief: true,
})

const KASSA = plek('Kassa', 10, 1)
const PATAT = plek('Patatbakker', 9, 2)
const SNACK = plek('Snackbakker', 8, 3, 2)
const RUNNER = plek('Runner', 5, 5)
const HULP = plek('Keukenhulp', 3, 6)

const mens = (id: string) => ({ id, naam: id })

/** Niveaus opgeven als "wie: plek=niveau". */
function niveaus(...regels: [string, string, Niveau][]): Map<string, Niveau> {
  return new Map(regels.map(([wie, waar, n]) => [sleutelVan(wie, waar), n]))
}

describe('spitsdagen', () => {
  it('kent vrijdag, zaterdag en zondag', () => {
    expect(isSpitsdag('2026-10-16')).toBe(true) // vrijdag
    expect(isSpitsdag('2026-10-17')).toBe(true)
    expect(isSpitsdag('2026-10-18')).toBe(true)
    expect(isSpitsdag('2026-10-19')).toBe(false) // maandag
  })

  it('vindt de eerstvolgende, en blijft staan als vandaag er een is', () => {
    expect(volgendeSpitsdag('2026-10-13')).toBe('2026-10-16')
    expect(volgendeSpitsdag('2026-10-17')).toBe('2026-10-17')
  })
})

describe('stoelen', () => {
  it('maakt van snackbakker 2x twee stoelen', () => {
    const uit = stoelenVan([SNACK])
    expect(uit).toHaveLength(2)
    expect(uit.map(stoelnaam)).toEqual(['Snackbakker 1', 'Snackbakker 2'])
  })

  /* De tweede man op een plek is minder hard nodig dan de eerste man op de
     volgende. Zonder dit gaat een tweede snackbakker vóór de chef. */
  it('maakt de tweede stoel één punt lichter', () => {
    expect(stoelenVan([SNACK]).map((s) => s.belang)).toEqual([8, 7])
  })

  it('laat een plek zonder tweede man ongemoeid', () => {
    expect(stoelenVan([KASSA])[0].belang).toBe(10)
    expect(stoelnaam(stoelenVan([KASSA])[0])).toBe('Kassa')
  })

  it('houdt de volgorde die jij hebt ingesteld', () => {
    expect(stoelenVan([HULP, KASSA, PATAT]).map((s) => s.werkplek.naam)).toEqual([
      'Kassa',
      'Patatbakker',
      'Keukenhulp',
    ])
  })

  it('laat een uitgezette plek weg', () => {
    expect(stoelenVan([{ ...RUNNER, actief: false }])).toEqual([])
  })
})

describe('waardering', () => {
  it('staat nooit toe wat op nooit staat', () => {
    expect(waardering('nooit', 10)).toBeNull()
  })

  it('geeft alles wat mag punten, zodat een bezette stoel beter is dan een lege', () => {
    for (const n of ['liefst', 'kan', 'nood', 'onbekend'] as const) {
      expect(waardering(n, 1)).toBeGreaterThan(0)
    }
  })

  /* Hier zit de regel in: één stap in belang kan niet worden weggepoetst door
     een betere match. Anders blijft de kassa leeg omdat iemand liever runner
     is. */
  it('laat het belang van de plek altijd zwaarder wegen dan de match', () => {
    expect(waardering('onbekend', 10)!).toBeGreaterThan(waardering('liefst', 9)!)
  })

  it('straft herhaling, maar nooit zo hard dat een niveau omklapt', () => {
    expect(waardering('kan', 5, 0)!).toBeGreaterThan(waardering('kan', 5, 3)!)
    // Vier keer achter elkaar runner weegt nog altijd zwaarder dan iemand die
    // het alleen in noodgeval doet.
    expect(waardering('kan', 5, 4)!).toBeGreaterThan(waardering('nood', 5, 0)!)
    // En de boete loopt niet eindeloos op.
    expect(waardering('kan', 5, 9)).toBe(waardering('kan', 5, 3))
  })
})

describe('herhalingen', () => {
  const eerder = [
    { datum: '2026-10-11', medewerker_id: 'a', werkplek_id: 'runner' },
    { datum: '2026-10-10', medewerker_id: 'a', werkplek_id: 'runner' },
    { datum: '2026-10-09', medewerker_id: 'a', werkplek_id: 'kassa' },
    { datum: '2026-10-04', medewerker_id: 'a', werkplek_id: 'runner' },
    { datum: '2026-10-03', medewerker_id: 'a', werkplek_id: 'runner' },
  ]

  it('telt alleen de laatste paar avonden', () => {
    expect(herhalingen(eerder, 'a', 'runner', 2)).toBe(2)
    expect(herhalingen(eerder, 'a', 'runner', 4)).toBe(3)
  })

  it('kijkt naar de juiste persoon en de juiste plek', () => {
    expect(herhalingen(eerder, 'b', 'runner')).toBe(0)
    expect(herhalingen(eerder, 'a', 'keukenhulp')).toBe(0)
  })
})

describe('de indeling', () => {
  const stoelen = stoelenVan([KASSA, PATAT, SNACK, RUNNER, HULP])

  it('zet iedereen op zijn lievelingsplek als dat kan', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA, RUNNER]),
      mensen: [mens('daan'), mens('kate')],
      niveaus: niveaus(
        ['daan', 'runner', 'liefst'],
        ['daan', 'kassa', 'kan'],
        ['kate', 'kassa', 'liefst'],
        ['kate', 'runner', 'kan'],
      ),
    })
    expect(uit.plekken.map((p) => [p.stoel.werkplek.naam, p.persoon?.id])).toEqual([
      ['Kassa', 'kate'],
      ['Runner', 'daan'],
    ])
  })

  it('zet niemand op een plek die op nooit staat', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA]),
      mensen: [mens('daan')],
      niveaus: niveaus(['daan', 'kassa', 'nooit']),
    })
    expect(uit.plekken[0].persoon).toBeNull()
    expect(uit.over).toEqual([{ persoon: mens('daan'), reden: 'kan_niks' }])
    expect(uit.onbezet.map((s) => s.werkplek.naam)).toEqual(['Kassa'])
  })

  /* Van boven naar beneden vullen gaat hier mis: op de kassa zijn ze allebei
     even goed, maar als Daan de kassa pakt kan de patat niemand meer hebben.
     Er wordt dus echt gezocht, niet achter elkaar gevuld. */
  it('schuift iemand door als dat de volgende plek bezet houdt', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA, PATAT]),
      mensen: [mens('daan'), mens('kate')],
      niveaus: niveaus(
        ['daan', 'kassa', 'liefst'],
        ['daan', 'patatbakker', 'liefst'],
        ['kate', 'kassa', 'liefst'],
        ['kate', 'patatbakker', 'nooit'],
      ),
    })
    expect(uit.plekken.map((p) => p.persoon?.id)).toEqual(['kate', 'daan'])
    expect(uit.onbezet).toEqual([])
  })

  it('vult de belangrijkste plekken eerst als je te weinig mensen hebt', () => {
    const uit = maakIndeling({
      stoelen,
      mensen: [mens('a'), mens('b')],
      // Allebei overal even goed: dan beslist het belang van de plek.
      niveaus: new Map(),
    })
    const bezet = uit.plekken.filter((p) => p.persoon).map((p) => stoelnaam(p.stoel))
    expect(bezet).toEqual(['Kassa', 'Patatbakker'])
    expect(uit.onbezet.map(stoelnaam)).toEqual([
      'Snackbakker 1',
      'Snackbakker 2',
      'Runner',
      'Keukenhulp',
    ])
  })

  /* Liever de keukenhulp leeg dan de kassa, ook als iemand de keukenhulp
     prachtig vindt en de kassa nooit heeft gedaan. */
  it('kiest de belangrijke plek boven de leukere', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA, HULP]),
      mensen: [mens('a')],
      niveaus: niveaus(['a', 'keukenhulp', 'liefst']),
    })
    expect(uit.plekken.find((p) => p.persoon)?.stoel.werkplek.naam).toBe('Kassa')
  })

  it('zegt wie er over is omdat er genoeg mensen waren', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA]),
      mensen: [mens('a'), mens('b')],
      niveaus: new Map(),
    })
    expect(uit.over).toHaveLength(1)
    expect(uit.over[0].reden).toBe('te_veel')
  })

  it('laat zien hoe goed iemand op zijn plek past', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA]),
      mensen: [mens('a')],
      niveaus: niveaus(['a', 'kassa', 'nood']),
    })
    expect(uit.plekken[0].niveau).toBe('nood')
  })

  it('noemt een plek onbekend als die nooit is beoordeeld', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([KASSA]),
      mensen: [mens('a')],
      niveaus: new Map(),
    })
    expect(uit.plekken[0].niveau).toBe('onbekend')
  })

  it('verdeelt de twee snackbakkers over twee mensen', () => {
    const uit = maakIndeling({
      stoelen: stoelenVan([SNACK]),
      mensen: [mens('a'), mens('b')],
      niveaus: niveaus(['a', 'snackbakker', 'liefst'], ['b', 'snackbakker', 'liefst']),
    })
    expect(uit.plekken.map((p) => p.persoon?.id)).toEqual(['a', 'b'])
  })

  describe('afwisseling', () => {
    const opdracht = {
      stoelen: stoelenVan([RUNNER, HULP]),
      mensen: [mens('a'), mens('b')],
      niveaus: niveaus(
        ['a', 'runner', 'kan'],
        ['a', 'keukenhulp', 'kan'],
        ['b', 'runner', 'kan'],
        ['b', 'keukenhulp', 'kan'],
      ),
    }

    it('zonder geschiedenis blijft de uitkomst dezelfde', () => {
      expect(maakIndeling(opdracht).plekken.map((p) => p.persoon?.id)).toEqual(['a', 'b'])
      expect(maakIndeling(opdracht).plekken.map((p) => p.persoon?.id)).toEqual(['a', 'b'])
    })

    it('haalt iemand van de plek waar hij steeds stond', () => {
      const uit = maakIndeling({
        ...opdracht,
        eerder: [
          { datum: '2026-10-11', medewerker_id: 'a', werkplek_id: 'runner' },
          { datum: '2026-10-10', medewerker_id: 'a', werkplek_id: 'runner' },
          { datum: '2026-10-09', medewerker_id: 'a', werkplek_id: 'runner' },
        ],
      })
      expect(uit.plekken.map((p) => p.persoon?.id)).toEqual(['b', 'a'])
      expect(uit.plekken[1].herhalingen).toBe(0)
    })

    /* Afwisseling mag een keuze bijsturen, niet omgooien: wie het echt kan
       gaat vóór wie het alleen in noodgeval doet, ook na vier keer. */
    it('zet er geen noodgeval op om maar af te wisselen', () => {
      const uit = maakIndeling({
        stoelen: stoelenVan([RUNNER]),
        mensen: [mens('a'), mens('b')],
        niveaus: niveaus(['a', 'runner', 'kan'], ['b', 'runner', 'nood']),
        eerder: ['2026-10-11', '2026-10-10', '2026-10-09', '2026-10-04'].map((datum) => ({
          datum,
          medewerker_id: 'a',
          werkplek_id: 'runner',
        })),
      })
      expect(uit.plekken[0].persoon?.id).toBe('a')
      expect(uit.plekken[0].herhalingen).toBe(4)
    })
  })

  it('doet niets vreemds zonder mensen of zonder plekken', () => {
    expect(maakIndeling({ stoelen, mensen: [], niveaus: new Map() }).onbezet).toHaveLength(6)
    const leeg = maakIndeling({ stoelen: [], mensen: [mens('a')], niveaus: new Map() })
    expect(leeg.plekken).toEqual([])
    expect(leeg.over).toEqual([{ persoon: mens('a'), reden: 'kan_niks' }])
  })
})

describe('wie er in de spits staat', () => {
  const namen = new Map([
    ['1', 'Daan Verhulst'],
    ['2', 'Ilona Swagerman'],
    ['3', 'Thijmen Bakker'],
  ])

  it('neemt wie er van 17 tot 20 is, en laat de rest apart staan', () => {
    const uit = spitsVolk(
      [
        { medewerker_id: '1', voornaam: 'Daan', achternaam: null, begint: '11:00:00', eindigt: '20:00:00' },
        { medewerker_id: '3', voornaam: 'Thijmen', achternaam: null, begint: '17:00', eindigt: '20:00' },
        // Loopt om 19 uur weg: die zet je niet op de kassa.
        { medewerker_id: '2', voornaam: 'Ilona', achternaam: null, begint: '15:00', eindigt: '19:00' },
      ],
      namen,
    )
    expect(uit.heel.map((r) => r.persoon.naam)).toEqual(['Daan Verhulst', 'Thijmen Bakker'])
    expect(uit.deels.map((r) => r.persoon.naam)).toEqual(['Ilona Swagerman'])
    expect(uit.heel[0].tijd).toBe('11:00–20:00')
  })

  it('laat een dienst die buiten de spits valt helemaal weg', () => {
    const uit = spitsVolk(
      [{ medewerker_id: '2', voornaam: 'Ilona', achternaam: null, begint: '12:00', eindigt: '14:00' }],
      namen,
    )
    expect(uit.heel).toEqual([])
    expect(uit.deels).toEqual([])
  })

  /* Ilona staat op vrijdag 12-14 én 17-20. Dat is één persoon die de spits
     draait, niet een halve. */
  it('kijkt bij twee diensten op een dag naar de dienst die de spits dekt', () => {
    const uit = spitsVolk(
      [
        { medewerker_id: '2', voornaam: 'Ilona', achternaam: null, begint: '12:00', eindigt: '14:00' },
        { medewerker_id: '2', voornaam: 'Ilona', achternaam: null, begint: '17:00', eindigt: '20:00' },
      ],
      namen,
    )
    expect(uit.heel).toHaveLength(1)
    expect(uit.heel[0].tijd).toBe('17:00–20:00')
  })

  it('telt diensten zonder naam als open', () => {
    const uit = spitsVolk(
      [
        { medewerker_id: null, voornaam: null, achternaam: null, begint: '17:00', eindigt: '20:00' },
        { medewerker_id: null, voornaam: null, achternaam: null, begint: '17:00', eindigt: '20:00' },
      ],
      namen,
    )
    expect(uit.open).toBe(2)
    expect(uit.heel).toEqual([])
  })

  it('valt terug op de naam uit de export als we de persoon niet kennen', () => {
    const uit = spitsVolk(
      [{ medewerker_id: '9', voornaam: 'Nieuw', achternaam: 'Iemand', begint: '17:00', eindigt: '20:00' }],
      namen,
    )
    expect(uit.heel[0].persoon.naam).toBe('Nieuw Iemand')
  })
})

describe('niveauVan', () => {
  it('geeft onbekend als er niets is ingevuld', () => {
    expect(niveauVan(new Map(), 'a', 'kassa')).toBe('onbekend')
    expect(niveauVan(niveaus(['a', 'kassa', 'liefst']), 'a', 'kassa')).toBe('liefst')
  })
})

describe('de volgorde waarop plekken bezet raken', () => {
  const plekken = [KASSA, PATAT, SNACK, RUNNER, HULP]
  const stoelen = stoelenVan(plekken)

  it('zet de belangrijkste plek voorop, met de tweede man op zijn eigen plaats', () => {
    expect(vulVolgorde(stoelen).map(stoelnaam)).toEqual([
      'Kassa', // 10
      'Patatbakker', // 9
      'Snackbakker 1', // 8
      'Snackbakker 2', // 8 - 1 = 7
      'Runner', // 5
      'Keukenhulp', // 3
    ])
  })

  it('laat bij gelijk belang jouw eigen volgorde beslissen', () => {
    const a = plek('Eerste', 6, 1)
    const b = plek('Tweede', 6, 2)
    expect(vulVolgorde(stoelenVan([b, a])).map(stoelnaam)).toEqual(['Eerste', 'Tweede'])
  })

  /* Dit is de belofte van het instellingenscherm: wat daar als volgorde staat
     is ook echt wat er gebeurt. Loopt dat uit elkaar, dan staat er een
     uitleg op het scherm die niet klopt — erger dan geen uitleg. */
  it('is precies wat de indeling doet als iedereen overal even goed is', () => {
    const volgorde = vulVolgorde(stoelen)
    for (let aantal = 1; aantal <= stoelen.length; aantal++) {
      const uit = maakIndeling({
        stoelen,
        mensen: Array.from({ length: aantal }, (_, i) => mens(`p${i}`)),
        niveaus: new Map(),
      })
      const bezet = uit.plekken.filter((p) => p.persoon).map((p) => stoelnaam(p.stoel))
      expect(bezet.slice().sort()).toEqual(
        volgorde.slice(0, aantal).map(stoelnaam).sort(),
      )
    }
  })
})

describe('een eigen volgorde doordeweeks', () => {
  /* Op zaterdag gaat een tweede snackbakker vóór plankjes en service; op een
     rustige woensdag wil je dat omgekeerd. Met één getal per plek kon dat
     niet. */
  it('gebruikt het doordeweekse getal als dat is ingevuld', () => {
    const snack = plek('Snackbakker', 10, 3, 2, 6)
    expect(belangOp(snack, false)).toBe(10)
    expect(belangOp(snack, true)).toBe(6)
  })

  /* Leeg betekent: hetzelfde als in het weekend. Zo hoef je alleen in te vullen
     wat afwijkt, en zegt een ingevuld getal dat er iets bijzonders is. */
  it('valt terug op het gewone belang als het leeg is', () => {
    const kassa = plek('Kassa', 10, 1)
    expect(belangOp(kassa, true)).toBe(10)
  })

  it('zet de stoelen doordeweeks in een andere volgorde', () => {
    const plekken = [plek('Snackbakker', 10, 1, 2, 6), plek('Plankjes', 8, 2)]
    const weekend = stoelenVan(plekken).map((s) => s.belang)
    const doordeweeks = stoelenVan(plekken, true).map((s) => s.belang)
    // In het weekend wint zelfs de tweede snackbakker (9) van plankjes (8).
    expect(weekend).toEqual([10, 9, 8])
    // Doordeweeks komt plankjes vóór allebei de snackbakkers.
    expect(doordeweeks).toEqual([6, 5, 8])
  })

  it('weet welke dagen doordeweeks zijn', () => {
    expect(isDoordeweeks('2026-11-10')).toBe(true) // dinsdag
    expect(isDoordeweeks('2026-11-12')).toBe(true) // donderdag
    expect(isDoordeweeks('2026-11-14')).toBe(false) // zaterdag
    expect(isDoordeweeks('2026-11-09')).toBe(false) // maandag, dicht
  })
})
