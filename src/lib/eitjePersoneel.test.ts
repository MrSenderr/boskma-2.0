/* Het personeelsbestand uit eitje. Hier komen loon en contract vandaan, dus
   een fout hier zet een verkeerd bedrag in je administratie. */

import { describe, expect, it } from 'vitest'
import {
  isPersoneelsbestand,
  leesPersoneel,
  naarBedrag,
  naarContracttype,
  naarContracturen,
  vergelijk,
  type Persoon,
  type Personeelsregel,
} from './eitjePersoneel'
import type { Werkboek } from './xlsx-lezen'

/* De kop en de eerste regels zoals ze echt in de export van 12 oktober 2026
   stonden. */
const TABEL = [
  ['Informatie:'],
  ['Geëxporteerd op', 'maandag 12-10-2026 13:58'],
  [''],
  [
    '▲ voornaam',
    'achternaam',
    'e-mailadres',
    'contracttype',
    'uurloon',
    'wekelijkse contracturen',
    'support ID',
  ],
  ['Brian', 'Geusebroek', 'Brian@Voorbeeld.nl', 'Uren Contract', '€8,24', '22:00', '137513'],
  ['Denzel', 'Raven', 'denzel@voorbeeld.nl', 'Nul Uren', '€8,24', '00:00', '137509'],
  ['', '', '', '', '', '54:00', ''],
]

const LOG = [
  ['Table type', 'user'],
  ['Export time', 'maandag 12-10-2026 13:58'],
  [
    'Columns',
    '0. user_first_name, 1. user_last_name, 2. user_email, 3. contract_type, 4. contract_hourly_wage, 5. contract_weekly_hours, 6. record_id',
  ],
]

const werkboek = (metLog = true): Werkboek => {
  const w: Werkboek = new Map([['table', TABEL]])
  if (metLog) w.set('log', LOG)
  return w
}

describe('losse waardes omzetten', () => {
  it('leest een bedrag met euroteken en komma', () => {
    expect(naarBedrag('€8,24')).toBe(8.24)
    expect(naarBedrag('€17')).toBe(17)
  })

  /* Nul euro is een bedrag, geen leeg veld: dat betekent dat er geen loon is
     ingevuld in eitje, en dat wil je zien in plaats van overslaan. */
  it('houdt nul euro als nul', () => {
    expect(naarBedrag('€0')).toBe(0)
    expect(naarBedrag('')).toBeNull()
    expect(naarBedrag(null)).toBeNull()
  })

  it('rekent contracturen om van klok naar getal', () => {
    expect(naarContracturen('22:00')).toBe(22)
    expect(naarContracturen('32:30')).toBe(32.5)
  })

  /* "00:00" bij een nul-urencontract is geen afspraak van nul uur; er is geen
     afspraak. Nul invullen zou suggereren dat die er wel is. */
  it('laat nul uur leeg', () => {
    expect(naarContracturen('00:00')).toBeNull()
  })

  it('vertaalt het contracttype van eitje naar dat van ons', () => {
    expect(naarContracttype('Uren Contract')).toBe('Vaste uren')
    expect(naarContracttype('Nul Uren')).toBe('Nuluren-overeenkomst (oproep)')
  })

  /* Iets onbekends laten we met rust in plaats van te gokken: een verkeerd
     contracttype werkt door in het mutatieformulier naar het loonbureau. */
  it('gokt niet bij een onbekend contracttype', () => {
    expect(naarContracttype('Iets nieuws')).toBeNull()
  })
})

