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
import { plusMaanden, vandaagIso } from './datums'
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
  /** Het gemiddelde over twaalf maanden, als dat bekend is. */
  gemiddelde?: number | null
  vandaag?: string
}): Partial<Voorstel> {
  const { aard, huidig, keten, gemiddelde = null } = opdracht
  const vandaag = opdracht.vandaag ?? vandaagIso()

  const basis: Partial<Voorstel> = {
    aard,
    vorig_contract_id: huidig?.id ?? null,
    gemiddelde_uren: metVasteUren(aard) ? gemiddelde : null,
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

  const soort: Soort = metVasteUren(aard) ? 'vaste_uren' : (huidig?.soort ?? 'nuluren')

  return {
    ...basis,
    soort,
    duur,
    begint,
    eindigt: duur === 'bepaalde' ? jaarVanaf(begint) : null,
    uren_vast: metVasteUren(aard) ? gemiddelde : (getal(huidig?.uren_vast ?? null) ?? null),
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

  if (!metVasteUren(aard)) uit.gemiddelde_uren = null

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
        wat: 'Het gemiddelde over twaalf maanden is niet bekend, en een aanbod moet daar minstens gelijk aan zijn. Zolang de gewerkte uren niet volledig zijn ingelezen kan de app dat niet vaststellen.',
      })
    } else if (geboden === null) {
      uit.push({ ernst: 'fout', wat: 'Vul in hoeveel vaste uren je aanbiedt.' })
    } else if (geboden < gemiddelde) {
      uit.push({
        ernst: 'fout',
        wat: `Je biedt ${uur(geboden)} uur aan terwijl het gemiddelde over twaalf maanden ${uur(gemiddelde)} uur is. Een aanbod moet minstens het gemiddelde zijn; het verschil kan tot vijf jaar terug worden opgeëist.`,
      })
    }
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
      if (gem !== null)
        regels.push(
          uren === gem
            ? 'Dat is het gemiddelde over de afgelopen twaalf maanden.'
            : `Het gemiddelde over de afgelopen twaalf maanden is ${uur(gem)} uur.`,
        )
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
