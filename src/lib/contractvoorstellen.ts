/* Een contractvoorstel opstellen: verlengen, stoppen of vaste uren aanbieden.
 *
 * Wat hier staat is wat er wordt áángeboden. Het afgesproken contract komt pas
 * in public.contracten als het getekend is.
 *
 * Het belangrijkste wat deze module doet is niet het invullen maar het
 * tegenhouden. Een voorstel kan er keurig uitzien en toch juridisch niet
 * kunnen: een vierde tijdelijk contract is van rechtswege een vast contract,
 * en een aanbod vaste uren onder het twaalfmaandsgemiddelde is geen geldig
 * aanbod. Allebei merk je pas als het te laat is, dus merkt de app het eerder.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { dagenTussen, plusMaanden, vandaagIso } from './datums'
import type { Onderbouwing } from './gewerkteUren'
import { alsTekst, type Blok, type Brief } from './brieven'
import {
  KETEN_MAX_CONTRACTEN,
  urenTekst,
  uur,
  type Contract,
  type Duur,
  type Keten,
  type Soort,
} from './contracten'

export type Aard = 'verlengen' | 'stoppen' | 'vaste_uren' | 'verlengen_en_vaste_uren'

export const AARDNAAM: Record<Aard, string> = {
  verlengen: 'Verlengen',
  stoppen: 'Niet verlengen',
  vaste_uren: 'Aanbod vaste uren',
  verlengen_en_vaste_uren: 'Verlengen én vaste uren aanbieden',
}

/* Wat je nog kunt kiezen bij een nieuw voorstel.
 *
 * Verlengen én vaste uren aanbieden staat er sinds 25 oktober 2026 niet meer
 * tussen. Het kon, maar het leverde een voorstel op met twee antwoorden die
 * elkaar in de weg zitten: akkoord met verlengen en de uren geweigerd betekent
 * een verlenging als oproepkracht, en dat moet je dan uit twee antwoorden zien
 * af te leiden. Eerst het aanbod, dan weet je bij de verlenging wát je
 * opschrijft.
 *
 * De aard blijft wel bestaan: er liggen voorstellen van vóór die datum, en die
 * horen te blijven werken zoals ze zijn verstuurd. */
export const TE_KIEZEN: Aard[] = ['verlengen', 'stoppen', 'vaste_uren']

export type Voorstel = {
  id: string
  medewerker_id: string
  vorig_contract_id: string | null
  aard: Aard
  soort: Soort | null
  duur: Duur | null
  begint: string | null
  eindigt: string | null
  uren_vast: number | string | null
  uren_min: number | string | null
  uren_max: number | string | null
  uurloon: number | string | null
  functie: string | null
  gemiddelde_uren: number | string | null
  /** Waar het gemiddelde vandaan komt, en of het een heel jaar beslaat. */
  gemiddelde_bron: 'berekend' | 'deels_berekend' | 'loonbureau' | null
  /** Over welke periode, in gewone taal: 'juli t/m oktober 2026'. */
  gemiddelde_over: string | null
  uiterlijk: string | null
  toelichting: string | null
  opgesteld_op: string
  opgesteld_door: string | null
  verstuurd_op: string | null
  verstuurd_naar: string | null
  geopend_op: string | null
  ontvangst_bevestigd_op: string | null
  keuze_verlenging: 'akkoord' | 'niet_akkoord' | null
  keuze_verlenging_op: string | null
  keuze_vaste_uren: 'aangenomen' | 'geweigerd' | null
  keuze_vaste_uren_op: string | null
  reactie: string | null
  ingetrokken_op: string | null
  ingetrokken_reden: string | null
  naar_loonbureau_op: string | null
  contract_id: string | null
  /** De brief als platte tekst, zoals verstuurd. Het bewijsstuk. */
  brief: string | null
  /** Dezelfde brief met zijn opbouw, voor het scherm van de medewerker. */
  brief_opbouw: Blok[] | null
  /** Op papier meegegeven; het antwoord is door Sander vastgelegd. */
  op_papier: boolean
}

const getal = (w: number | string | null | undefined): number | null =>
  w === null || w === undefined || w === '' ? null : Number.isFinite(Number(w)) ? Number(w) : null