describe('het bestand lezen', () => {
  it('herkent een personeelsbestand aan het tabblad log', () => {
    expect(isPersoneelsbestand(werkboek())).toBe(true)
    expect(isPersoneelsbestand(new Map([['table', TABEL]]))).toBe(false)
  })

  it('leest de regels, op kolomnaam en niet op plek', () => {
    const uit = leesPersoneel(werkboek())
    expect(uit.regels).toHaveLength(2)
    expect(uit.regels[0]).toMatchObject({
      voornaam: 'Brian',
      uurloon: 8.24,
      contracturen: 22,
      contracttype: 'Vaste uren',
      bronId: '137513',
    })
    expect(uit.regels[1].contracturen).toBeNull()
  })

  it('werkt ook zonder het tabblad log, op de Nederlandse koppen', () => {
    expect(leesPersoneel(werkboek(false)).regels).toHaveLength(2)
  })

  /* De laatste regel van een eitje-export is een totaaltelling zonder naam. */
  it('laat de totaalregel eronder weg', () => {
    expect(leesPersoneel(werkboek()).regels.every((r) => r.voornaam)).toBe(true)
  })

  it('zegt het als het een ander bestand is', () => {
    expect(() => leesPersoneel(new Map([['table', [['zomaar', 'iets']]]]))).toThrow(
      /geen herkenbare kolommen/,
    )
  })

  it('leest het mailadres in kleine letters', () => {
    expect(leesPersoneel(werkboek()).regels[0].email).toBe('brian@voorbeeld.nl')
  })
})

describe('naast de app leggen', () => {
  const regel = (r: Partial<Personeelsregel>): Personeelsregel => ({
    bronId: '1',
    voornaam: 'Kate',
    achternaam: 'Houtenbos',
    email: 'kate@voorbeeld.nl',
    contracttype: 'Nuluren-overeenkomst (oproep)',
    uurloon: 6.75,
    contracturen: null,
    ...r,
  })
  const persoon = (p: Partial<Persoon>): Persoon => ({
    id: 'p1',
    voornaam: 'Kate',
    achternaam: 'Houtenbos',
    email: 'Kate@Voorbeeld.nl',
    uurloon: '5.25',
    contracturen: null,
    contracttype: 'Nuluren-overeenkomst (oproep)',
    ...p,
  })

  it('vindt een afwijkend uurloon', () => {
    const uit = vergelijk([regel({})], [persoon({})])
    expect(uit.verschillen).toEqual([
      { persoonId: 'p1', naam: 'Kate Houtenbos', veld: 'uurloon', nu: 5.25, wordt: 6.75 },
    ])
  })

  it('zwijgt als alles gelijk is', () => {
    expect(vergelijk([regel({})], [persoon({ uurloon: '6.75' })]).verschillen).toEqual([])
  })

  /* Namen worden verschillend geschreven — "Van Beurden" tegenover
     "Beurden, Van" — dus koppelen gaat op mailadres, ongeacht hoofdletters. */
  it('koppelt op mailadres en niet op naam', () => {
    const uit = vergelijk(
      [regel({ voornaam: 'K.', achternaam: 'Houtenbos-Jansen' })],
      [persoon({})],
    )
    expect(uit.verschillen).toHaveLength(1)
    expect(uit.onbekend).toEqual([])
  })

  it('noemt wie er in het bestand staat maar niet in de app', () => {
    const uit = vergelijk([regel({ email: 'nieuw@voorbeeld.nl' })], [persoon({})])
    expect(uit.onbekend).toHaveLength(1)
    expect(uit.ontbreekt).toHaveLength(1)
  })

  /* Wie uit dienst gaat verdwijnt uit de export. Dat is geen wijziging die we
     voorstellen — dat is iets om te melden. */
  it('noemt wie in de app staat maar niet in het bestand', () => {
    expect(vergelijk([], [persoon({})]).ontbreekt.map((p) => p.id)).toEqual(['p1'])
  })

  it('stelt niets voor als eitje het veld niet heeft ingevuld', () => {
    const uit = vergelijk([regel({ uurloon: null, contracttype: null })], [persoon({})])
    expect(uit.verschillen).toEqual([])
  })
})

describe('jezelf', () => {
  /* Sander staat in eitje — daar hangt zijn eigen contract aan — maar niet in
     de personeelslijst van de app. Zonder uitzondering zou elke import melden
     dat hij zichzelf nog moet toevoegen. */
  it('wordt niet gemeld als ontbrekend in de app', () => {
    const regel = {
      bronId: '1',
      voornaam: 'Sander',
      achternaam: 'Boskma',
      email: 'sander@boskmafoodservice.nl',
      contracttype: null,
      uurloon: 0,
      contracturen: null,
    }
    expect(vergelijk([regel], [], 'Sander@Boskmafoodservice.nl').onbekend).toEqual([])
    expect(vergelijk([regel], []).onbekend).toHaveLength(1)
  })
})
