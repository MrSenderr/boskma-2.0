import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { naamVan, type Persoon } from './personeel'
import { dagenTussen, plusMaanden, vandaagIso } from './datums'
import { KETEN_MAX_CONTRACTEN, ketenVan, lopendContract, looptOp, type Contract } from './contracten'
import { aanbodWachtOpVerlenging, herinnering, type Voorstel } from './contractvoorstellen'
import { klaarVoorLoonbureau } from './contractverzoek'

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
      bewust niet getoetst (besluit 22 augustus 2026).
   6. Een verstuurd voorstel dat niet gelezen wordt. Dit is de enige regel die
      niet uit een contract volgt maar uit iets wat de app zelf heeft gedaan:
      er is aangezegd, maar niet bewijsbaar aangekomen. Twee weken vooraf om
      hem erop aan te spreken, een week vooraf omdat het dan op papier mee
      moet. Zie herinnering() in contractvoorstellen.ts.
   7. Een afspraak die nog niet bij het loonbureau ligt. Zonder dit seintje
      blijft een geaccepteerde verlenging liggen tot iemand het zich herinnert,
      en komt het contract niet.
   8. Een contract dat is afgelopen terwijl de medewerker nog in dienst staat.
      De app zet niemand zelf uit dienst — dat raakt zijn toegang, het rooster
      en de loonstrook, en dat hoort niet te gebeuren terwijl jij er niet bij
      bent. Maar het mag ook niet vergeten worden, dus blijft het seintje staan
      tot het gedaan is.

   En wat de waker níet meer zegt: dat een contract afloopt terwijl er al een
   antwoord op een voorstel ligt. Dat seintje bleef anders staan tot het nieuwe
   contract getekend en vastgelegd is — weken waarin je elke dag ziet dat je
   iets moet doen wat je al hebt gedaan. */

export type Ernst = 'fout' | 'letop'

export type Signaal = {
  persoonId: string
  naam: string
  soort:
    | 'geen_contract'
    | 'aanzeggen'
    | 'einde'
    | 'vaste_uren'
    | 'verjaardag'
    | 'voorstel_stil'
    | 'naar_loonbureau'
    /* Geen getekend contract in het dossier. Komt niet van de waker maar uit
       de documenten; zie getekendContract.ts. */
    | 'geen_getekend'
    | 'uit_dienst'
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
  /* Wat er op de pil hoort te staan, als aftellen geen zin heeft. Zonder dit
     zou een seintje zonder datum "vandaag" tonen, en dat leest als een
     deadline die er niet is. */
  pil?: string
}

/** Velden die de waker nodig heeft — geen onboarding_data. */
const WAKER_VELDEN =
  'id,voornaam,achternaam,status,fase,uit_dienst_op,is_eigenaar,geboortedatum,in_dienst_sinds'

/** De velden van een contract die de waker gebruikt. */
const CONTRACT_VELDEN = 'id,medewerker_id,werkgever,soort,duur,begint,eindigt,beeindigd_op'

/** De velden van een voorstel die de waker gebruikt. */
const VOORSTEL_VELDEN =
  'id,medewerker_id,vorig_contract_id,aard,begint,uiterlijk,verstuurd_op,ingetrokken_op,' +
  'ontvangst_bevestigd_op,keuze_verlenging,keuze_vaste_uren,naar_loonbureau_op,op_papier'

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

/* Is er over dit contract al iets afgesproken? Dan hoeft de waker niet meer
   te zeggen dat het afloopt. Een ingetrokken voorstel telt niet, en een
   voorstel dat nog bij de medewerker ligt ook niet: dan is er nog niets. */
function alGeregeld(voorstellen: Voorstel[], contractId: string | undefined): boolean {
  if (!contractId) return false
  return voorstellen.some(
    (v) =>
      v.vorig_contract_id === contractId &&
      v.verstuurd_op &&
      !v.ingetrokken_op &&
      (v.keuze_verlenging !== null ||
        v.keuze_vaste_uren !== null ||
        (v.aard === 'stoppen' && v.ontvangst_bevestigd_op !== null)),
  )
}

/* Is er in de afgelopen twaalf maanden een aanbod vaste uren gedaan? De plicht
   is het aanbod te doen, niet dat het wordt aangenomen (art. 7:628a lid 5 BW).
   Wordt het geweigerd, dan volgt er twaalf maanden later een nieuw aanbod — en
   doordat hier met een venster van twaalf maanden wordt gerekend komt het
   seintje dan vanzelf terug. */
function aanbodGedaan(voorstellen: Voorstel[], vandaag: string): boolean {
  const grens = plusMaanden(vandaag, -12)
  return voorstellen.some(
    (v) =>
      (v.aard === 'vaste_uren' || v.aard === 'verlengen_en_vaste_uren') &&
      v.verstuurd_op !== null &&
      !v.ingetrokken_op &&
      v.verstuurd_op.slice(0, 10) >= grens,
  )
}

