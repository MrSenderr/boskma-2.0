import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { naamVan, type Persoon } from './personeel'
import { dagenTussen, plusMaanden, vandaagIso } from './datums'
import { KETEN_MAX_CONTRACTEN, ketenVan, lopendContract, type Contract } from './contracten'

/* De datumhulpjes staan sinds 25 oktober 2026 in datums.ts, omdat de
   contractgeschiedenis met dezelfde maanden rekent. Hier blijven ze
   beschikbaar voor wie ze al gebruikte. */
export { dagenTussen, plusMaanden, vandaagIso }

/** Een datum die er als JJJJ-MM-DD uitziet; de database geeft soms meer mee. */
const ISO = /^\d{4}-\d{2}-\d{2}/

/* De contractwaker: wat er rond een contract op een datum moet gebeuren, zodat
   het niet pas opvalt als het al te laat is.

   Rekent sinds 25 oktober 2026 met de contracttabel in plaats van met de losse
   velden op de persoonskaart. Dat moest, om twee redenen:

   - De aanzegtermijn hoort bij een contract, niet bij een persoon. Wie drie
     contracten heeft gehad, heeft drie aanzegmomenten gehad.
   - Bij een overgenomen medewerker begon de telling voor het aanbod vaste uren
     al bij de vorige eigenaar. De kaart kende alleen de contractdatum, en
     daardoor zweeg de waker bij Ilona (in dienst sinds 2019) en Denzel (2023)
     terwijl het aanbod bij allebei jaren over tijd is.

   Er wordt niets opgeslagen: een melding verdwijnt zodra de datum voorbij is
   of er een contract bij komt.

   Vijf regels:

   1. Geen contract vastgelegd — dan valt er niets te rekenen, en dat hoort te
      blijken in plaats van stil te blijven. Deze regel is er omdat de waker
      nu uit een tabel leest die leeg kan zijn; de kaartvelden waren altijd
      gevuld.
   2. Aanzeggen — bij een contract voor bepaalde tijd van zes maanden of langer
      moet je uiterlijk een maand vóór de einddatum schriftelijk laten weten of
      je verlengt. Te laat of niet: tot een maandloon vergoeding.
   3. Einde — bij een kort contract geen aanzegplicht, wel een einddatum.
   4. Oproepkracht twaalf maanden — na twaalf maanden een aanbod voor vaste
      uren, binnen een maand. Gaat die maand voorbij, dan blijft de melding
      staan: de verplichting verdwijnt niet, hij wordt alleen duurder.
   5. Verjaardag onder de 21 — het jeugdloon gaat omhoog, en bij 16 en 18
      veranderen ook de werktijden. Alleen een seintje; het uurloon zelf wordt
      bewust niet getoetst (besluit 22 augustus 2026). */

export type Ernst = 'fout' | 'letop'

export type Signaal = {
  persoonId: string
  naam: string
  soort: 'geen_contract' | 'aanzeggen' | 'einde' | 'vaste_uren' | 'verjaardag'
  /** Wat er moet gebeuren, in een paar woorden. */
  wat: string
  /** De datum waar het om draait (JJJJ-MM-DD). */
  uiterlijk: string
  /** Dagen tot `uiterlijk`; negatief = voorbij. */
  dagen: number
  ernst: Ernst
  /** Bij een tijdelijk contract: hoeveelste van de drie. */
  ketenNummer?: number
  /** Een volgend tijdelijk contract wordt vanzelf een vast contract. */
  volgendeWordtVast?: boolean
}

/** Velden die de waker nodig heeft — geen onboarding_data. */
const WAKER_VELDEN =
  'id,voornaam,achternaam,status,fase,uit_dienst_op,is_eigenaar,geboortedatum,in_dienst_sinds'

/** De velden van een contract die de waker gebruikt. */
const CONTRACT_VELDEN = 'id,medewerker_id,werkgever,soort,duur,begint,eindigt,beeindigd_op'

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

/** De dag waarop deze persoon begon, ook als dat bij de vorige eigenaar was. */
function startVan(p: Persoon, contracten: Contract[]): string | null {
  if (p.in_dienst_sinds && ISO.test(p.in_dienst_sinds)) return p.in_dienst_sinds.slice(0, 10)
  const oudste = [...contracten].sort((a, b) => a.begint.localeCompare(b.begint))[0]
  return oudste?.begint ?? null
}

