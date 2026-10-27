import { describe, expect, it } from 'vitest'
import { loopt, standVanDag, wieSleutel, type Afwezig, type Opgave } from './beschikbaarheid'

const opgave = (anders: Partial<Opgave> = {}): Opgave => ({
  bron_id: 'beschikbaar:1',
  datum: '2026-11-14',
  status: 'unavailable',
  opmerking: null,
  naam: 'Evi Dudink',
  medewerker_id: 'evi',
  ...anders,
})

const afwezig = (anders: Partial<Afwezig> = {}): Afwezig => ({
  bron_id: 'verlof:1',
  soort: 'verlof',
  van: '2026-11-14',
  tot: '2026-11-16',
  status: 'accepted',
  reden: null,
  naam: 'Evi Dudink',
  medewerker_id: 'evi',
  ...anders,
})

describe('loopt een periode op deze dag', () => {
  it('telt de eerste en de laatste dag mee', () => {
    const p = { van: '2026-11-14', tot: '2026-11-16' }
    expect(loopt(p, '2026-11-14')).toBe(true)
    expect(loopt(p, '2026-11-16')).toBe(true)
    expect(loopt(p, '2026-11-13')).toBe(false)
    expect(loopt(p, '2026-11-17')).toBe(false)
  })

  /* Eitje geeft een ziekmelding zonder einddatum terug zolang hij loopt. Zou
     hier "tussen van en tot" gevraagd worden, dan viel zo iemand vanaf dag twee
     buiten de lijst en stond hij weer gewoon inzetbaar in het rooster. */
  it('loopt door als er geen einddatum is', () => {
    const p = { van: '2026-11-14', tot: null }
    expect(loopt(p, '2026-11-14')).toBe(true)
    expect(loopt(p, '2027-03-01')).toBe(true)
    expect(loopt(p, '2026-11-13')).toBe(false)
  })
})

describe('de stand van een dag', () => {
  const dag = '2026-11-14'

  it('zet wie zelf heeft opgegeven dat hij niet kan in de lijst, met zijn reden', () => {
    const uit = standVanDag(dag, [opgave({ opmerking: 'bruiloft' })], [])
    expect(uit.weg).toEqual([
      {
        naam: 'Evi Dudink',
        reden: 'opgegeven',
        toelichting: 'bruiloft',
        onzeker: false,
        medewerker_id: 'evi',
      },
    ])
  })

  it('houdt apart wie juist heeft gezegd dat hij kan', () => {
    const uit = standVanDag(dag, [opgave({ status: 'available', opmerking: 'zin in' })], [])
    expect(uit.weg).toHaveLength(0)
    expect(uit.kan).toEqual([
      { naam: 'Evi Dudink', toelichting: 'zin in', medewerker_id: 'evi' },
    ])
  })

  it('meldt verlof, met de reden erbij', () => {
    const uit = standVanDag(dag, [], [afwezig({ reden: 'Bruiloft' })])
    expect(uit.weg[0]).toMatchObject({ reden: 'verlof', toelichting: 'Bruiloft', onzeker: false })
  })

  it('zegt erbij als het verlof nog niet is goedgekeurd', () => {
    const uit = standVanDag(dag, [], [afwezig({ status: 'pending' })])
    expect(uit.weg[0].onzeker).toBe(true)
  })

  it('meldt een ziekmelding die nog loopt', () => {
    const uit = standVanDag(
      '2026-11-20',
      [],
      [afwezig({ bron_id: 'ziek:1', soort: 'ziek', van: '2026-11-02', tot: null })],
    )
    expect(uit.weg[0]).toMatchObject({ reden: 'ziek' })
  })

  /* Drie keer dezelfde naam onder elkaar is geen informatie maar ruis, en bij
     ruis ga je kijken over de lijst heen. */
  it('noemt iemand één keer, met de zwaarste reden', () => {
    const uit = standVanDag(
      dag,
      [opgave()],
      [
        afwezig(),
        afwezig({ bron_id: 'ziek:1', soort: 'ziek', van: dag, tot: dag }),
      ],
    )
    expect(uit.weg).toHaveLength(1)
    expect(uit.weg[0].reden).toBe('ziek')
  })

  /* De opgave is dan ouder dan de werkelijkheid: hij had gezegd dat hij kon,
     en is daarna ziek geworden. */
  it('gelooft een "ik kan wel" niet van iemand die ziek is', () => {
    const uit = standVanDag(
      dag,
      [opgave({ status: 'available' })],
      [afwezig({ bron_id: 'ziek:1', soort: 'ziek', van: dag, tot: dag })],
    )
    expect(uit.kan).toHaveLength(0)
    expect(uit.weg[0].reden).toBe('ziek')
  })

  it('kijkt alleen naar de gevraagde dag', () => {
    const uit = standVanDag(dag, [opgave({ datum: '2026-11-15' })], [])
    expect(uit.weg).toHaveLength(0)
  })

  /* Iemand die in eitje staat maar hier nog niet gekoppeld is, hoort met
     zichzelf samen te vallen en niet twee keer in de lijst te komen. */
  it('houdt een ongekoppelde naam bij elkaar', () => {
    const uit = standVanDag(
      dag,
      [opgave({ naam: 'Jasper Wijdenes', medewerker_id: null })],
      [afwezig({ naam: 'jasper wijdenes', medewerker_id: null })],
    )
    expect(uit.weg).toHaveLength(1)
    expect(uit.weg[0].reden).toBe('verlof')
  })

  it('zet de namen op alfabet, zodat de lijst niet rondspringt', () => {
    const uit = standVanDag(
      dag,
      [
        opgave({ bron_id: 'b:1', naam: 'Thijmen Bakker', medewerker_id: 'thijmen' }),
        opgave({ bron_id: 'b:2', naam: 'Daan Verhulst', medewerker_id: 'daan' }),
      ],
      [],
    )
    expect(uit.weg.map((w) => w.naam)).toEqual(['Daan Verhulst', 'Thijmen Bakker'])
  })

  /* De lijst "kan wel" is er om iemand te bellen als er iemand uitvalt. Wie al
     werkt is geen reserve, en zou de lijst vullen met namen die je overslaat. */
  it('laat weg wie die dag al op het rooster staat', () => {
    const opgaven = [
      opgave({ bron_id: 'b:1', status: 'available' }),
      opgave({ bron_id: 'b:2', status: 'available', naam: 'Daan Verhulst', medewerker_id: 'daan' }),
    ]
    const uit = standVanDag(dag, opgaven, [], ['evi'])
    expect(uit.kan.map((k) => k.naam)).toEqual(['Daan Verhulst'])
  })

  it('herkent ook een ongekoppelde naam als al ingeroosterd', () => {
    const uit = standVanDag(
      dag,
      [opgave({ status: 'available', naam: 'Jasper Wijdenes', medewerker_id: null })],
      [],
      [wieSleutel({ medewerker_id: null, naam: 'jasper wijdenes' })],
    )
    expect(uit.kan).toHaveLength(0)
  })

  it('valt niet om zonder gegevens', () => {
    expect(standVanDag(dag, [], [])).toEqual({ weg: [], kan: [] })
  })
})