/** Bevat dit voorstel een verlenging? */
export const metVerlenging = (a: Aard) => a === 'verlengen' || a === 'verlengen_en_vaste_uren'
/** Bevat dit voorstel een aanbod vaste uren? */
export const metVasteUren = (a: Aard) => a === 'vaste_uren' || a === 'verlengen_en_vaste_uren'

/* -------------------------------------------------------------- invullen --- */

/** De dag na deze datum. */
function dagErna(datum: string): string {
  const d = new Date(`${datum}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE')
}

/** Een jaar later, een dag ervoor. */
function jaarVanaf(begin: string): string {
  const d = new Date(`${plusMaanden(begin, 12)}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
}

/* Een voorstel vooringevuld, zodat Sander alleen nog hoeft na te kijken.
 *
 * De vuistregels: verlengen doe je op dezelfde voorwaarden en voor een jaar,
 * aansluitend op het vorige contract. Wordt een volgend tijdelijk contract
 * toch vanzelf vast, dan vult de app meteen onbepaalde tijd in — dat is wat er
 * dan feitelijk ontstaat, en het is eerlijker dat op te schrijven dan het
 * verrast te worden. */
export function vulVoorstelIn(opdracht: {
  aard: Aard
  huidig: Contract | null
  keten: Keten
  /** Het gemiddelde met de periode waarop het berust. */
  gemiddelde?: Onderbouwing | null
  /* Een aanbod vaste uren dat al beantwoord is. De uitkomst daarvan bepaalt
     waarmee een verlenging wordt voorgevuld: wie de uren aannam verlengt met
     vaste uren, wie ze weigerde als oproepkracht. Zonder dit zou de keuze bij
     het volgende voorstel kwijtraken. */
  beantwoordAanbod?: Voorstel | null
  vandaag?: string
}): Partial<Voorstel> {
  const { aard, huidig, keten } = opdracht
  const onderbouwing = opdracht.gemiddelde ?? null
  const gemiddelde = onderbouwing?.uren ?? null
  const vandaag = opdracht.vandaag ?? vandaagIso()

  const basis: Partial<Voorstel> = {
    aard,
    vorig_contract_id: huidig?.id ?? null,
    gemiddelde_uren: metVasteUren(aard) ? gemiddelde : null,
    gemiddelde_bron:
      metVasteUren(aard) && gemiddelde !== null
        ? onderbouwing?.volledig
          ? 'berekend'
          : 'deels_berekend'
        : null,
    gemiddelde_over: metVasteUren(aard) ? (onderbouwing?.over ?? null) : null,
  }

  if (aard === 'stoppen') {
    return {
      ...basis,
      uiterlijk: huidig?.eindigt ? plusMaanden(huidig.eindigt, -1) : null,
    }
  }

  const begint = huidig?.eindigt ? dagErna(huidig.eindigt) : vandaag
  // Na drie tijdelijke contracten kan een vierde niet meer; dat wordt vanzelf
  // een vast contract. Dan is onbepaalde tijd aanbieden het eerlijke voorstel.
  const duur: Duur = keten.volgendeWordtVast ? 'onbepaalde' : 'bepaalde'

  /* Volgt deze verlenging op een beantwoord aanbod vaste uren, dan is dát de
     afspraak — niet wat er in het oude contract stond. */
  const aanbod = opdracht.beantwoordAanbod ?? null
  const naAanbod =
    metVerlenging(aard) && aanbod?.keuze_vaste_uren
      ? aanbod.keuze_vaste_uren === 'aangenomen'
        ? { soort: 'vaste_uren' as Soort, uren: getal(aanbod.uren_vast) }
        : { soort: 'nuluren' as Soort, uren: null }
      : null

  const soort: Soort = metVasteUren(aard)
    ? 'vaste_uren'
    : (naAanbod?.soort ?? huidig?.soort ?? 'nuluren')

  return {
    ...basis,
    soort,
    duur,
    begint,
    eindigt: duur === 'bepaalde' ? jaarVanaf(begint) : null,
    uren_vast: metVasteUren(aard)
      ? gemiddelde
      : naAanbod
        ? naAanbod.uren
        : (getal(huidig?.uren_vast ?? null) ?? null),
    uren_min: metVasteUren(aard) ? null : (getal(huidig?.uren_min ?? null) ?? null),
    uren_max: metVasteUren(aard) ? null : (getal(huidig?.uren_max ?? null) ?? null),
    uurloon: getal(huidig?.uurloon ?? null),
    functie: huidig?.functie ?? null,
    uiterlijk: huidig?.eindigt ? plusMaanden(huidig.eindigt, -1) : null,
  }
}

/* Een voorstel ontdaan van wat er niet bij hoort.
 *
 * Tijdens het invullen verandert Sander van gedachten: eerst verlengen, dan
 * toch alleen vaste uren aanbieden. De velden die daarbij uit beeld verdwijnen
 * houden hun waarde, en die zou meegaan naar de tabel. Dan staat er een
 * einddatum in een aanbod dat geen contract is. Dit knipt dat eraf, en zowel
 * het voorbeeld als de controle als het opslaan gaan hierdoorheen. */
export function schoonVoorstel(v: Partial<Voorstel>): Partial<Voorstel> {
  const aard = v.aard
  if (!aard) return v

  if (aard === 'stoppen') {
    const { medewerker_id, vorig_contract_id, uiterlijk, toelichting } = v
    return { aard, medewerker_id, vorig_contract_id, uiterlijk, toelichting }
  }

  const uit: Partial<Voorstel> = { ...v }

  // Een los aanbod vaste uren verandert de soort en de duur van het contract
  // niet; het verandert alleen de uren.
  if (!metVerlenging(aard)) {
    uit.soort = 'vaste_uren'
    uit.duur = null
    uit.eindigt = null
  } else if (uit.duur === 'onbepaalde') {
    uit.eindigt = null
  }

  /* De aangeboden vaste uren blijven staan zolang ze ergens op slaan: in de
     soort van het nieuwe contract, of in het aanbod zelf. Verleng je als
     oproepkracht en bied je daarnaast vaste uren aan, dan zijn die uren het
     aanbod — die mag je niet wegknippen. */
  const metUren = uit.soort === 'vaste_uren' || metVasteUren(aard)
  const metBereik = uit.soort === 'min_max' || uit.soort === 'bandbreedte'
  if (!metUren) uit.uren_vast = null
  if (!metBereik) {
    uit.uren_min = null
    uit.uren_max = null
  }

  if (!metVasteUren(aard)) {
    uit.gemiddelde_uren = null
    uit.gemiddelde_bron = null
    uit.gemiddelde_over = null
  } else {
    // Een leeg veld is geen periode; anders staat er '' in de tabel.
    uit.gemiddelde_over = uit.gemiddelde_over?.trim() || null
  }

  return uit
}

/* ------------------------------------------------------------ controleren --- */

export type Bezwaar = {
  ernst: 'fout' | 'letop'
  wat: string
}

/** Vanaf 2028 mag het maximum hoogstens dit deel boven het minimum liggen. */
export const BANDBREEDTE_MAX = 1.3

/* Wat er juridisch niet kan, en wat je beter even nakijkt.
 *
 * 'fout' betekent: dit voorstel klopt niet en versturen is een vergissing.
 * 'letop' is een waarschuwing waar je overheen mag stappen. */
export function controleer(v: Partial<Voorstel>, keten: Keten, vandaag = vandaagIso()): Bezwaar[] {
  const uit: Bezwaar[] = []
  const aard = v.aard

  if (!aard) return uit

  if (aard === 'stoppen') {
    if (v.uiterlijk && v.uiterlijk < vandaag) {
      uit.push({
        ernst: 'fout',
        wat: 'De aanzegdatum is voorbij. Laat het alsnog schriftelijk weten; je kunt een vergoeding van maximaal een maandloon verschuldigd zijn.',
      })
    }
    return uit
  }

  if (metVerlenging(aard)) {
    if (!v.begint) uit.push({ ernst: 'fout', wat: 'Vul in wanneer het nieuwe contract begint.' })
    if (v.duur === 'bepaalde' && !v.eindigt) {
      uit.push({ ernst: 'fout', wat: 'Een contract voor bepaalde tijd heeft een einddatum.' })
    }
    if (v.duur === 'bepaalde' && keten.volgendeWordtVast) {
      uit.push({
        ernst: 'fout',
        wat: `Dit zou contract ${keten.aantal + 1} worden, en meer dan ${KETEN_MAX_CONTRACTEN} tijdelijke contracten kan niet. Wat je ook opschrijft, dit wordt van rechtswege een contract voor onbepaalde tijd.`,
      })
    }
  }

  if (metVasteUren(aard)) {
    const geboden = getal(v.uren_vast ?? null)
    const gemiddelde = getal(v.gemiddelde_uren ?? null)
    if (gemiddelde === null) {
      uit.push({
        ernst: 'fout',
        wat: 'Er is geen gemiddelde bekend, en een aanbod moet daar minstens gelijk aan zijn. Vraag het op bij het loonbureau — zij hebben de verloonde uren uitbetaald — en vul het hieronder in.',
      })
    } else if (geboden === null) {
      uit.push({ ernst: 'fout', wat: 'Vul in hoeveel vaste uren je aanbiedt.' })
    } else if (geboden < gemiddelde) {
      uit.push({
        ernst: 'fout',
        wat: `Je biedt ${uur(geboden)} uur aan terwijl het gemiddelde ${uur(gemiddelde)} uur is. Een aanbod moet minstens het gemiddelde zijn; het verschil kan tot vijf jaar terug worden opgeëist.`,
      })
    }
  }

  /* Berust het gemiddelde niet op twaalf maanden, dan mag het aanbod wel de
     deur uit maar moet je weten waar je op bouwt. Tegenhouden zou betekenen
     dat er helemaal geen aanbod komt zolang Eitje nog geen jaar heeft
     geleverd, en géén aanbod doen is duurder dan een aanbod met een
     kanttekening: dan loopt de vordering over álle uren. */
  /* Een gemiddelde dat met de hand is ingevuld zonder periode is later niet na
     te gaan: je weet dan niet waarover het ging. De brief laat die zin dan ook
     weg, en dat is precies de stilte die je bij een aanbod vaste uren niet
     wilt. */
  if (metVasteUren(aard) && v.gemiddelde_bron === 'loonbureau') {
    if (!v.gemiddelde_over?.trim()) {
      uit.push({
        ernst: 'fout',
        wat: 'Vul erbij over welke periode het gemiddelde van het loonbureau gaat. Zonder die periode is later niet na te gaan waarop het aanbod rustte.',
      })
    }
  }

  if (metVasteUren(aard) && v.gemiddelde_bron === 'deels_berekend') {
    uit.push({
      ernst: 'letop',
      wat: `Dit gemiddelde gaat over ${v.gemiddelde_over ?? 'een deel van het jaar'}, niet over twaalf maanden. Het loonbureau weet de verloonde uren van het hele jaar; vraag het daar na als je zeker wilt zitten.`,
    })
  }

  const min = getal(v.uren_min ?? null)
  const max = getal(v.uren_max ?? null)
  if (v.soort === 'bandbreedte' && min !== null && max !== null && max > min * BANDBREEDTE_MAX) {
    uit.push({
      ernst: 'fout',
      wat: `Bij een bandbreedtecontract mag het maximum hoogstens ${Math.round((BANDBREEDTE_MAX - 1) * 100)}% boven het minimum liggen. Bij ${uur(min)} uur is dat ${uur(min * BANDBREEDTE_MAX)} uur.`,
    })
  }
  if (v.soort === 'min_max' && min !== null && max !== null && max > min * BANDBREEDTE_MAX) {
    uit.push({
      ernst: 'letop',
      wat: `Vanaf 1 januari 2028 mag het maximum hoogstens ${Math.round((BANDBREEDTE_MAX - 1) * 100)}% boven het minimum liggen. Dit contract mag nu, maar loopt het door tot na die datum, kijk er dan nog eens naar.`,
    })
  }

  // 'stoppen' is hierboven al afgehandeld en teruggegeven; daar is een
  // verlopen datum een fout en geen waarschuwing.
  if (v.uiterlijk && v.uiterlijk < vandaag) {
    uit.push({ ernst: 'letop', wat: 'De uiterlijke datum is al voorbij.' })
  }

  return uit
}

export const magVerstuurd = (bezwaren: Bezwaar[]) => !bezwaren.some((b) => b.ernst === 'fout')

/* --------------------------------------------------------- samenvatting --- */

const euro = (n: number) => `€ ${n.toFixed(2).replace('.', ',')}`
const datum = (d: string | null | undefined) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

/** Het voorstel in gewone zinnen, zoals de medewerker het straks leest. */
export function samenvatting(v: Partial<Voorstel>): string[] {
  const regels: string[] = []
  const aard = v.aard
  if (!aard) return regels

  if (aard === 'stoppen') {
    regels.push(`Het contract wordt niet verlengd en loopt af.`)
    if (v.uiterlijk) regels.push(`Dit moet uiterlijk ${datum(v.uiterlijk)} zijn doorgegeven.`)
    return regels
  }

  /* De soort staat hier niet bij: de regel over de uren zegt al wat de
     afspraak is, en 'nuluren (oproep)' tussen haakjes achter een datum leest
     als een formulier in plaats van als een brief. */
  if (metVerlenging(aard)) {
    regels.push(
      v.duur === 'onbepaalde'
        ? `Een contract voor onbepaalde tijd, vanaf ${datum(v.begint)}.`
        : `Verlenging van ${datum(v.begint)} tot en met ${datum(v.eindigt)}.`,
    )
  }

  if (metVasteUren(aard)) {
    const uren = getal(v.uren_vast ?? null)
    const gem = getal(v.gemiddelde_uren ?? null)
    if (uren === null) {
      regels.push('Een aanbod voor vaste uren.')
    } else {
      regels.push(`Een aanbod voor ${uur(uren)} vaste uren per week.`)
      /* Het gemiddelde is de onderbouwing van het aanbod. Maar je mag het
         aanbod alleen zó noemen als het er ook op uitkomt — anders staat er
         een onwaarheid in een brief die later bewijs kan worden. */
      if (gem !== null) {
        /* Niet "de afgelopen twaalf maanden" opschrijven als het over vier
           maanden gaat. Dit is een brief die later bewijs kan worden. */
        const over = v.gemiddelde_over ?? 'de afgelopen twaalf maanden'
        regels.push(
          uren === gem
            ? `Dat is het gemiddelde over ${over}.`
            : `Het gemiddelde over ${over} is ${uur(gem)} uur.`,
        )
      }
    }
    regels.push('Dit aanbod mag je weigeren; dan blijf je oproepkracht.')
  } else if (metVerlenging(aard) && v.soort) {
    /* urenTekst levert een fragment ('geen vaste uren'); in een brief hoort
       een zin te staan. */
    const uren = urenTekst({
      soort: v.soort,
      uren_vast: v.uren_vast ?? null,
      uren_min: v.uren_min ?? null,
      uren_max: v.uren_max ?? null,
    } as Contract)
    regels.push(
      v.soort === 'nuluren'
        ? 'Geen vaste uren: je werkt op afroep.'
        : `${uren.charAt(0).toUpperCase()}${uren.slice(1)}.`,
    )
  }

  const loon = getal(v.uurloon ?? null)
  if (loon !== null) regels.push(`Uurloon ${euro(loon)} bruto.`)
  if (v.functie) regels.push(`Functie: ${v.functie}.`)
  if (v.uiterlijk) regels.push(`Graag antwoord vóór ${datum(v.uiterlijk)}.`)

  return regels
}

/* ----------------------------------------------------------------- stand --- */

export type Stand = 'concept' | 'verstuurd' | 'gezien' | 'beantwoord' | 'ingetrokken'

export function standVan(v: Voorstel): Stand {
  if (v.ingetrokken_op) return 'ingetrokken'
  if (v.keuze_verlenging || v.keuze_vaste_uren) return 'beantwoord'
  if (v.geopend_op || v.ontvangst_bevestigd_op) return 'gezien'
  if (v.verstuurd_op) return 'verstuurd'
  return 'concept'
}

export const STANDNAAM: Record<Stand, string> = {
  concept: 'Concept',
  verstuurd: 'Verstuurd',
  gezien: 'Gezien',
  beantwoord: 'Beantwoord',
  ingetrokken: 'Ingetrokken',
}

/* ------------------------------------------------------------- antwoorden --- */

/** Waar nog een antwoord op moet komen. */
export function openstaand(v: Voorstel): { verlenging: boolean; vasteUren: boolean } {
  return {
    verlenging: metVerlenging(v.aard) && !v.keuze_verlenging,
    vasteUren: metVasteUren(v.aard) && !v.keuze_vaste_uren,
  }
}

/** Ligt dit voorstel nog bij de medewerker? */
export function wachtOpMedewerker(v: Voorstel): boolean {
  if (!v.verstuurd_op || v.ingetrokken_op) return false
  const open = openstaand(v)
  return !v.ontvangst_bevestigd_op || open.verlenging || open.vasteUren
}

export const KEUZENAAM = {
  akkoord: 'Akkoord met de verlenging',
  niet_akkoord: 'Niet akkoord met de verlenging',
  aangenomen: 'Vaste uren aangenomen',
  geweigerd: 'Vaste uren geweigerd — blijft oproepkracht',
} as const

/** Wanneer de app Sander waarschuwt dat het voorstel blijft liggen. */
export const HERINNER = { vroeg: 14, laat: 7 }

/* Een voorstel dat niet wordt opgepakt is het dure geval: aanzeggen moet
   schriftelijk en de ontvangst moet te bewijzen zijn. Blijft de bevestiging
   weg, dan moet het op papier mee, en daar heb je een paar dagen voor nodig.
   Daarom twee seintjes: twee weken vooraf om hem aan te spreken, een week
   vooraf omdat het dan echt moet. Is de datum voorbij en is er nog niets
   bevestigd, dan blijft het seintje staan — de verplichting gaat niet weg. */
export function herinnering(
  v: Voorstel,
  vandaag = vandaagIso(),
): { dagen: number; dringend: boolean } | null {
  if (!v.verstuurd_op || v.ingetrokken_op || v.op_papier) return null
  if (v.ontvangst_bevestigd_op) return null
  /* Een gegeven antwoord bewíjst de ontvangst. Normaal zet het antwoorden de
     bevestiging mee, maar daarop vertrouwen zou betekenen dat één rij zonder
     bevestiging een seintje oplevert over een voorstel dat al beantwoord is. */
  if (v.keuze_verlenging || v.keuze_vaste_uren) return null
  if (!v.uiterlijk) return null
  const dagen = dagenTussen(vandaag, v.uiterlijk.slice(0, 10))
  if (dagen > HERINNER.vroeg) return null
  return { dagen, dringend: dagen <= HERINNER.laat }
}

/* --------------------------------------------------------------- ophalen --- */

const VELDEN = '*'

export function useVoorstellen(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['contractvoorstellen', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Voorstel[]> => {
      const { data, error } = await supabase
        .from('contractvoorstellen')
        .select(VELDEN)
        .eq('medewerker_id', medewerkerId as string)
        .order('opgesteld_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Voorstel[]
    },
  })
}

export function useVoorstelOpslaan(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (v: Partial<Voorstel>) => {
      const velden = {
        ...v,
        medewerker_id: medewerkerId,
        bijgewerkt_op: new Date().toISOString(),
        opgesteld_door: (await supabase.auth.getUser()).data.user?.email ?? null,
      }
      const { error } = v.id
        ? await supabase.from('contractvoorstellen').update(velden).eq('id', v.id)
        : await supabase.from('contractvoorstellen').insert(velden)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] }),
  })
}