export function signalenVoor(
  p: Persoon,
  contracten: Contract[],
  vandaag: string,
  voorstellen: Voorstel[] = [],
): Signaal[] {
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

  /* Ligt er een beantwoord aanbod vaste uren waar nog geen verlenging op
     volgde, dan is dát wat er moet gebeuren — en dan hoeft het seintje niet
     meer te vragen óf hij verlengt, maar eraan te herinneren dat de keuze er
     al ligt. */
  const naAanbod = aanbodWachtOpVerlenging(voorstellen)

  const gevonden = lopendContract(contracten, vandaag)
  /* lopendContract geeft het laatste contract terug als er geen lopend is.
     Voor "wat moet er gebeuren" is dat verschil er wel degelijk. */
  const huidig = gevonden && looptOp(gevonden, vandaag) ? gevonden : null
  const keten = ketenVan(contracten, vandaag)
  const ketenInfo =
    huidig && huidig.duur === 'bepaalde'
      ? {
          ketenNummer: keten.schakels.find((s) => s.contract.id === huidig.id)?.nummer,
          volgendeWordtVast: keten.volgendeWordtVast,
        }
      : {}

  // 2 en 3: aanzeggen en het einde zelf
  if (huidig && huidig.duur === 'bepaalde' && huidig.eindigt && !alGeregeld(voorstellen, huidig.id)) {
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
            wat: naAanbod
              ? 'Aanbod vaste uren is beantwoord — nu de verlenging'
              : totAanzeg < 0
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
  if (huidig && huidig.soort === 'nuluren' && start && !aanbodGedaan(voorstellen, vandaag)) {
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

  /* 8: het contract is afgelopen en er is niets nieuws.
     Alleen als er ook geen afspraak ligt die nog een contract moet opleveren —
     anders staat hier "uit dienst zetten?" terwijl de verlenging bij het
     loonbureau ligt. */
  const laatste = [...contracten]
    .sort((a, b) => (a.eindigt ?? '9999').localeCompare(b.eindigt ?? '9999'))
    .pop()
  const afgelopen = !huidig && laatste?.eindigt && laatste.eindigt.slice(0, 10) < vandaag
  if (afgelopen && !voorstellen.some((v) => !v.ingetrokken_op && v.keuze_verlenging === 'akkoord')) {
    const einde = laatste!.eindigt!.slice(0, 10)
    uit.push({
      ...basis,
      soort: 'uit_dienst',
      wat: 'Contract is afgelopen — uit dienst zetten?',
      uiterlijk: einde,
      dagen: dagenTussen(vandaag, einde),
      ernst: 'letop',
    })
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

/* Wat er rond een verstuurd voorstel te doen is. Staat los van signalenVoor,
   omdat het niet uit de contracttabel komt maar uit post die de app zelf heeft
   verstuurd: ligt het stil bij de medewerker, of ligt het antwoord hier en moet
   het loonbureau nog aan de slag? */
export function voorstelSignalen(
  personen: Persoon[],
  voorstellen: Voorstel[],
  vandaag: string,
): Signaal[] {
  const namen = new Map(personen.map((p) => [p.id, naamVan(p)]))
  const uit: Signaal[] = []
  for (const v of voorstellen) {
    const naam = namen.get(v.medewerker_id)
    if (!naam) continue
    const basis = { persoonId: v.medewerker_id, naam }

    /* Het antwoord is binnen en het loonbureau weet nog niets. Dit wordt met de
       dag dringender: het contract moet er zijn voordat het ingaat, en daar
       zitten de feestdagen nog tussen. */
    if (klaarVoorLoonbureau(v)) {
      const ingaand = (v.begint ?? v.uiterlijk ?? vandaag).slice(0, 10)
      const dagen = dagenTussen(vandaag, ingaand)
      uit.push({
        ...basis,
        soort: 'naar_loonbureau',
        wat: 'Afgesproken — nog niet naar het loonbureau',
        uiterlijk: ingaand,
        dagen,
        ernst: dagen <= DRINGEND ? 'fout' : 'letop',
      })
      continue
    }

    const s = herinnering(v, vandaag)
    if (!s) continue
    uit.push({
      ...basis,
      soort: 'voorstel_stil',
      wat:
        s.dagen < 0
          ? 'Voorstel nog niet gelezen en de datum is voorbij — geef het op papier mee'
          : s.dringend
            ? 'Voorstel nog niet gelezen — geef het op papier mee'
            : 'Voorstel nog niet gelezen — spreek hem erop aan',
      uiterlijk: (v.uiterlijk ?? vandaag).slice(0, 10),
      dagen: s.dagen,
      ernst: s.dringend ? 'fout' : 'letop',
    })
  }
  return uit
}

/* Hoe dringend iets is, in woorden. Stond in Vandaag.tsx; sinds de
   personeelslijst hetzelfde laat zien hoort het bij de waker, anders staan er
   twee manieren om hetzelfde te zeggen. */
export function wanneer(dagen: number, datum: string): string {
  if (dagen < 0) return `${-dagen} dg te laat`
  if (dagen === 0) return 'vandaag'
  if (dagen === 1) return 'morgen'
  if (dagen <= 14) return `over ${dagen} dagen`
  return new Date(`${datum}T12:00:00`).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  })
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
  voorstellenPer: Map<string, Voorstel[]> = new Map(),
): Signaal[] {
  return personen
    .flatMap((p) =>
      signalenVoor(p, contractenPer.get(p.id) ?? [], vandaag, voorstellenPer.get(p.id) ?? []),
    )
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
        // Een oefenkaart is geen personeel; zie is_test op sollicitaties.
        .eq('is_test', false)
        .is('uit_dienst_op', null)
      if (error) throw new Error(error.message)

      const { data: contracten, error: fout } = await supabase
        .from('contracten')
        .select(CONTRACT_VELDEN)
      if (fout) throw new Error(fout.message)

      /* Alle verstuurde voorstellen die niet zijn ingetrokken — ook de
         beantwoorde. Die zijn nodig om te weten dat een contract al geregeld
         is, en om te zien wat er nog naar het loonbureau moet. */
      const { data: voorstellen, error: vfout } = await supabase
        .from('contractvoorstellen')
        .select(VOORSTEL_VELDEN)
        .not('verstuurd_op', 'is', null)
        .is('ingetrokken_op', null)
      if (vfout) throw new Error(vfout.message)

      const per = new Map<string, Contract[]>()
      for (const c of (contracten ?? []) as unknown as Contract[]) {
        const lijst = per.get(c.medewerker_id) ?? []
        lijst.push(c)
        per.set(c.medewerker_id, lijst)
      }

      const alle = (voorstellen ?? []) as unknown as Voorstel[]
      const voorstelPer = new Map<string, Voorstel[]>()
      for (const v of alle) {
        const lijst = voorstelPer.get(v.medewerker_id) ?? []
        lijst.push(v)
        voorstelPer.set(v.medewerker_id, lijst)
      }

      const vandaag = vandaagIso()
      const lijst = (personen ?? []) as unknown as Persoon[]
      return [
        ...signalen(lijst, per, vandaag, voorstelPer),
        ...voorstelSignalen(lijst, alle, vandaag),
      ].sort((a, b) => a.dagen - b.dagen || a.naam.localeCompare(b.naam, 'nl'))
    },
  })
}

