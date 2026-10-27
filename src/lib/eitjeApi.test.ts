import { describe, expect, it } from 'vitest'
import {
  alsKaart,
  dagUit,
  klokUit,
  koppelEitjeUsers,
  minutenVan,
  naarUrenrij,
  namenKaart,
  soortUit,
  splitsInStukken,
  splitsNaam,
  type ApiShift,
  type ApiUser,
  type AppKandidaat,
} from './eitjeApi'
import { telMee } from './gewerkteUren'

const shift = (extra: Partial<ApiShift> = {}): ApiShift => ({
  id: 32932404,
  date: '2026-10-22',
  start: '2026-10-22T17:00:00.000000+02:00',
  end: '2026-10-22T20:00:00.000000+02:00',
  break_minutes: 0,
  user: { id: 10, name: 'Nathal van Beurden' },
  type: { name: 'gewerkte_uren' },
  approved: true,
  ...extra,
})

describe('de soort', () => {
  /* Dit is de toets die er het meest toe doet. De API schrijft
     "gewerkte_uren", de database "gewerkte uren", en de regel die bepaalt wat
     als verloond meetelt kijkt naar de spatie-versie. Zou dit niet omgezet
     worden, dan komen de uren binnen en tellen ze voor nul — en komt er een
     twaalfmaandsgemiddelde uit dat te laag is. */
  it('wordt geschreven zoals de administratie hem kent', () => {
    expect(soortUit(shift())).toBe('gewerkte uren')
  })

  it('telt daarmee ook echt mee als verloond', () => {
    expect(telMee(soortUit(shift()))).toBe(true)
    expect(telMee(soortUit(shift({ type: { name: 'verlof' } })))).toBe(true)
    expect(telMee(soortUit(shift({ type: { name: 'bijzonder_verlof' } })))).toBe(true)
  })

  it('laat een onbekende soort staan in plaats van hem te verzinnen', () => {
    expect(soortUit(shift({ type: { name: 'ziek' } }))).toBe('ziek')
    expect(telMee('ziek')).toBe(false)
  })

  it('is leeg als eitje niets meegeeft', () => {
    expect(soortUit(shift({ type: null }))).toBeNull()
    expect(soortUit(shift({ type: { name: '  ' } }))).toBeNull()
  })
})

describe('de klok', () => {
  /* De serverfunctie draait in UTC. Een datumfunctie zou van 17:00+02:00
     15:00 maken en het hele rooster twee uur verschuiven. */
  it('is de tijd zoals hij in de zaak aan de muur hing', () => {
    expect(klokUit('2026-10-22T17:00:00.000000+02:00')).toBe('17:00:00')
    expect(klokUit('2026-01-02T08:30:00.000000+01:00')).toBe('08:30:00')
  })

  it('kan ook zonder seconden en zonder zone', () => {
    expect(klokUit('2026-10-22T17:00')).toBe('17:00:00')
    expect(klokUit('2026-10-22 17:05:09Z')).toBe('17:05:09')
  })

  it('is leeg bij niets of onzin', () => {
    expect(klokUit(null)).toBeNull()
    expect(klokUit('')).toBeNull()
    expect(klokUit('morgenmiddag')).toBeNull()
  })

  it('geeft de dag ook letterlijk terug', () => {
    expect(dagUit('2026-10-22T23:30:00.000000+02:00')).toBe('2026-10-22')
    expect(dagUit(null)).toBeNull()
  })
})

