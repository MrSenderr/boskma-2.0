/* De import moet twee bestanden aankunnen die er anders uitzien en toch
   hetzelfde bedoelen. Daarom wordt er niet op verzonnen XML getoetst maar op
   echte exports van eitje, in docs/voorbeeld-eitje/ — dezelfde bestanden, met
   verzonnen namen erin. */

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { leesWerkboek, type Werkboek } from './xlsx-lezen'
import { leesEitje, naarDatum, naarKlok, naarMinuten, sleutel, type Eitjebestand } from './eitje'

function bestand(naam: string): ArrayBuffer {
  const buffer = readFileSync(new URL(`../../docs/voorbeeld-eitje/${naam}`, import.meta.url))
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

let rooster: Eitjebestand
let uren: Eitjebestand
let roosterboek: Werkboek

beforeAll(async () => {
  roosterboek = await leesWerkboek(bestand('geplande-shifts.xlsx'))
  rooster = leesEitje(roosterboek)
  uren = leesEitje(await leesWerkboek(bestand('gewerkte-uren.xlsx')))
})

describe('het bestand uitpakken', () => {
  it('vindt allebei de tabbladen', () => {
    expect([...roosterboek.keys()]).toEqual(['table', 'log'])
  })

  it('leest een cel met een aangehechte regel als één tekst', () => {
    // "'t Voorbeeld" staat opgemaakt in het bestand en valt in de XML uiteen.
    expect(rooster.vestigingen).toBe("'T Voorbeeld")
  })

  it('weigert iets dat geen xlsx is', async () => {
    await expect(leesWerkboek(new TextEncoder().encode('hallo').buffer as ArrayBuffer)).rejects.toThrow(
      /geen geldig Excel-bestand/,
    )
  })
})

describe('geplande shifts', () => {
  it('herkent de soort aan het tabblad log', () => {
    expect(rooster.soort).toBe('planning')
  })

  it('leest de periode uit de kop', () => {
    expect(rooster.periode).toEqual({ van: '2026-09-07', tot: '2026-09-13' })
  })

  it('leest elke shift, zonder de optelrij onderaan', () => {
    expect(rooster.regels).toHaveLength(34)
    expect(rooster.regels.filter((r) => !r.voornaam)).toHaveLength(1)
  })

  it('zet een shift om naar één vorm', () => {
    const eerste = rooster.regels[0]
    expect(eerste).toMatchObject({
      bron_id: '31266552',
      datum: '2026-09-08',
      voornaam: 'Pieter',
      achternaam: 'Bakhuis',
      team: 'Vast Rooster Medewerkers',
      begint: '12:00',
      eindigt: '20:00',
      minuten: 480,
    })
  })

  it('houdt alle datums binnen de geëxporteerde periode', () => {
    for (const regel of rooster.regels) {
      expect(regel.datum >= '2026-09-07' && regel.datum <= '2026-09-13').toBe(true)
    }
  })
})

describe('gewerkte uren', () => {
  it('herkent de soort', () => {
    expect(uren.soort).toBe('gewerkt')
  })

  it('vult het jaartal aan dat in de datum ontbreekt', () => {
    // In het bestand staat "zaterdag 01 augustus", zonder jaar.
    expect(uren.regels[0].datum).toBe('2026-08-01')
    expect(uren.periode).toEqual({ van: '2026-08-01', tot: '2026-08-31' })
  })

  it('leest pauze en tijdvak', () => {
    expect(uren.regels[0]).toMatchObject({
      voornaam: 'Bram',
      begint: '12:00',
      eindigt: '19:45',
      minuten: 465,
      pauze_minuten: 0,
      soort: 'gewerkte uren',
    })
  })

  it('telt op tot wat er in de optelrij van de export staat', () => {
    // De export zelf meldt onderaan 696:45 over augustus.
    const totaal = uren.regels.reduce((som, r) => som + r.minuten, 0)
    expect(naarKlok(totaal)).toBe('696:45')
  })

  it('waarschuwt voor regels van nul uur en voor de ontbrekende achternaam', () => {
    expect(uren.waarschuwingen.join(' ')).toMatch(/nul uur/)
    expect(uren.waarschuwingen.join(' ')).toMatch(/geen achternaam/)
  })

  it('geeft elke regel een eigen bron_id', () => {
    const ids = new Set(uren.regels.map((r) => r.bron_id))
    expect(ids.size).toBe(uren.regels.length)
  })
})

describe('losse omzettingen', () => {
  it('leest tijden als minuten', () => {
    expect(naarMinuten('08:00')).toBe(480)
    expect(naarMinuten('7:45')).toBe(465)
    expect(naarMinuten('')).toBe(0)
  })

  it('schrijft minuten weer als klok, ook negatief', () => {
    expect(naarKlok(465)).toBe('7:45')
    expect(naarKlok(-90)).toBe('-1:30')
  })

  it('kent de datumvormen van allebei de exports', () => {
    expect(naarDatum('08/09/2026')).toBe('2026-09-08')
    expect(naarDatum('2026-09-08')).toBe('2026-09-08')
    expect(naarDatum('zaterdag 01 augustus', { van: '2026-08-01', tot: '2026-08-31' })).toBe('2026-08-01')
  })

  it('kiest bij een periode over de jaarwisseling het juiste jaar', () => {
    const periode = { van: '2026-12-28', tot: '2027-01-03' }
    expect(naarDatum('maandag 28 december', periode)).toBe('2026-12-28')
    expect(naarDatum('vrijdag 01 januari', periode)).toBe('2027-01-01')
  })

  it('maakt van een kopje met sorteerpijl een gewone sleutel', () => {
    expect(sleutel('▲ datum')).toBe('datum')
    expect(sleutel('  Start- tot   Eindtijd ')).toBe('start- tot eindtijd')
  })
})
