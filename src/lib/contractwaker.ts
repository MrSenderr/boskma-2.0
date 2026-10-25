import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { naamVan, urensoortVan, type Persoon } from './personeel'

/* De contractwaker: wat er rond een contract op een datum moet gebeuren, zodat
   het niet pas opvalt als het al te laat is.

   Alles wordt afgeleid uit wat er al op de kaart staat (ingangsdatum,
   einddatum, contracttype, geboortedatum). Er wordt niets opgeslagen, dus een
   melding verdwijnt vanzelf zodra de datum voorbij is of de kaart is bijgewerkt.

   Drie regels:

   1. Aanzeggen — bij een contract voor bepaalde tijd van zes maanden of langer
      moet je uiterlijk een maand vóór de einddatum schriftelijk laten weten of
      je verlengt, en zo ja onder welke voorwaarden. Te laat of niet: de
      medewerker kan een vergoeding van maximaal een maandloon vragen.
   2. Oproepkracht twaalf maanden — na twaalf maanden op een nulurencontract
      moet je binnen een maand een aanbod doen voor vaste uren (het gemiddelde
      van die twaalf maanden).
   3. Verjaardag onder de 21 — het (jeugd)minimumloon gaat omhoog, en bij 16 en
      18 veranderen ook de regels voor werktijden. Alleen een seintje; het
      uurloon zelf wordt bewust niet getoetst (besluit 22 augustus 2026).

   Let op bij overgenomen medewerkers: de ingangsdatum is die van hun contract
   bij Boskma, maar bij een overname tellen de jaren bij de vorige eigenaar mee.
   Wie al langer oproepkracht is, kan de twaalf maanden dus al voorbij zijn. */

export type Ernst = 'fout' | 'letop'

export type Signaal = {
  persoonId: string
  naam: string
  soort: 'aanzeggen' | 'einde' | 'vaste_uren' | 'verjaardag'
  /** Wat er moet gebeuren, in een paar woorden. */
  wat: string
  /** De datum waar het om draait (JJJJ-MM-DD). */
  uiterlijk: string
  /** Dagen tot `uiterlijk`; negatief = voorbij. */
  dagen: number
  ernst: Ernst
}

/** Velden die de waker nodig heeft — geen onboarding_data. */
const WAKER_VELDEN =
  'id,voornaam,achternaam,status,fase,uit_dienst_op,is_eigenaar,' +
  'geboortedatum,contracttype,contractduur,ingangsdatum,einddatum'

/* ------------------------------------------------------------------ datums --- */

const ISO = /^\d{4}-\d{2}-\d{2}/

/** Twaalf uur 's middags, zodat zomertijd de datum niet verschuift. */
function alsDag(s: string) {
  return new Date(`${s.slice(0, 10)}T12:00:00`)
}