/* ------------------------------------------------- het aanbod vaste uren --- */

export type AanbodStand = {
  /** Moet er een aanbod vaste uren komen? */
  verplicht: boolean
  /** Hoeveel maanden iemand al als oproepkracht werkt, als dat bekend is. */
  maanden: number | null
  /** Waarom er (nog) geen aanbod hoeft. */
  reden: 'verplicht' | 'geen_oproepkracht' | 'nog_geen_jaar' | 'al_gedaan' | 'onbekend'
  /** Bij 'nog_geen_jaar': vanaf wanneer het moet. */
  vanaf?: string
}

/* Of een aanbod vaste uren verschuldigd is, en waarom wel of niet.
 *
 * Dezelfde regel als waar de waker zijn seintje op baseert — hier apart, omdat
 * het scherm waar je een voorstel opstelt het ook moet weten. Twee keer
 * opschrijven zou betekenen dat ze een keer uit elkaar lopen, en dan zegt het
 * ene scherm dat het moet terwijl het andere zwijgt.
 *
 * De plicht ontstaat na twaalf maanden op een oproepovereenkomst, en het aanbod
 * moet binnen een maand daarna (art. 7:628a lid 5 BW). Is er in het afgelopen
 * jaar al een aanbod gedaan, dan is eraan voldaan — ook als het is geweigerd. */
export function aanbodStand(
  p: Persoon,
  contracten: Contract[],
  voorstellen: Voorstel[],
  vandaag = vandaagIso(),
): AanbodStand {
  const gevonden = lopendContract(contracten, vandaag)
  const huidig = gevonden && looptOp(gevonden, vandaag) ? gevonden : null

  if (!huidig || huidig.soort !== 'nuluren') {
    return { verplicht: false, maanden: null, reden: 'geen_oproepkracht' }
  }
  if (aanbodGedaan(voorstellen, vandaag)) {
    return { verplicht: false, maanden: null, reden: 'al_gedaan' }
  }

  const start = startVan(p, contracten)
  if (!start) return { verplicht: false, maanden: null, reden: 'onbekend' }

  const jaar = plusMaanden(start, 12)
  const maanden = Math.floor(dagenTussen(start, vandaag) / 30.44)

  if (vandaag < jaar) {
    return { verplicht: false, maanden, reden: 'nog_geen_jaar', vanaf: jaar }
  }
  return { verplicht: true, maanden, reden: 'verplicht' }
}
