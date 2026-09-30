import { describe, expect, it } from 'vitest'
import { koppel, naamSleutel, type Kandidaat } from './koppelen'

const ILONA: Kandidaat = { id: '1', voornaam: 'Ilona', achternaam: 'Swagerman-Honselaar', uit_dienst_op: null }
const EVI: Kandidaat = { id: '2', voornaam: 'Evi', achternaam: 'Dudink', uit_dienst_op: null }
const EVI2: Kandidaat = { id: '3', voornaam: 'Evi', achternaam: 'Bakker', uit_dienst_op: null }
const OUD: Kandidaat = { id: '4', voornaam: 'Evi', achternaam: 'Prins', uit_dienst_op: '2026-01-01' }
const JOOST: Kandidaat = { id: '5', voornaam: 'Joost', achternaam: 'van der Geest', uit_dienst_op: null }
const IEDEREEN = [ILONA, EVI, EVI2, OUD, JOOST]

describe('koppelen', () => {
  it('plaatst een volledige naam', () => {
    expect(koppel({ voornaam: 'Evi', achternaam: 'Dudink' }, IEDEREEN)).toEqual({
      medewerker_id: '2',
      reden: 'volledige naam',
    })
  })

  it('plaatst een naam waar een deel van de achternaam is weggelaten', () => {
    // eitje: "Ilona Swagerman". Personeelsbestand: "Swagerman-Honselaar".
    expect(koppel({ voornaam: 'Ilona', achternaam: 'Swagerman' }, IEDEREEN)).toMatchObject({
      medewerker_id: '1',
      reden: 'deel van de achternaam',
    })
  })

  it('trekt zich niets aan van hoofdletters en tussenvoegsels', () => {
    expect(koppel({ voornaam: 'Joost', achternaam: 'Van Der Geest' }, IEDEREEN)).toMatchObject({
      medewerker_id: '5',
    })
  })

  it('plaatst een losse voornaam als er maar één zo heet', () => {
    expect(koppel({ voornaam: 'Ilona', achternaam: null }, IEDEREEN)).toEqual({
      medewerker_id: '1',
      reden: 'voornaam',
    })
  })

  it('kiest bij een losse voornaam degene die nog in dienst is', () => {
    expect(koppel({ voornaam: 'Evi', achternaam: null }, [EVI, OUD])).toMatchObject({
      medewerker_id: '2',
    })
  })

  it('gokt niet als twee collegas dezelfde voornaam hebben', () => {
    expect(koppel({ voornaam: 'Evi', achternaam: null }, IEDEREEN)).toEqual({
      medewerker_id: null,
      reden: 'meerdere',
    })
  })

  it('gokt niet op de voornaam als de achternaam er niet bij past', () => {
    expect(koppel({ voornaam: 'Evi', achternaam: 'Vermeulen' }, [EVI])).toEqual({
      medewerker_id: null,
      reden: 'onbekend',
    })
  })

  it('ziet "Deenen" niet aan voor "Deen"', () => {
    const deen = { id: '9', voornaam: 'Lenthe', achternaam: 'Deen', uit_dienst_op: null }
    expect(koppel({ voornaam: 'Lenthe', achternaam: 'Deenen' }, [deen]).medewerker_id).toBeNull()
  })

  it('kent iemand die nergens in het personeelsbestand staat niet toe', () => {
    expect(koppel({ voornaam: 'Jasper', achternaam: null }, IEDEREEN)).toEqual({
      medewerker_id: null,
      reden: 'onbekend',
    })
  })

  it('herkent een open dienst', () => {
    expect(koppel({ voornaam: null, achternaam: null }, IEDEREEN).reden).toBe('open')
  })
})

describe('een naam die met de hand is aangewezen', () => {
  const afspraken = new Map([['jasper', { medewerker_id: '2', negeren: false }]])

  it('wint van alles', () => {
    expect(koppel({ voornaam: 'Jasper', achternaam: null }, IEDEREEN, afspraken)).toEqual({
      medewerker_id: '2',
      reden: 'handmatig',
    })
  })

  it('geldt ook voor de export die wél een achternaam meestuurt', () => {
    expect(koppel({ voornaam: 'Jasper', achternaam: 'Kool' }, IEDEREEN, afspraken)).toMatchObject({
      medewerker_id: '2',
    })
  })

  it('laat een naam die bewust genegeerd wordt met rust', () => {
    const negeer = new Map([['evi', { medewerker_id: null, negeren: true }]])
    expect(koppel({ voornaam: 'Evi', achternaam: null }, IEDEREEN, negeer)).toEqual({
      medewerker_id: null,
      reden: 'genegeerd',
    })
  })
})

describe('naamSleutel', () => {
  it('maakt van dezelfde naam altijd dezelfde sleutel', () => {
    expect(naamSleutel(' Évi ', "D'Udink")).toBe('evi dudink')
    expect(naamSleutel('Evi', null)).toBe('evi')
  })
})
