/* Het personeelsbestand van eitje lezen en vergelijken met wat er in de app
   staat.

   Eitje is de baas over loon en contract: dat bestand hangt aan het
   loonbureau. In de app stonden die getallen overgetypt, en overtypen loopt
   scheef zodra er iets verandert — bij vier van de twaalf mensen stond in
   oktober 2026 een verouderd uurloon, allemaal jeugdloon dat met een
   verjaardag was meegeschoven.

   Hier wordt niets automatisch bijgewerkt. Het bestand wordt gelezen, naast de
   app gelegd, en wat afwijkt krijg je te zien. Jij beslist. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sleutel } from './eitje'
import { supabase } from './supabase'
import type { Werkboek } from './xlsx-lezen'

export type Personeelsregel = {
  /** record_id uit eitje */
  bronId: string
  voornaam: string
  achternaam: string
  email: string | null
  contracttype: string | null
  uurloon: number | null
  /** Wekelijkse contracturen. Leeg bij een nul-urencontract: "00:00" is geen
   *  afspraak van nul uur, het is geen afspraak. */
  contracturen: number | null
}

export type Personeelsbestand = {
  geexporteerdOp: string | null
  regels: Personeelsregel[]
}

/* Links de interne naam uit het tabblad "log", rechts hoe wij het noemen. De
   kolomvolgorde ligt niet vast: in eitje kies je zelf wat er in een export
   staat, dus er wordt nooit op plek gelezen maar op naam. */
const VELDEN = {
  user_first_name: 'voornaam',
  user_last_name: 'achternaam',
  user_email: 'email',
  contract_type: 'contracttype',
  contract_hourly_wage: 'uurloon',
  contract_weekly_hours: 'contracturen',
  record_id: 'bronId',
} as const

type Veld = (typeof VELDEN)[keyof typeof VELDEN]

/** De Nederlandse koppen, voor een export zonder tabblad "log". */
const KOPPEN: Record<string, Veld> = {
  voornaam: 'voornaam',
  achternaam: 'achternaam',
  'e-mailadres': 'email',
  emailadres: 'email',
  contracttype: 'contracttype',
  uurloon: 'uurloon',
  'wekelijkse contracturen': 'contracturen',
  'support id': 'bronId',
}

/* Eitje noemt een contract anders dan wij. Staat er iets wat we niet kennen,
   dan laten we het contracttype met rust in plaats van te gokken. */
const CONTRACTEN: Record<string, string> = {
  'uren contract': 'Vaste uren',
  urencontract: 'Vaste uren',
  'vaste uren': 'Vaste uren',
  'nul uren': 'Nuluren-overeenkomst (oproep)',
  'nul-uren': 'Nuluren-overeenkomst (oproep)',
  nuluren: 'Nuluren-overeenkomst (oproep)',
  'min-max': 'Min-max-overeenkomst',
  'min max': 'Min-max-overeenkomst',
  minmax: 'Min-max-overeenkomst',
}

export function naarContracttype(tekst: string | null): string | null {
  return tekst ? (CONTRACTEN[sleutel(tekst)] ?? null) : null
}

/** "€8,24" wordt 8.24. "€0" blijft 0 — dat is een bedrag, geen leeg veld. */
export function naarBedrag(tekst: string | null): number | null {
  if (!tekst) return null
  const schoon = tekst.replace(/[^\d,.-]/g, '').replace(',', '.')
  if (!schoon) return null
  const n = Number(schoon)
  return Number.isFinite(n) ? n : null
}

/** "22:00" wordt 22. "00:00" wordt niets: geen afspraak. */
export function naarContracturen(tekst: string | null): number | null {
  if (!tekst) return null
  const m = tekst.match(/^(\d+):(\d{2})$/)
  if (m) {
    const uren = Number(m[1]) + Number(m[2]) / 60
    return uren > 0 ? uren : null
  }
  const n = naarBedrag(tekst)
  return n && n > 0 ? n : null
}