describe('de duur', () => {
  it('is het verschil tussen begin en eind, pauze eraf', () => {
    expect(minutenVan(shift())).toBe(180)
    expect(minutenVan(shift({ break_minutes: 30 }))).toBe(150)
  })

  it('rekent een dienst over middernacht gewoon door', () => {
    expect(
      minutenVan(
        shift({
          start: '2026-08-15T23:00:00.000000+02:00',
          end: '2026-08-16T01:30:00.000000+02:00',
        }),
      ),
    ).toBe(150)
  })

  /* De nacht waarin de klok terugging: 01:00 tot 03:00 op de klok, maar drie
     uur werk. Twee klokstanden van elkaar aftrekken geeft hier twee. */
  it('weet dat de nacht van de klokwisseling langer is dan hij lijkt', () => {
    expect(
      minutenVan(
        shift({
          start: '2026-10-25T01:00:00.000000+02:00',
          end: '2026-10-25T03:00:00.000000+01:00',
        }),
      ),
    ).toBe(180)
  })

  it('is nul als de tijdstippen ontbreken, in plaats van een gok', () => {
    expect(minutenVan(shift({ start: null }))).toBe(0)
    expect(minutenVan(shift({ end: 'onbekend' }))).toBe(0)
  })

  it('weigert een onmogelijke dienst in plaats van hem op te tellen', () => {
    // Achterstevoren, en langer dan een etmaal: allebei eerder een fout in de
    // tijdstippen dan echt gewerkte tijd.
    expect(minutenVan(shift({ end: '2026-10-22T09:00:00.000000+02:00' }))).toBe(0)
    expect(minutenVan(shift({ end: '2026-10-24T17:00:00.000000+02:00' }))).toBe(0)
  })

  it('wordt niet negatief van een pauze die langer is dan de dienst', () => {
    expect(minutenVan(shift({ break_minutes: 300 }))).toBe(0)
  })
})

describe('een urenregel wegschrijven', () => {
  const namen = namenKaart([
    { id: 10, first_name: 'Nathal', last_name: 'van Beurden' },
  ])

  it('neemt de voornaam en achternaam uit de medewerkerslijst over', () => {
    const rij = naarUrenrij(shift(), namen)
    expect(rij.voornaam).toBe('Nathal')
    // Zelf knippen bij "Nathal van Beurden" zou "van" als achternaam geven.
    expect(rij.achternaam).toBe('van Beurden')
  })

  it('valt terug op de naam uit de urenregel als de lijst hem niet kent', () => {
    const rij = naarUrenrij(shift({ user: { id: 99, name: 'Evi Mol' } }), namen)
    expect(rij.voornaam).toBe('Evi')
    expect(rij.achternaam).toBe('Mol')
  })

  it('zet het eitje-nummer en de medewerker erbij', () => {
    const rij = naarUrenrij(shift(), namen, new Map([[10, 'abc-123']]))
    expect(rij.eitje_user_id).toBe(10)
    expect(rij.medewerker_id).toBe('abc-123')
  })

  it('laat de medewerker leeg als de persoon niet thuis te brengen is', () => {
    const rij = naarUrenrij(shift({ user: { id: 77, name: 'Onbekend' } }), namen, new Map())
    expect(rij.medewerker_id).toBeNull()
    // Het nummer blijft wel staan: wijs je die persoon later aan, dan verhuist
    // zijn hele historie in één opdracht mee.
    expect(rij.eitje_user_id).toBe(77)
  })

  it('bewaart het nummer van eitje als kenmerk, zodat opnieuw ophalen niet stapelt', () => {
    expect(naarUrenrij(shift()).bron_id).toBe('32932404')
  })

  it('schrijft de rest van de regel zoals de tabel hem verwacht', () => {
    const rij = naarUrenrij(shift({ break_minutes: 30, meals: [{ name: 'lunch' }] }), namen)
    expect(rij).toMatchObject({
      datum: '2026-10-22',
      soort: 'gewerkte uren',
      begint: '17:00:00',
      eindigt: '20:00:00',
      minuten: 150,
      pauze_minuten: 30,
      maaltijden: 'lunch',
      goedgekeurd: true,
    })
  })

  it('houdt een dienst over middernacht op de dag waarop hij begon', () => {
    const rij = naarUrenrij(
      shift({
        date: '2026-08-15',
        start: '2026-08-15T23:00:00.000000+02:00',
        end: '2026-08-16T01:00:00.000000+02:00',
      }),
    )
    expect(rij.datum).toBe('2026-08-15')
    expect(rij.eindigt).toBe('01:00:00')
  })

  it('weet niet of de uren zijn afgetekend als eitje het niet zegt', () => {
    expect(naarUrenrij(shift({ approved: undefined })).goedgekeurd).toBeNull()
  })

  it('knipt een naam alleen als er niets beters is', () => {
    expect(splitsNaam('Evi')).toEqual({ voornaam: 'Evi', achternaam: null })
    expect(splitsNaam('  ')).toEqual({ voornaam: null, achternaam: null })
  })
})

