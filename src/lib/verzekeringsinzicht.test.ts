/* De export moet regel voor regel passen op wat Verzekeringsinzicht verwacht.
   Eén verschoven puntkomma en het hele bestand is onbruikbaar, dus dat toetsen
   we tegen het echte voorbeeldbestand in docs/. */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  KOLOMMEN,
  afgeleideVoorletters,
  bestandsnaam,
  bouwCsv,
  datumNL,
  dienstverbandVan,
  keurRij,
  naamdelen,
  postcodeSchoon,
  splitsAchternaam,
  splitsHuisnummer,
  teExporteren,
  werknemernummer,
  type ExportPersoon,
} from './verzekeringsinzicht'

/** Iemand bij wie alles klopt; per test pas je aan wat ertoe doet. */
function medewerker(anders: Partial<ExportPersoon> = {}): ExportPersoon {
  return {
    id: 'a',
    voornaam: 'Jan',
    achternaam: 'Oostwoud',
    voorletters: null,
    tussenvoegsel: null,
    geboortedatum: '2006-04-20',
    email: 'jan@example.nl',
    telefoonnummer: '0612345678',
    geslacht: 'M',
    straat: 'Dorpsstraat',
    huisnummer: '56',
    toevoeging: null,
    postcode: '1697 AH',
    woonplaats: 'Wervershoof',
    contracttype: 'Vaste uren',
    contractduur: 'bepaalde',
    contracturen: 32,
    functie: 'Medewerker fastservice I',
    ingangsdatum: '2026-07-01',
    einddatum: '2027-07-01',
    fase: 'medewerker',
    uit_dienst_op: null,
    loonbureau_verstuurd_op: '2026-06-01T10:00:00Z',
    ...anders,
  }
}

const kolom = (regel: string, naam: string) =>
  regel.split(';')[KOLOMMEN.indexOf(naam as (typeof KOLOMMEN)[number])]

describe('kop van het bestand', () => {
  const voorbeeld = readFileSync(
    new URL('../../docs/voorbeeld-export-verzekeringsinzicht.csv', import.meta.url),
    'utf8',
  ).replace(/^﻿/, '')

  it('heeft dezelfde eerste twee regels als de echte export', () => {
    const onze = bouwCsv([]).split('\n')
    const hunne = voorbeeld.split('\n')
    expect(onze[0]).toBe(hunne[0])
    expect(onze[1]).toBe(hunne[1])
  })

  it('houdt de kolomvolgorde aan uit het voorbeeldbestand', () => {
    expect(KOLOMMEN.join(';')).toBe(voorbeeld.split('\n')[1])
  })

  it('zet evenveel velden in een regel als er kolommen zijn', () => {
    const regel = bouwCsv([medewerker()]).split('\n')[2]
    expect(regel.split(';')).toHaveLength(KOLOMMEN.length)
  })
})

describe('de vier contractvormen', () => {
  it('0-urencontract wordt 0-uren met een 1, want 0 wordt geweigerd', () => {
    const dv = dienstverbandVan(
      medewerker({ contracttype: 'Nuluren-overeenkomst (oproep)', contracturen: null }),
    )
    expect(dv).toEqual({ soort: '0-uren', dienstverband: 'pt', percentage: 1, uren: 1 })
  })

  it('32 uur is parttime en 80 procent', () => {
    expect(dienstverbandVan(medewerker({ contracturen: 32 }))).toEqual({
      soort: 'regulier',
      dienstverband: 'pt',
      percentage: 80,
      uren: 32,
    })
  })

  it('40 uur is fulltime en 100 procent', () => {
    expect(dienstverbandVan(medewerker({ contracturen: 40 }))).toEqual({
      soort: 'regulier',
      dienstverband: 'ft',
      percentage: 100,
      uren: 40,
    })
  })

  it('onbepaalde tijd heeft geen einddatum in het bestand', () => {
    const regel = bouwCsv([
      medewerker({ contractduur: 'onbepaalde', einddatum: '2027-01-01', contracturen: 40 }),
    ]).split('\n')[2]
    expect(kolom(regel, 'Contract')).toBe('ONB')
    expect(kolom(regel, 'Einddatum')).toBe('')
  })

  it('bepaalde tijd houdt de einddatum wel', () => {
    const regel = bouwCsv([medewerker()]).split('\n')[2]
    expect(kolom(regel, 'Contract')).toBe('BEP')
    expect(kolom(regel, 'Einddatum')).toBe('01-07-2027')
  })
})

