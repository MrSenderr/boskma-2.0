import { describe, expect, it } from 'vitest'
import { klok, opTijd, telDag, type Sjabloonregel } from './weeksjabloon'

const regel = (anders: Partial<Sjabloonregel>): Sjabloonregel => ({
  id: Math.random().toString(36).slice(2),
  dag: 5,
  soort: 'dag',
  begint: '12:00:00',
  eindigt: '20:00:00',
  aantal: 1,
  opmerking: null,
  ...anders,
})

/* Vrijdag zoals het sjabloon hem kent: een voorbereiding om tien uur, een
   dagdienst om elf, twee om twaalf, en twee avonddiensten. */
const vrijdag: Sjabloonregel[] = [
  regel({ soort: 'voorbereiding', begint: '10:00:00' }),
  regel({ soort: 'dag', begint: '11:00:00' }),
  regel({ soort: 'dag', begint: '12:00:00', aantal: 2 }),
  regel({ soort: 'avond', begint: '17:00:00', aantal: 2 }),
]

describe('wat er op een dag staat', () => {
  /* Dagdiensten lopen door tot sluitingstijd, dus die staan er om vijf uur
     gewoon bij. Vier overdag plus twee 's avonds is zes paar handen tijdens de
     spits — met Sander erbij de zeven waar de spitsindeling op rekent. Zou
     "samen" alleen de avonddiensten tellen, dan leek vrijdag onderbezet. */
  it('telt de dagdiensten mee in wat er tijdens de spits staat', () => {
    expect(telDag(vrijdag, 5)).toMatchObject({ overdag: 4, avond: 2, samen: 6 })
  })

  it('telt de voorbereiding bij overdag', () => {
    const uit = telDag([regel({ soort: 'voorbereiding', begint: '10:00:00' })], 5)
    expect(uit.overdag).toBe(1)
    expect(uit.avond).toBe(0)
  })

  it('kijkt alleen naar de gevraagde dag', () => {
    expect(telDag([...vrijdag, regel({ dag: 6, aantal: 9 })], 5).samen).toBe(6)
  })

  /* Nul mag: zo zet je een dienst tijdelijk uit zonder de regel kwijt te
     raken, bijvoorbeeld in een rustige maand. */
  it('telt een dienst van nul als nul', () => {
    expect(telDag([regel({ aantal: 0 })], 5).samen).toBe(0)
  })

  it('geeft nul terug voor een dag zonder regels', () => {
    expect(telDag(vrijdag, 2)).toMatchObject({ overdag: 0, avond: 0, samen: 0 })
  })

  it('zet de regels op tijd, zodat de dag leest als een dag', () => {
    const uit = telDag(vrijdag, 5)
    expect(uit.regels.map((r) => klok(r.begint))).toEqual(['10:00', '11:00', '12:00', '17:00'])
  })

  it('houdt twee diensten op hetzelfde tijdstip uit elkaar op soort', () => {
    const gelijk = [
      regel({ soort: 'dag', begint: '12:00:00' }),
      regel({ soort: 'avond', begint: '12:00:00' }),
    ]
    expect(opTijd(gelijk).map((r) => r.soort)).toEqual(['avond', 'dag'])
  })
})

describe('de klok op het scherm', () => {
  it('laat de seconden weg', () => {
    expect(klok('17:00:00')).toBe('17:00')
    expect(klok('09:30:00')).toBe('09:30')
  })
})