export function useVoorstelIntrekken(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reden }: { id: string; reden?: string }) => {
      const { error } = await supabase
        .from('contractvoorstellen')
        .update({
          ingetrokken_op: new Date().toISOString(),
          ingetrokken_reden: reden ?? null,
          bijgewerkt_op: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] }),
  })
}

/* --------------------------------------------------------------- versturen --- */

/* Versturen gaat via een serverfunctie, niet via de browser.
 *
 * De brief gaat mee: wat Sander in het voorbeeld zag, is wat er verstuurd
 * wordt, en de serverfunctie legt die tekst vast. Zou de server de zinnen zelf
 * samenstellen, dan staan ze op twee plekken en lopen ze een keer uit elkaar.
 *
 * verstuurd_op wordt daar gezet, niet hier: alleen de server weet of de mail
 * er echt uit is. */
export function useVoorstelVersturen(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: { voorstel: Voorstel; brief: Brief }) => {
      const v = opdracht.voorstel
      const { data, error } = await supabase.functions.invoke('stuur-voorstel', {
        body: {
          voorstel: v.id,
          aanhef: opdracht.brief.aanhef,
          blokken: opdracht.brief.blokken,
          afsluiting: opdracht.brief.afsluiting,
          tekst: alsTekst(opdracht.brief),
        },
      })
      if (error) throw new Error(await leesFout(error))
      if (!data?.ok) throw new Error(data?.error ?? 'Versturen lukte niet.')
      return data as { testmodus: boolean; verstuurd_naar: string; apparaten: number }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] }),
  })
}