function waardeBij(rijen: string[][], label: string): string | null {
  const doel = sleutel(label)
  for (const rij of rijen) {
    if (rij[0] && sleutel(rij[0]) === doel) {
      return rij.slice(1).find((c) => c && c.trim()) ?? null
    }
  }
  return null
}

function kolommenUitLog(log: string[][] | undefined): Map<Veld, number> | null {
  const regel = log && waardeBij(log, 'Columns')
  if (!regel) return null
  const uit = new Map<Veld, number>()
  for (const deel of regel.split(',')) {
    const m = deel.trim().match(/^(\d+)\.\s*(.+)$/)
    if (!m) continue
    const veld = VELDEN[m[2].trim() as keyof typeof VELDEN]
    if (veld) uit.set(veld, Number(m[1]))
  }
  return uit.size ? uit : null
}

function kolommenUitKop(rij: string[]): Map<Veld, number> {
  const uit = new Map<Veld, number>()
  rij.forEach((cel, i) => {
    // De gesorteerde kolom krijgt een pijltje voor zijn naam.
    const veld = KOPPEN[sleutel(cel.replace(/[▲▼]/g, ''))]
    if (veld && !uit.has(veld)) uit.set(veld, i)
  })
  return uit
}

export function isPersoneelsbestand(werkboek: Werkboek): boolean {
  const log = werkboek.get('log')
  return log ? sleutel(waardeBij(log, 'Table type') ?? '') === 'user' : false
}

export function leesPersoneel(werkboek: Werkboek): Personeelsbestand {
  const tabel = werkboek.get('table') ?? [...werkboek.values()][0] ?? []
  const log = werkboek.get('log')

  const kop = tabel.findIndex((rij) => kolommenUitKop(rij).has('voornaam'))
  const kolommen = kolommenUitLog(log) ?? (kop >= 0 ? kolommenUitKop(tabel[kop]) : new Map())
  if (!kolommen.has('voornaam') || !kolommen.has('achternaam')) {
    throw new Error('In dit bestand staan geen herkenbare kolommen.')
  }
  if (kop < 0) throw new Error('In dit bestand staan geen herkenbare kolommen.')

  const cel = (rij: string[], veld: Veld) => {
    const i = kolommen.get(veld)
    return i === undefined ? '' : (rij[i] ?? '').trim()
  }

  const regels: Personeelsregel[] = []
  for (const rij of tabel.slice(kop + 1)) {
    const voornaam = cel(rij, 'voornaam')
    const achternaam = cel(rij, 'achternaam')
    // De laatste regel van een eitje-export is een totaaltelling zonder naam.
    if (!voornaam && !achternaam) continue
    regels.push({
      bronId: cel(rij, 'bronId'),
      voornaam,
      achternaam,
      email: cel(rij, 'email').toLowerCase() || null,
      contracttype: naarContracttype(cel(rij, 'contracttype') || null),
      uurloon: naarBedrag(cel(rij, 'uurloon') || null),
      contracturen: naarContracturen(cel(rij, 'contracturen') || null),
    })
  }

  return {
    geexporteerdOp: (log && waardeBij(log, 'Export time')) ?? waardeBij(tabel, 'Geëxporteerd op'),
    regels,
  }
}

/* ------------------------------------------------------- vergelijken --- */

export type Persoon = {
  id: string
  voornaam: string | null
  achternaam: string | null
  email: string | null
  uurloon: string | number | null
  contracturen: string | number | null
  contracttype: string | null
}

export type Veldnaam = 'uurloon' | 'contracturen' | 'contracttype'

export type Verschil = {
  persoonId: string
  naam: string
  veld: Veldnaam
  nu: number | string | null
  wordt: number | string | null
}

export type Vergelijking = {
  verschillen: Verschil[]
  /** Staat in het bestand, maar niet in de app. */
  onbekend: Personeelsregel[]
  /** Staat in de app, maar niet in het bestand. */
  ontbreekt: Persoon[]
}

const getal = (w: string | number | null): number | null =>
  w === null || w === '' ? null : Number.isFinite(Number(w)) ? Number(w) : null

