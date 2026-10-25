/* De contractgeschiedenis van een medewerker.
 *
 * Alle contracten op een rij, ook die bij Kai. Daar hangt meer aan dan een
 * lijstje: de ketenregeling telt mee hoeveelste tijdelijke contract het is, en
 * of er een pauze tussen zat die de telling opnieuw liet beginnen.
 *
 * Wat de wet zegt (art. 7:668a BW), in gewone woorden: je mag iemand hoogstens
 * drie tijdelijke contracten geven, en samen hoogstens drie jaar. Ga je daar
 * overheen, dan is het vierde contract — of de dag na die drie jaar — vanzelf
 * een contract voor onbepaalde tijd. Dat gebeurt uit zichzelf; er hoeft niets
 * voor getekend te worden. Een pauze van meer dan zes maanden zet de telling
 * op nul.
 *
 * Twee dingen die deze module met opzet niet doet:
 *
 *   - Oordelen over de uitzondering voor wie jonger is dan 18 en gemiddeld
 *     minder dan twaalf uur per week werkt. Dat gemiddelde komt uit de
 *     gewerkte uren, en die rekening staat in stap 2. Hier wordt alleen
 *     gemeld dát de uitzondering kan spelen.
 *   - Zelf een conclusie trekken over wat er moet gebeuren. Het rekent uit
 *     hoe het ervoor staat; wat je ermee doet is aan Sander en zijn jurist.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { dagenTussen, plusMaanden, vandaagIso } from './datums'

export type Soort = 'nuluren' | 'min_max' | 'vaste_uren' | 'bandbreedte'
export type Duur = 'bepaalde' | 'onbepaalde'
export type Werkgever = 'boskma' | 'kai'

export type Contract = {
  id: string
  medewerker_id: string
  werkgever: Werkgever
  soort: Soort
  duur: Duur
  begint: string
  eindigt: string | null
  uren_vast: number | string | null
  uren_min: number | string | null
  uren_max: number | string | null
  uurloon: number | string | null
  functie: string | null
  proefperiode: boolean | null
  beeindigd_op: string | null
  beeindigd_reden: string | null
  document_id: number | null
  bron: string
  opmerking: string | null
}

export const SOORTNAAM: Record<Soort, string> = {
  nuluren: 'Nuluren (oproep)',
  min_max: 'Min-max',
  vaste_uren: 'Vaste uren',
  bandbreedte: 'Bandbreedte',
}

export const WERKGEVERNAAM: Record<Werkgever, string> = {
  boskma: 'Boskma Foodservice',
  kai: 'Kai (vorige eigenaar)',
}

/** Hoeveel contracten en hoeveel jaar de keten mag duren. */
export const KETEN_MAX_CONTRACTEN = 3
export const KETEN_MAX_MAANDEN = 36
/** Een pauze langer dan dit zet de telling op nul. */
export const KETEN_PAUZE_MAANDEN = 6

const getal = (w: number | string | null | undefined): number | null =>
  w === null || w === undefined || w === '' ? null : Number.isFinite(Number(w)) ? Number(w) : null

/** De uren zoals je ze opschrijft, afhankelijk van de vorm van het contract. */
export function urenTekst(c: Contract): string {
  const vast = getal(c.uren_vast)
  const min = getal(c.uren_min)
  const max = getal(c.uren_max)
  if (c.soort === 'vaste_uren') return vast === null ? 'uren onbekend' : `${vast} uur per week`
  if (c.soort === 'min_max' || c.soort === 'bandbreedte') {
    if (min === null && max === null) return 'uren onbekend'
    return `${min ?? '?'} tot ${max ?? '?'} uur per week`
  }
  return 'geen vaste uren'
}

/** De dag waarop dit contract werkelijk ophield, voor zover bekend. */
export function eindeVan(c: Contract): string | null {
  if (c.beeindigd_op) return c.beeindigd_op
  return c.duur === 'bepaalde' ? c.eindigt : null
}

/** Het contract dat vandaag loopt, of anders het laatst bekende. Dezelfde
 *  keuze als de view huidig_contract in de database maakt. */
export function lopendContract(contracten: Contract[], vandaag = vandaagIso()): Contract | null {
  if (contracten.length === 0) return null
  const loopt = (c: Contract) =>
    c.begint <= vandaag && (!c.eindigt || c.eindigt >= vandaag) && !c.beeindigd_op
  const op = [...contracten].sort((a, b) => b.begint.localeCompare(a.begint))
  return op.find(loopt) ?? op[0]
}

/* ------------------------------------------------------------------ keten --- */

export type Schakel = {
  contract: Contract
  /** Hoeveelste tijdelijke contract binnen de lopende keten. */
  nummer: number
  /** Dagen tussen het vorige contract en dit. Null bij het eerste. */
  pauze: number | null
  /** De pauze was langer dan zes maanden: hier begon de telling opnieuw. */
  nieuweKeten: boolean
}