/* Een serverfunctie die 4xx teruggeeft komt bij supabase-js aan als een
   FunctionsHttpError waarvan de melding "non-2xx status code" is — precies wat
   je niet wilt lezen als je wil weten wát er mis is. De echte tekst zit in het
   antwoord zelf. */
async function leesFout(error: unknown): Promise<string> {
  const res = (error as { context?: Response })?.context
  if (res && typeof res.json === 'function') {
    try {
      const body = await res.clone().json()
      if (body?.error) return String(body.error)
    } catch {
      /* geen json; dan de oorspronkelijke melding */
    }
  }
  return error instanceof Error ? error.message : 'Versturen lukte niet.'
}

/** Het antwoord dat op papier of mondeling binnenkwam zelf vastleggen. */
export function useVoorstelOpPapier(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      id: string
      verlenging?: 'akkoord' | 'niet_akkoord' | null
      vasteUren?: 'aangenomen' | 'geweigerd' | null
      reactie?: string | null
    }) => {
      const nu = new Date().toISOString()
      const velden: Record<string, unknown> = { op_papier: true, bijgewerkt_op: nu }
      // Op papier meegeven is ook aanzeggen; de ontvangst staat dan vast.
      velden.ontvangst_bevestigd_op = nu
      if (opdracht.verlenging) {
        velden.keuze_verlenging = opdracht.verlenging
        velden.keuze_verlenging_op = nu
      }
      if (opdracht.vasteUren) {
        velden.keuze_vaste_uren = opdracht.vasteUren
        velden.keuze_vaste_uren_op = nu
      }
      if (opdracht.reactie) velden.reactie = opdracht.reactie
      const { error } = await supabase
        .from('contractvoorstellen')
        .update(velden)
        .eq('id', opdracht.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['contractvoorstellen', medewerkerId] }),
  })
}