/* Op mailadres, niet op naam. Namen worden anders geschreven — "Van Beurden"
   tegenover "Beurden, Van" — en dan koppel je de verkeerde mensen aan elkaar
   of niemand. */
export function vergelijk(
  bestand: Personeelsregel[],
  personen: Persoon[],
  /* Jezelf. Je staat wel in eitje — daar hangt je eigen contract aan — maar
     niet in de personeelslijst van de app. Zonder dit zou elke import melden
     dat je jezelf nog moet toevoegen. */
  eigenEmail?: string | null,
): Vergelijking {
  const opEmail = new Map(
    personen.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]),
  )
  const gezien = new Set<string>()
  const verschillen: Verschil[] = []
  const onbekend: Personeelsregel[] = []

  for (const r of bestand) {
    const p = r.email ? opEmail.get(r.email) : undefined
    if (!p) {
      if (!eigenEmail || r.email !== eigenEmail.toLowerCase()) onbekend.push(r)
      continue
    }
    gezien.add(p.id)
    const naam = [p.voornaam, p.achternaam].filter(Boolean).join(' ')

    const nuLoon = getal(p.uurloon)
    if (r.uurloon !== null && r.uurloon !== nuLoon) {
      verschillen.push({ persoonId: p.id, naam, veld: 'uurloon', nu: nuLoon, wordt: r.uurloon })
    }

    const nuUren = getal(p.contracturen)
    if (r.contracturen !== null && r.contracturen !== nuUren) {
      verschillen.push({
        persoonId: p.id,
        naam,
        veld: 'contracturen',
        nu: nuUren,
        wordt: r.contracturen,
      })
    }

    if (r.contracttype && r.contracttype !== p.contracttype) {
      verschillen.push({
        persoonId: p.id,
        naam,
        veld: 'contracttype',
        nu: p.contracttype,
        wordt: r.contracttype,
      })
    }
  }

  return {
    verschillen,
    onbekend,
    ontbreekt: personen.filter((p) => !gezien.has(p.id)),
  }
}

export const VELDNAAM: Record<Veldnaam, string> = {
  uurloon: 'Uurloon',
  contracturen: 'Contracturen',
  contracttype: 'Contracttype',
}

/* ---------------------------------------------------------- ophalen --- */

/* Een eigen vraag, want de personeelslijst haalt loon en contract niet op —
   die horen niet in een overzicht. Hier wel: dit scherm gaat er juist over. */
export function useLoongegevens() {
  return useQuery({
    queryKey: ['loongegevens'],
    queryFn: async (): Promise<Persoon[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select('id,voornaam,achternaam,email,uurloon,contracturen,contracttype')
        .eq('fase', 'medewerker')
        .is('uit_dienst_op', null)
        .eq('is_apparaat', false)
        // Een oefenkaart is geen personeel; zie is_test op sollicitaties.
        .eq('is_test', false)
        // De eigenaar staat wel in eitje — daar hangt zijn eigen contract aan —
        // maar niet in deze vergelijking. Zie `vergelijk`, dat hem al overslaat
        // als hij niet in de app staat.
        .eq('is_eigenaar', false)
        .order('voornaam')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Persoon[]
    },
  })
}

export function useVerschillenOvernemen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (verschillen: Verschil[]) => {
      // Per persoon alles in één keer, zodat er niet half wordt bijgewerkt.
      const perPersoon = new Map<string, Record<string, unknown>>()
      for (const v of verschillen) {
        const velden = perPersoon.get(v.persoonId) ?? {}
        velden[v.veld] = v.wordt
        perPersoon.set(v.persoonId, velden)
      }
      for (const [id, velden] of perPersoon) {
        const { error } = await supabase.from('sollicitaties').update(velden).eq('id', id)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['loongegevens'] })
      client.invalidateQueries({ queryKey: ['personen'] })
      client.invalidateQueries({ queryKey: ['persoon'] })
    },
  })
}