describe('een periode in stukken', () => {
  it('geeft stukken van zeven dagen die met een dag overlappen', () => {
    /* De overlap is er expres: of eitje de einddatum meerekent staat niet in de
       documentatie. Een dag dubbel ophalen overschrijft zichzelf en kost niets;
       een dag missen maakt het urentotaal een zevende te laag zonder dat er
       iets van te zien is. */
    expect(splitsInStukken('2026-01-01', '2026-01-21')).toEqual([
      { van: '2026-01-01', tot: '2026-01-07' },
      { van: '2026-01-07', tot: '2026-01-13' },
      { van: '2026-01-13', tot: '2026-01-19' },
      { van: '2026-01-19', tot: '2026-01-21' },
    ])
  })

  it('kort het laatste stuk af op de einddatum', () => {
    const stukken = splitsInStukken('2026-01-01', '2026-01-10')
    expect(stukken[stukken.length - 1]).toEqual({ van: '2026-01-07', tot: '2026-01-10' })
  })

  it('laat geen enkele dag vallen, ook niet als de einddatum er niet bij hoort', () => {
    const stukken = splitsInStukken('2026-01-01', '2026-12-31')
    expect(stukken[0].van).toBe('2026-01-01')
    expect(stukken[stukken.length - 1].tot).toBe('2026-12-31')

    /* Elke dag moet door minstens één stuk gedekt zijn, ook wanneer van elk
       stuk de laatste dag niet meekomt. Daarom hier gerekend met tot-1. */
    const gedekt = new Set<string>()
    for (const stuk of stukken) {
      let dag = new Date(`${stuk.van}T12:00:00Z`)
      const eind = new Date(`${stuk.tot}T12:00:00Z`)
      while (dag < eind) {
        gedekt.add(dag.toISOString().slice(0, 10))
        dag = new Date(dag.getTime() + 86400000)
      }
    }
    let dag = new Date('2026-01-01T12:00:00Z')
    const laatste = new Date('2026-12-30T12:00:00Z')
    while (dag <= laatste) {
      expect(gedekt.has(dag.toISOString().slice(0, 10))).toBe(true)
      dag = new Date(dag.getTime() + 86400000)
    }
  })

  /* Een jaar is eenenzestig aanvragen. Met een seconde ertussen, zoals eitje
     vraagt, is dat ruim een minuut draaien — eenmalig, in stukken van acht
     weken per keer zodat de serverfunctie niet op zijn tijdslimiet loopt. */
  it('maakt van een jaar eenenzestig aanvragen', () => {
    expect(splitsInStukken('2026-01-01', '2026-12-31')).toHaveLength(61)
  })

  it('stapt netjes over de zomertijd heen', () => {
    // Zonder UTC-rekenen schuift de dag waarop de klok verzet wordt een dag op.
    expect(splitsInStukken('2026-03-25', '2026-04-08')).toEqual([
      { van: '2026-03-25', tot: '2026-03-31' },
      { van: '2026-03-31', tot: '2026-04-06' },
      { van: '2026-04-06', tot: '2026-04-08' },
    ])
  })

  it('geeft niets terug bij een periode die niet bestaat', () => {
    expect(splitsInStukken('2026-02-01', '2026-01-01')).toEqual([])
    expect(splitsInStukken('', '2026-01-01')).toEqual([])
  })

  it('kan ook zonder overlap, als ooit blijkt dat het niet hoeft', () => {
    expect(splitsInStukken('2026-01-01', '2026-01-14', 7, 7)).toEqual([
      { van: '2026-01-01', tot: '2026-01-07' },
      { van: '2026-01-08', tot: '2026-01-14' },
    ])
  })
})