function iso(d: Date) {
  const j = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${j}-${m}-${dag}`
}

/** Zoveel maanden erbij; bestaat de dag niet (31 → februari), dan de laatste. */
export function plusMaanden(s: string, maanden: number) {
  const d = alsDag(s)
  const dag = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + maanden)
  const laatste = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate()
  d.setDate(Math.min(dag, laatste))
  return iso(d)
}

export function dagenTussen(van: string, tot: string) {
  return Math.round((alsDag(tot).getTime() - alsDag(van).getTime()) / 86_400_000)
}

/* ------------------------------------------------------------------ regels --- */

/** Hoe ver vooruit een signaal verschijnt. */
const VOORUIT = {
  aanzeggen: 42, // zes weken vóór de aanzegdatum
  einde: 42,
  vaste_uren: 28,
  verjaardag: 14,
}
/** Binnen zoveel dagen wordt het rood. */
const DRINGEND = 7

function ernstVan(dagen: number): Ernst {
  return dagen <= DRINGEND ? 'fout' : 'letop'
}

function telt(p: Persoon) {
  return p.fase === 'medewerker' && !p.uit_dienst_op && !p.is_eigenaar
}

export function signalenVoor(p: Persoon, vandaag: string): Signaal[] {
  if (!telt(p)) return []
  const uit: Signaal[] = []
  const basis = { persoonId: p.id, naam: naamVan(p) }

  // 1 en 2: aanzeggen en het einde zelf
  if (p.contractduur === 'bepaalde' && p.einddatum && ISO.test(p.einddatum)) {
    const einde = p.einddatum.slice(0, 10)
    const totEinde = dagenTussen(vandaag, einde)
    // Zes maanden of langer. Een half jaar vanaf 1 november eindigt op
    // 30 april, dus een dag vóór "zes maanden later" telt nog mee.
    const lang =
      p.ingangsdatum && ISO.test(p.ingangsdatum)
        ? dagenTussen(plusMaanden(p.ingangsdatum, 6), einde) >= -1
        : true // onbekend: liever een keer te veel gewaarschuwd

    if (totEinde >= 0) {
      if (lang) {
        const aanzeg = plusMaanden(einde, -1)
        const totAanzeg = dagenTussen(vandaag, aanzeg)
        if (totAanzeg <= VOORUIT.aanzeggen) {
          uit.push({
            ...basis,
            soort: 'aanzeggen',
            wat:
              totAanzeg < 0
                ? 'Aanzegtermijn voorbij — nu alsnog schriftelijk laten weten'
                : 'Schriftelijk laten weten of je verlengt',
            uiterlijk: aanzeg,
            dagen: totAanzeg,
            ernst: totAanzeg < 0 ? 'fout' : ernstVan(totAanzeg),
          })
        }
      } else if (totEinde <= VOORUIT.einde) {
        uit.push({
          ...basis,
          soort: 'einde',
          wat: 'Contract loopt af — verlengen of afronden',
          uiterlijk: einde,
          dagen: totEinde,
          ernst: ernstVan(totEinde),
        })
      }
    }
  }

  // 3: twaalf maanden oproep
  if (urensoortVan(p.contracttype) === 'geen' && p.contracttype && p.ingangsdatum && ISO.test(p.ingangsdatum)) {
    const jaar = plusMaanden(p.ingangsdatum, 12)
    const aanbod = plusMaanden(jaar, 1)
    const totJaar = dagenTussen(vandaag, jaar)
    const totAanbod = dagenTussen(vandaag, aanbod)
    if (totJaar <= VOORUIT.vaste_uren && totAanbod >= 0) {
      uit.push({
        ...basis,
        soort: 'vaste_uren',
        wat: '12 maanden oproep — aanbod vaste uren doen',
        uiterlijk: aanbod,
        dagen: totAanbod,
        ernst: ernstVan(totAanbod),
      })
    }
  }

  // 4: verjaardag onder de 21
  if (p.geboortedatum && ISO.test(p.geboortedatum)) {
    const geb = p.geboortedatum.slice(0, 10)
    const jaarNu = Number(vandaag.slice(0, 4))
    for (const j of [jaarNu, jaarNu + 1]) {
      const leeftijd = j - Number(geb.slice(0, 4))
      const dag = plusMaanden(geb, leeftijd * 12)
      const tot = dagenTussen(vandaag, dag)
      if (tot < 0 || tot > VOORUIT.verjaardag) continue
      if (leeftijd < 16 || leeftijd > 21) continue
      const extra = leeftijd === 16 || leeftijd === 18 ? ' en werktijden' : ''
      uit.push({
        ...basis,
        soort: 'verjaardag',
        wat: `Wordt ${leeftijd} — uurloon${extra} nakijken`,
        uiterlijk: dag,
        dagen: tot,
        ernst: 'letop',
      })
    }
  }

  return uit
}

/** Alle signalen, het dringendst bovenaan. */
export function signalen(personen: Persoon[], vandaag: string): Signaal[] {
  return personen
    .flatMap((p) => signalenVoor(p, vandaag))
    .sort((a, b) => a.dagen - b.dagen || a.naam.localeCompare(b.naam, 'nl'))
}

export function vandaagIso() {
  return iso(new Date())
}

/* ------------------------------------------------------------------ query --- */

export function useContractwaker() {
  return useQuery({
    queryKey: ['contractwaker'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Signaal[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select(WAKER_VELDEN)
        .eq('fase', 'medewerker')
        .eq('is_apparaat', false)
        .is('uit_dienst_op', null)
      if (error) throw new Error(error.message)
      return signalen((data ?? []) as unknown as Persoon[], vandaagIso())
    },
  })
}