/* ------------------------------------------------------- de medewerkerkant --- */

/* Wat de medewerker van zichzelf ziet. De policy eigen_voorstel laat alleen
   door wat verstuurd is en niet is ingetrokken; een concept is nog van Sander
   alleen. Hier staat dus geen extra filter — dat zou doen alsof de beveiliging
   in de browser zit. */
export function useMijnVoorstellen() {
  return useQuery({
    queryKey: ['mijn-voorstellen'],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Voorstel[]> => {
      const { data, error } = await supabase
        .from('contractvoorstellen')
        .select(VELDEN)
        .order('opgesteld_op', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Voorstel[]
    },
  })
}

/** Dat hij het heeft gezien. Eén keer; daarna blijft de eerste datum staan. */
export async function voorstelGeopend(id: string) {
  await supabase.rpc('voorstel_geopend', { p_voorstel: id })
}

export function useVoorstelBevestigen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('voorstel_bevestigen', { p_voorstel: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mijn-voorstellen'] }),
  })
}

export function useVoorstelAntwoorden() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      id: string
      verlenging?: 'akkoord' | 'niet_akkoord'
      vasteUren?: 'aangenomen' | 'geweigerd'
      reactie?: string
    }) => {
      const { error } = await supabase.rpc('voorstel_antwoorden', {
        p_voorstel: opdracht.id,
        p_verlenging: opdracht.verlenging ?? null,
        p_vaste_uren: opdracht.vasteUren ?? null,
        p_reactie: opdracht.reactie?.trim() || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['mijn-voorstellen'] }),
  })
}

/* Een beantwoord aanbod vaste uren waar nog geen verlenging op volgde.
 *
 * Dit is de vervolgstap sinds het combineren eruit is: eerst het aanbod, dan
 * met de uitkomst in de hand de verlenging. Zonder deze functie moet Sander
 * zelf onthouden wat er gekozen was, en dat is precies wat kwijtraakt. */
export function aanbodWachtOpVerlenging(voorstellen: Voorstel[]): Voorstel | null {
  const beantwoord = voorstellen
    .filter((v) => v.aard === 'vaste_uren' && !v.ingetrokken_op && v.keuze_vaste_uren)
    .sort((a, b) => b.opgesteld_op.localeCompare(a.opgesteld_op))[0]
  if (!beantwoord) return null

  // Is er na dat aanbod al een verlenging opgesteld, dan is het gedaan.
  const verlengd = voorstellen.some(
    (v) =>
      metVerlenging(v.aard) &&
      !v.ingetrokken_op &&
      v.opgesteld_op > beantwoord.opgesteld_op,
  )
  return verlengd ? null : beantwoord
}
