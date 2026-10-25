/* Het etiket op een personeelskaart.
 *
 * Eén geval telt hier zwaarder dan de rest: een oefenkaart die eruitziet als
 * een medewerker is een mail die een keer naar de verkeerde gaat. */

import { describe, expect, it } from 'vitest'
import { toestandVan, type Persoon } from './personeel'

const p = (anders: Partial<Persoon>): Persoon =>
  ({
    id: 'p1',
    voornaam: 'Test',
    achternaam: 'Persoon',
    fase: 'medewerker',
    status: 'aangenomen',
    is_eigenaar: false,
    is_test: false,
    uit_dienst_op: null,
    loonbureau_verstuurd_op: null,
    loonbureau_bevestigd_op: null,
    onboarding_verstuurd_op: null,
    onboarding_ingevuld_op: null,
    ...anders,
  }) as Persoon

describe('het etiket op een kaart', () => {
  it('noemt een oefenkaart een oefenkaart, wat er verder ook op staat', () => {
    expect(toestandVan(p({ is_test: true })).label).toBe('Oefenkaart')
    expect(
      toestandVan(p({ is_test: true, loonbureau_bevestigd_op: '2026-01-01' })).label,
    ).toBe('Oefenkaart')
    // Ook een oefenkaart die uit dienst is blijft als oefenkaart herkenbaar.
    expect(toestandVan(p({ is_test: true, uit_dienst_op: '2026-06-01' })).label).toBe('Oefenkaart')
  })

  it('laat een echte medewerker zijn eigen stand houden', () => {
    expect(toestandVan(p({ loonbureau_bevestigd_op: '2026-01-01' })).label).toBe('In dienst')
    expect(toestandVan(p({ uit_dienst_op: '2026-06-01' })).label).toBe('Uit dienst')
    expect(toestandVan(p({ is_eigenaar: true })).label).toBe('Meewerkend eigenaar')
  })
})