export function signalenVoor(p: Persoon, contracten: Contract[], vandaag: string): Signaal[] {
  if (!telt(p)) return []
  const uit: Signaal[] = []
  const basis = { persoonId: p.id, naam: naamVan(p) }

  // 1: niets vastgelegd
  if (contracten.length === 0) {
    return [
      {
        ...basis,
        soort: 'geen_contract',
        wat: 'Geen contract vastgelegd — de app kan niets rekenen',
        uiterlijk: vandaag,
        dagen: 0,
        ernst: 'letop',
      },
    ]
  }

  const huidig = lopendContract(contracten, vandaag)
  const keten = ketenVan(contracten, vandaag)
  const ketenInfo =
    huidig && huidig.duur === 'bepaalde'
      ? {
          ketenNummer: keten.schakels.find((s) => s.contract.id === huidig.id)?.nummer,
          volgendeWordtVast: keten.volgendeWordtVast,
        }
      : {}

  // 2 en 3: aanzeggen en het einde zelf
  if (huidig && huidig.duur === 'bepaalde' && huidig.eindigt) {
    const einde = huidig.eindigt.slice(0, 10)
    const totEinde = dagenTussen(vandaag, einde)
    // Zes maanden of langer. Een half jaar vanaf 1 november eindigt op
    // 30 april, dus een dag vóór "zes maanden later" telt nog mee.
    const lang = dagenTussen(plusMaanden(huidig.begint, 6), einde) >= -1

    if (totEinde >= 0) {
      if (lang) {
        const aanzeg = plusMaanden(einde, -1)
        const totAanzeg = dagenTussen(vandaag, aanzeg)
        if (totAanzeg <= VOORUIT.aanzeggen) {
          uit.push({
            ...basis,
            ...ketenInfo,
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
          ...ketenInfo,
          soort: 'einde',
          wat: 'Contract loopt af — verlengen of afronden',
          uiterlijk: einde,
          dagen: totEinde,
          ernst: ernstVan(totEinde),
        })
      }
    }
  }

  /* 4: twaalf maanden oproep.
     Gemeten vanaf de dag dat iemand begon, niet vanaf zijn huidige contract:
     bij een overname telt de tijd bij de vorige eigenaar mee. */
  const start = startVan(p, contracten)
  if (huidig && huidig.soort === 'nuluren' && start) {
    const jaar = plusMaanden(start, 12)
    const aanbod = plusMaanden(jaar, 1)
    const totJaar = dagenTussen(vandaag, jaar)
    const totAanbod = dagenTussen(vandaag, aanbod)

    if (totAanbod < 0) {
      /* Over tijd. Blijft staan tot er een aanbod ligt: de verplichting gaat
         niet weg, en de medewerker kan het verschil tot vijf jaar terug
         opeisen. Dit is de melding die er vóór vandaag nooit uitkwam. */
      const maanden = Math.round(-totAanbod / 30.44)
      uit.push({
        ...basis,
        soort: 'vaste_uren',
        wat:
          maanden >= 1
            ? `Aanbod vaste uren is over tijd — ${maanden} ${maanden === 1 ? 'maand' : 'maanden'} geleden al verplicht`
            : 'Aanbod vaste uren is over tijd',
        uiterlijk: aanbod,
        dagen: totAanbod,
        ernst: 'fout',
      })
    } else if (totJaar <= VOORUIT.vaste_uren) {
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

  // 5: verjaardag onder de 21
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

/** "Contract 2 van 3", als dat bekend is. */
export function ketenTekst(s: Signaal): string | null {
  return s.ketenNummer ? `Contract ${s.ketenNummer} van ${KETEN_MAX_CONTRACTEN}` : null
}

/** Alle signalen, het dringendst bovenaan. */
export function signalen(
  personen: Persoon[],
  contractenPer: Map<string, Contract[]>,
  vandaag: string,
): Signaal[] {
  return personen
    .flatMap((p) => signalenVoor(p, contractenPer.get(p.id) ?? [], vandaag))
    .sort((a, b) => a.dagen - b.dagen || a.naam.localeCompare(b.naam, 'nl'))
}

/* ------------------------------------------------------------------ query --- */

export function useContractwaker() {
  return useQuery({
    queryKey: ['contractwaker'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Signaal[]> => {
      const { data: personen, error } = await supabase
        .from('sollicitaties')
        .select(WAKER_VELDEN)
        .eq('fase', 'medewerker')
        .eq('is_apparaat', false)
        .is('uit_dienst_op', null)
      if (error) throw new Error(error.message)

      const { data: contracten, error: fout } = await supabase
        .from('contracten')
        .select(CONTRACT_VELDEN)
      if (fout) throw new Error(fout.message)

      const per = new Map<string, Contract[]>()
      for (const c of (contracten ?? []) as unknown as Contract[]) {
        const lijst = per.get(c.medewerker_id) ?? []
        lijst.push(c)
        per.set(c.medewerker_id, lijst)
      }

      return signalen((personen ?? []) as unknown as Persoon[], per, vandaagIso())
    },
  })
}