export type Keten = {
  /** Alle contracten op volgorde, met hun plek in de keten. */
  schakels: Schakel[]
  /** Hoeveel tijdelijke contracten er in de lopende keten zitten. */
  aantal: number
  /** Waar de lopende keten begon. */
  begonOp: string | null
  /** De dag waarop de keten drie jaar wordt. */
  driejaarOp: string | null
  /** Er loopt al een contract voor onbepaalde tijd. */
  heeftVast: boolean
  /** Een volgend tijdelijk contract kan niet meer; dat wordt vanzelf vast. */
  volgendeWordtVast: boolean
  /** Waarom, in gewone woorden. Null als er niets aan de hand is. */
  reden: string | null
}

/** Op volgorde van begindatum, oudste eerst. */
function opVolgorde(contracten: Contract[]): Contract[] {
  return [...contracten].sort((a, b) => a.begint.localeCompare(b.begint))
}

/* Hoe het telt.
 *
 * Alleen tijdelijke contracten tellen mee. Een contract voor onbepaalde tijd
 * maakt de vraag overbodig — dan is er niets meer te ketenen.
 *
 * De pauze wordt gemeten vanaf het einde van het vorige contract. Is dat einde
 * onbekend (een lopend contract zonder einddatum), dan is er geen pauze. */
export function ketenVan(contracten: Contract[], vandaag = vandaagIso()): Keten {
  const op = opVolgorde(contracten)
  const schakels: Schakel[] = []

  let nummer = 0
  let begonOp: string | null = null
  let vorigEinde: string | null = null

  for (const contract of op) {
    if (contract.duur === 'onbepaalde') {
      schakels.push({ contract, nummer: 0, pauze: null, nieuweKeten: false })
      // Een vast contract breekt de keten: er valt niets meer te tellen.
      nummer = 0
      begonOp = null
      vorigEinde = eindeVan(contract)
      continue
    }

    const pauze = vorigEinde ? dagenTussen(vorigEinde, contract.begint) : null
    const grens = vorigEinde ? plusMaanden(vorigEinde, KETEN_PAUZE_MAANDEN) : null
    const nieuweKeten = Boolean(grens && contract.begint > grens)

    if (nieuweKeten || nummer === 0) {
      nummer = 1
      begonOp = contract.begint
    } else {
      nummer += 1
    }

    schakels.push({ contract, nummer, pauze, nieuweKeten: nieuweKeten && schakels.length > 0 })
    vorigEinde = eindeVan(contract)
  }

  const heeftVast = op.some(
    (c) => c.duur === 'onbepaalde' && (!c.beeindigd_op || c.beeindigd_op > vandaag),
  )
  const driejaarOp = begonOp ? plusMaanden(begonOp, KETEN_MAX_MAANDEN) : null

  let reden: string | null = null
  let volgendeWordtVast = false
  if (!heeftVast && nummer > 0) {
    if (nummer >= KETEN_MAX_CONTRACTEN) {
      volgendeWordtVast = true
      reden = `Dit is contract ${nummer} van ${KETEN_MAX_CONTRACTEN}. Een volgend tijdelijk contract wordt vanzelf een contract voor onbepaalde tijd.`
    } else if (driejaarOp && driejaarOp <= vandaag) {
      volgendeWordtVast = true
      reden = `De keten duurt al langer dan drie jaar. Een volgend tijdelijk contract wordt vanzelf een contract voor onbepaalde tijd.`
    }
  }

  return {
    schakels,
    aantal: nummer,
    begonOp,
    driejaarOp,
    heeftVast,
    volgendeWordtVast,
    reden,
  }
}

/* --------------------------------------------------------------- ophalen --- */

const VELDEN =
  'id,medewerker_id,werkgever,soort,duur,begint,eindigt,uren_vast,uren_min,uren_max,' +
  'uurloon,functie,proefperiode,beeindigd_op,beeindigd_reden,document_id,bron,opmerking'

export function useContracten(medewerkerId: string | null | undefined) {
  return useQuery({
    queryKey: ['contracten', medewerkerId],
    enabled: Boolean(medewerkerId),
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from('contracten')
        .select(VELDEN)
        .eq('medewerker_id', medewerkerId as string)
        .order('begint', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Contract[]
    },
  })
}

export function useContractOpslaan(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (c: Partial<Contract> & { soort: Soort; duur: Duur; begint: string }) => {
      const velden = {
        ...c,
        medewerker_id: medewerkerId,
        // Een contract voor onbepaalde tijd heeft geen einddatum; de database
        // weigert hem ook, en dan is een lege foutmelding niet behulpzaam.
        eindigt: c.duur === 'onbepaalde' ? null : (c.eindigt ?? null),
        bijgewerkt_op: new Date().toISOString(),
      }
      const { error } = c.id
        ? await supabase.from('contracten').update(velden).eq('id', c.id)
        : await supabase.from('contracten').insert(velden)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['contracten', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contractwaker'] })
    },
  })
}

export function useContractWeg(medewerkerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contracten').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['contracten', medewerkerId] })
      client.invalidateQueries({ queryKey: ['contractwaker'] })
    },
  })
}
