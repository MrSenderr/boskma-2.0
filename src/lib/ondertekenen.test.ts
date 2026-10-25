/* Digitaal tekenen.
 *
 * De toetsen gaan over de volgorde en over wie er aan zet is. Een contract dat
 * alleen de werkgever heeft getekend is geen contract maar een aanbod, en een
 * scherm dat de verkeerde knop toont laat iemand op het verkeerde moment
 * tekenen. */

import { describe, expect, it } from 'vitest'
import {
  codeKort,
  ouderNodig,
  standVan,
  wachtOpMedewerker,
  wachtOpWerkgever,
  type Ondertekening,
} from './ondertekenen'
import type { Persoon } from './personeel'

const o = (anders: Partial<Ondertekening> = {}): Ondertekening =>
  ({
    id: 'o1',
    medewerker_id: 'p1',
    document_id: 1,
    voorstel_id: null,
    origineel_sha256: 'a'.repeat(64),
    origineel_naam: 'contract.pdf',
    ouder_nodig: false,
    gestart_op: '2026-10-25T09:00:00Z',
    gestart_door: 'sander@boskmafoodservice.nl',
    verstuurd_op: null,
    geopend_op: null,
    medewerker_naam: null,
    medewerker_krabbel: null,
    medewerker_op: null,
    ouder_naam: null,
    ouder_relatie: null,
    ouder_krabbel: null,
    ouder_op: null,
    werkgever_naam: null,
    werkgever_krabbel: null,
    werkgever_op: null,
    getekend_document_id: null,
    afgerond_op: null,
    ingetrokken_op: null,
    ingetrokken_reden: null,
    ...anders,
  }) as Ondertekening

describe('de stand van een ondertekening', () => {
  it('loopt van klaargezet naar getekend', () => {
    expect(standVan(o())).toBe('klaargezet')
    expect(standVan(o({ verstuurd_op: 'x' }))).toBe('bij_medewerker')
    expect(standVan(o({ verstuurd_op: 'x', medewerker_op: 'y' }))).toBe('jouw_beurt')
    expect(standVan(o({ verstuurd_op: 'x', medewerker_op: 'y', werkgever_op: 'z' }))).toBe('afmaken')
    expect(
      standVan(o({ verstuurd_op: 'x', medewerker_op: 'y', werkgever_op: 'z', afgerond_op: 'w' })),
    ).toBe('klaar')
  })

  it('zet ingetrokken boven alles', () => {
    expect(
      standVan(o({ verstuurd_op: 'x', medewerker_op: 'y', ingetrokken_op: 'z' })),
    ).toBe('ingetrokken')
  })
})

describe('wie er aan zet is', () => {
  it('wacht op de medewerker zodra het verstuurd is', () => {
    expect(wachtOpMedewerker(o())).toBe(false)
    expect(wachtOpMedewerker(o({ verstuurd_op: 'x' }))).toBe(true)
    expect(wachtOpMedewerker(o({ verstuurd_op: 'x', medewerker_op: 'y' }))).toBe(false)
  })

  /* Sander tekent mee, niet voor. Zolang de medewerker niet heeft getekend valt
     er voor de werkgever niets te doen — de database houdt dat ook tegen. */
  it('laat de werkgever pas aan zet als de medewerker heeft getekend', () => {
    expect(wachtOpWerkgever(o({ verstuurd_op: 'x' }))).toBe(false)
    expect(wachtOpWerkgever(o({ verstuurd_op: 'x', medewerker_op: 'y' }))).toBe(true)
  })

  it('is klaar als het afgerond of ingetrokken is', () => {
    expect(wachtOpWerkgever(o({ medewerker_op: 'y', afgerond_op: 'z' }))).toBe(false)
    expect(wachtOpWerkgever(o({ medewerker_op: 'y', ingetrokken_op: 'z' }))).toBe(false)
  })
})

describe('het vak voor een ouder', () => {
  const p = (geboortedatum: string | null): Persoon =>
    ({ id: 'p1', geboortedatum }) as unknown as Persoon

  it('verschijnt onder de 18', () => {
    expect(ouderNodig(p('2010-06-01'), '2026-10-25')).toBe(true)
  })

  it('verdwijnt op de dag dat hij 18 wordt', () => {
    expect(ouderNodig(p('2008-10-25'), '2026-10-24')).toBe(true)
    expect(ouderNodig(p('2008-10-25'), '2026-10-25')).toBe(false)
  })

  /* Geen geboortedatum is geen minderjarige. Anders verzint het scherm een
     reden voor een extra vak dat er niet hoort te staan. */
  it('verschijnt niet als de geboortedatum onbekend is', () => {
    expect(ouderNodig(p(null), '2026-10-25')).toBe(false)
    expect(ouderNodig(p('onbekend'), '2026-10-25')).toBe(false)
  })
})

describe('de controlecode', () => {
  it('toont het begin en het eind, zodat hij op één regel past', () => {
    expect(codeKort(`${'a'.repeat(8)}${'b'.repeat(48)}${'c'.repeat(8)}`)).toBe(
      'aaaaaaaa … cccccccc',
    )
  })

  // Een korte code verkorten maakt hem onleesbaar in plaats van korter.
  it('laat een korte code staan', () => {
    expect(codeKort('abc123')).toBe('abc123')
  })
})