describe('opschonen van wat we opgeslagen hebben', () => {
  it('draait de datum om', () => {
    expect(datumNL('2026-07-01')).toBe('01-07-2026')
    expect(datumNL(null)).toBe('')
  })

  it('haalt de spatie uit de postcode', () => {
    expect(postcodeSchoon('1697 ah')).toBe('1697AH')
  })

  it('zet de woonplaats in hoofdletters', () => {
    const regel = bouwCsv([medewerker()]).split('\n')[2]
    expect(kolom(regel, 'plaats')).toBe('WERVERSHOOF')
  })

  it('knipt de toevoeging van het huisnummer', () => {
    expect(splitsHuisnummer('82 A')).toEqual({ nummer: '82', toevoeging: 'A' })
    expect(splitsHuisnummer('82A')).toEqual({ nummer: '82', toevoeging: 'A' })
    expect(splitsHuisnummer('82')).toEqual({ nummer: '82', toevoeging: '' })
  })

  it('een eigen toevoeging wint van wat we zelf afknippen', () => {
    const regel = bouwCsv([medewerker({ huisnummer: '82 A', toevoeging: 'bis' })]).split('\n')[2]
    expect(kolom(regel, 'huisnummer')).toBe('82')
    expect(kolom(regel, 'toevoeging')).toBe('bis')
  })
})

describe('namen', () => {
  it('maakt voorletters van een dubbele voornaam', () => {
    expect(afgeleideVoorletters('Jan')).toBe('J.')
    expect(afgeleideVoorletters('Jan Pieter')).toBe('J.P.')
    expect(afgeleideVoorletters('Jan-Pieter')).toBe('J.P.')
  })

  it('haalt het tussenvoegsel uit de achternaam', () => {
    expect(splitsAchternaam('de Vries')).toEqual({ tussenvoegsel: 'de', achternaam: 'Vries' })
    expect(splitsAchternaam('van der Berg')).toEqual({
      tussenvoegsel: 'van der',
      achternaam: 'Berg',
    })
  })

  it('laat een achternaam die er alleen op lijkt met rust', () => {
    expect(splitsAchternaam('Vandenberg')).toEqual({ tussenvoegsel: '', achternaam: 'Vandenberg' })
  })

  it('wat Sander invult wint van wat wij afleiden', () => {
    const n = naamdelen(medewerker({ voornaam: 'Jan', voorletters: 'J.P.' }))
    expect(n.voorletters).toBe('J.P.')
  })

  it('zet het tussenvoegsel niet twee keer neer', () => {
    const n = naamdelen(medewerker({ achternaam: 'de Vries', tussenvoegsel: 'de' }))
    expect(n).toMatchObject({ tussenvoegsel: 'de', achternaam: 'Vries' })
  })

  it('maakt initialen voor het werknemernummer', () => {
    expect(werknemernummer(medewerker({ voornaam: 'Jan', achternaam: 'de Vries' }))).toBe('JV')
  })
})

describe('wie er meedoet', () => {
  const vandaag = new Date('2026-09-02T00:00:00Z')

  it('laat wie uit dienst is eruit', () => {
    expect(teExporteren([medewerker({ uit_dienst_op: '2026-08-01' })], vandaag)).toHaveLength(0)
  })

  it('laat een verlopen contract eruit', () => {
    expect(teExporteren([medewerker({ einddatum: '2026-08-31' })], vandaag)).toHaveLength(0)
  })

  it('houdt een contract dat vandaag nog loopt', () => {
    expect(teExporteren([medewerker({ einddatum: '2026-09-02' })], vandaag)).toHaveLength(1)
  })

  it('laat wie nog geen contract heeft eruit', () => {
    expect(teExporteren([medewerker({ loonbureau_verstuurd_op: null })], vandaag)).toHaveLength(0)
  })
})

describe('nakijken vóór het exporteren', () => {
  it('zegt niets als alles klopt', () => {
    expect(keurRij(medewerker())).toEqual([])
  })

  it('mist de uren bij een contract met vaste uren', () => {
    expect(keurRij(medewerker({ contracturen: null }))).toContain('contracturen per week')
  })

  it('mist het geslacht als het invulformulier nog niet terug is', () => {
    expect(keurRij(medewerker({ geslacht: null }))).toContain(
      'geslacht (staat in het invulformulier)',
    )
  })

  it('mist de einddatum bij bepaalde tijd', () => {
    expect(keurRij(medewerker({ einddatum: null }))).toContain('einddatum')
  })

  it('herkent een postcode die niet klopt', () => {
    expect(keurRij(medewerker({ postcode: '169 AH' }))).toContain('postcode klopt niet')
  })

  it('struikelt niet over een 0-urencontract zonder uren', () => {
    expect(
      keurRij(medewerker({ contracttype: 'Nuluren-overeenkomst (oproep)', contracturen: null })),
    ).toEqual([])
  })
})

describe('bestandsnaam', () => {
  it('heeft de datum van vandaag', () => {
    expect(bestandsnaam(new Date('2026-09-02T12:00:00Z'))).toBe(
      'werknemers-Arbeidsovereenkomst-20260902.csv',
    )
  })
})