describe('wie is wie', () => {
  const mw = (extra: Partial<AppKandidaat>): AppKandidaat => ({
    id: 'id-0',
    voornaam: null,
    achternaam: null,
    uit_dienst_op: null,
    ...extra,
  })

  const user = (extra: Partial<ApiUser>): ApiUser => ({ id: 1, ...extra })

  it('gebruikt het nummer als dat er al staat, en kijkt niet verder', () => {
    const k = koppelEitjeUsers(
      [user({ id: 42, first_name: 'Evi', email: 'evi@zonnetje.nl' })],
      [
        mw({ id: 'evi', voornaam: 'Evi', eitje_user_id: 42 }),
        mw({ id: 'ander', voornaam: 'Evi', email: 'evi@zonnetje.nl' }),
      ],
    )
    expect(k).toEqual([
      { eitje_user_id: 42, medewerker_id: 'evi', reden: 'nummer', naam: 'Evi' },
    ])
  })

  it('koppelt op e-mailadres, ook als de naam anders geschreven staat', () => {
    const k = koppelEitjeUsers(
      [user({ id: 7, first_name: 'Ilona', last_name: 'Swagerman', email: 'Ilona@Zonnetje.NL' })],
      [mw({ id: 'ilona', voornaam: 'Ilona', achternaam: 'Swagerman-Honselaar', email: 'ilona@zonnetje.nl' })],
    )
    expect(k[0]).toMatchObject({ medewerker_id: 'ilona', reden: 'e-mailadres' })
  })

  it('koppelt op geboortedatum met de voornaam erbij als het e-mailadres ontbreekt', () => {
    const k = koppelEitjeUsers(
      [user({ id: 8, first_name: 'Daan', last_name: 'V.', date_of_birth: '2008-03-04' })],
      [
        mw({ id: 'daan', voornaam: 'Daan', achternaam: 'Verhulst', geboortedatum: '2008-03-04' }),
        mw({ id: 'tim', voornaam: 'Tim', geboortedatum: '2008-03-04' }),
      ],
    )
    expect(k[0]).toMatchObject({ medewerker_id: 'daan', reden: 'geboortedatum' })
  })

  it('valt terug op de naam, met dezelfde module als de Excel-import', () => {
    const k = koppelEitjeUsers(
      [user({ id: 9, first_name: 'Justin', last_name: 'Oostwoud' })],
      [mw({ id: 'justin', voornaam: 'Justin', achternaam: 'Oostwoud' })],
    )
    expect(k[0]).toMatchObject({ medewerker_id: 'justin', reden: 'volledige naam' })
  })

  /* Hier zit het gevaar: twee eitje-nummers die op dezelfde persoon uitkomen.
     Dan belanden de uren van twee mensen op één, en klopt elk gemiddelde
     daarna niet meer. Liever niets koppelen en het melden. */
  it('geeft een medewerker niet twee keer weg', () => {
    const k = koppelEitjeUsers(
      [
        user({ id: 1, first_name: 'Evi', last_name: 'Mol' }),
        user({ id: 2, first_name: 'Evi', last_name: 'Mol' }),
      ],
      [mw({ id: 'evi', voornaam: 'Evi', achternaam: 'Mol' })],
    )
    expect(k[0].medewerker_id).toBe('evi')
    expect(k[1].medewerker_id).toBeNull()
  })

  it('meldt wie niet thuis te brengen is, met de naam zoals eitje hem schrijft', () => {
    const k = koppelEitjeUsers(
      [user({ id: 3, first_name: 'Kees', last_name: 'Uitzend' })],
      [mw({ id: 'evi', voornaam: 'Evi' })],
    )
    expect(k[0]).toMatchObject({ medewerker_id: null, naam: 'Kees Uitzend' })
  })

  it('respecteert een naam die met de hand op genegeerd is gezet', () => {
    const k = koppelEitjeUsers(
      [user({ id: 4, first_name: 'Kees', last_name: 'Uitzend' })],
      [mw({ id: 'kees', voornaam: 'Kees', achternaam: 'Uitzend' })],
      new Map([['kees uitzend', { medewerker_id: null, negeren: true }]]),
    )
    expect(k[0]).toMatchObject({ medewerker_id: null, reden: 'genegeerd' })
  })

  it('levert een kaart op om urenregels mee weg te schrijven', () => {
    const kaart = alsKaart([
      { eitje_user_id: 10, medewerker_id: 'abc', reden: 'nummer', naam: 'Evi' },
      { eitje_user_id: 11, medewerker_id: null, reden: 'onbekend', naam: 'Kees' },
    ])
    expect(kaart.get(10)).toBe('abc')
    expect(kaart.get(11)).toBeNull()
  })
})
