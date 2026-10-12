/* De avondspits indelen.
 *
 * Vrijdag t/m zondag van 17 tot 20 draait de zaak op zes werkplekken —
 * snackbakker is er twee, dus zeven paar handen. Wie waar het beste staat zat
 * tot oktober 2026 alleen in Sanders hoofd.
 *
 * Wat hier gebeurt: de planning zegt wie er die avond is, de werkplekken
 * zeggen welke plekken er zijn en hoe hard ze bezet moeten zijn, en per
 * medewerker staat er per plek hoe goed het gaat. Daar rolt een indeling uit.
 *
 * Het is bewust geen verdeling "iedereen zijn lievelingsplek": je draait een
 * spits, geen wensconcert. De belangrijkste plekken worden het eerst bezet, en
 * daar komt de beste beschikbare man of vrouw op. Zie `waardering` voor hoe
 * dat in getallen zit.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { schoonTijd } from './rooster'

export const SPITS = { van: '17:00', tot: '20:00' } as const

/** Vrijdag, zaterdag, zondag — zoals Date#getDay ze nummert. */
export const SPITSDAGEN = [5, 6, 0]

export function isSpitsdag(datum: string): boolean {
  return SPITSDAGEN.includes(new Date(`${datum}T12:00:00`).getDay())
}

/** De eerstvolgende spitsdag, vandaag meegerekend. */
export function volgendeSpitsdag(vanaf: string): string {
  const d = new Date(`${vanaf}T12:00:00`)
  for (let i = 0; i < 7; i++) {
    if (SPITSDAGEN.includes(d.getDay())) return d.toISOString().slice(0, 10)
    d.setDate(d.getDate() + 1)
  }
  return vanaf
}

/* --------------------------------------------------------------- niveaus --- */

export type Niveau = 'liefst' | 'kan' | 'nood' | 'nooit'

/** Geen regel in de database betekent: nog niet beoordeeld. Dat is iets anders
 *  dan 'nood' — de app mag het, maar zegt erbij dat het een gok is. */
export type Geschiktheid = Niveau | 'onbekend'

export const NIVEAU: Record<
  Geschiktheid,
  { label: string; uitleg: string; soort: 'goed' | 'letop' | 'fout' | 'neutraal' }
> = {
  liefst: { label: 'Liefst', uitleg: 'Hier staat hij het liefst en het best', soort: 'goed' },
  kan: { label: 'Kan', uitleg: 'Gaat goed', soort: 'neutraal' },
  nood: { label: 'Nood', uitleg: 'Alleen als het niet anders kan', soort: 'letop' },
  nooit: { label: 'Nooit', uitleg: 'Harde grens — hier wordt hij nooit ingedeeld', soort: 'fout' },
  onbekend: { label: 'Onbekend', uitleg: 'Nog niet beoordeeld', soort: 'neutraal' },
}

/** De keuzes in de rij waarin ze op het scherm staan. */
export const NIVEAUS: Geschiktheid[] = ['onbekend', 'liefst', 'kan', 'nood', 'nooit']

export const sleutelVan = (medewerkerId: string, werkplekId: string) =>
  `${medewerkerId}|${werkplekId}`

export function niveauVan(
  niveaus: Map<string, Niveau>,
  medewerkerId: string,
  werkplekId: string,
): Geschiktheid {
  return niveaus.get(sleutelVan(medewerkerId, werkplekId)) ?? 'onbekend'
}

/* ------------------------------------------------------------- stoelen --- */

export type Werkplek = {
  id: string
  naam: string
  aantal: number
  belang: number
  volgorde: number
  actief: boolean
}

/** Eén plaats om te vullen. Snackbakker levert er twee. */
export type Stoel = {
  sleutel: string
  werkplek: Werkplek
  plek: number
  /** Het belang van de werkplek, maar de tweede man één punt lichter: een
   *  tweede snackbakker hoort niet vóór de chef te gaan. */
  belang: number
}

export function stoelenVan(werkplekken: Werkplek[]): Stoel[] {
  return werkplekken
    .filter((w) => w.actief)
    .slice()
    .sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam))
    .flatMap((w) =>
      Array.from({ length: w.aantal }, (_, i) => ({
        sleutel: `${w.id}|${i + 1}`,
        werkplek: w,
        plek: i + 1,
        belang: Math.max(1, w.belang - i),
      })),
    )
}

/** De volgorde waarin de plekken bezet raken als je te weinig mensen hebt.
 *
 *  Het belang beslist, en bij gelijk belang de volgorde die jij hebt ingesteld.
 *  Dit is wat er op het instellingenscherm staat: het laat zien wat die
 *  getallen doen, zonder dat je ze hoeft na te rekenen. `maakIndeling` komt bij
 *  mensen die overal even goed zijn op dezelfde rij uit — daar staat een test
 *  op, zodat het scherm en de werkelijkheid niet uit elkaar kunnen lopen. */
export function vulVolgorde(stoelen: Stoel[]): Stoel[] {
  return stoelen
    .map((stoel, plaats) => ({ stoel, plaats }))
    .sort((a, b) => b.stoel.belang - a.stoel.belang || a.plaats - b.plaats)
    .map(({ stoel }) => stoel)
}

export function stoelnaam(stoel: Stoel): string {
  return stoel.werkplek.aantal > 1 ? `${stoel.werkplek.naam} ${stoel.plek}` : stoel.werkplek.naam
}

/* ----------------------------------------------------------- waardering --- */

/* Hoe goed iemand op een stoel past, in punten.
 *
 * Het belang van de stoel weegt honderd keer zo zwaar als het verschil tussen
 * twee niveaus. Dat is met opzet: één stap in belang kan nooit worden
 * weggepoetst door een betere match. Zo wordt de kassa altijd eerst bezet, ook
 * als iemand liever runner is.
 *
 * Alles wat mag levert punten op — ook 'nood' en 'onbekend'. Daardoor is een
 * bezette stoel altijd beter dan een lege, en blijft er niemand voor niets
 * langs de kant staan.
 */
const PASSEND: Record<Geschiktheid, number | null> = {
  liefst: 60,
  kan: 40,
  nood: 15,
  onbekend: 5,
  nooit: null,
}

/** Hoeveel eerdere spitsen meetellen voor de afwisseling. */
export const AFWISSELING_TERUG = 4
const BOETE_PER_KEER = 3
/* Nooit zo hoog dat het een niveau omzeilt: het kleinste gat tussen twee
   niveaus is tien punten ('nood' tegen 'onbekend'). Afwisseling mag een keuze
   bijsturen, niet omgooien. */
const BOETE_MAX = 9

export function waardering(
  niveau: Geschiktheid,
  belang: number,
  herhalingen = 0,
): number | null {
  const passend = PASSEND[niveau]
  if (passend === null) return null
  return belang * 100 + passend - Math.min(herhalingen * BOETE_PER_KEER, BOETE_MAX)
}

/* --------------------------------------------------------- afwisseling --- */

export type Eerder = { datum: string; medewerker_id: string; werkplek_id: string }

/** Hoe vaak iemand bij de laatste spitsen op deze plek stond.
 *
 *  Alleen de laatste paar avonden, niet alles van het afgelopen jaar: dat
 *  iemand in maart drie keer runner was mag een indeling in oktober niet meer
 *  beïnvloeden. */
export function herhalingen(
  eerder: Eerder[],
  medewerkerId: string,
  werkplekId: string,
  terug = AFWISSELING_TERUG,
): number {
  const dagen = [...new Set(eerder.map((e) => e.datum))].sort().reverse().slice(0, terug)
  const recent = new Set(dagen)
  return eerder.filter(
    (e) => recent.has(e.datum) && e.medewerker_id === medewerkerId && e.werkplek_id === werkplekId,
  ).length
}

/* ----------------------------------------------------------- de indeling --- */

export type Persoon = { id: string; naam: string }

export type Plekvulling = {
  stoel: Stoel
  persoon: Persoon | null
  niveau: Geschiktheid | null
  herhalingen: number
}

export type Indeling = {
  plekken: Plekvulling[]
  /** In de spits, maar zonder plek. */
  over: { persoon: Persoon; reden: 'te_veel' | 'kan_niks' }[]
  onbezet: Stoel[]
}

/* Boven dit aantal stoelen wordt het rekenen merkbaar: er worden alle
   combinaties van bezette stoelen langsgegaan, en dat verdubbelt per stoel.
   Zeven is niets. Zestien is het punt waarop we liever de onbelangrijkste
   plekken laten vallen dan een scherm dat seconden staat te denken. */
const MAX_STOELEN = 16

/** De beste indeling die er met deze mensen te maken is.
 *
 *  Er wordt echt gezocht, niet van boven naar beneden gevuld: de beste kassa
 *  is soms ook de beste patatbakker, en dan moet er één schuiven. Wie waar
 *  komt hangt dus van de hele groep af, niet alleen van zijn eigen voorkeur. */
export function maakIndeling(opdracht: {
  stoelen: Stoel[]
  mensen: Persoon[]
  niveaus: Map<string, Niveau>
  eerder?: Eerder[]
}): Indeling {
  const { mensen, niveaus, eerder = [] } = opdracht
  const alle = opdracht.stoelen

  // Te veel stoelen: de onbelangrijkste blijven leeg. Komt in de praktijk niet
  // voor; zie MAX_STOELEN.
  const meedoen = new Set(
    [...alle]
      .sort((a, b) => b.belang - a.belang)
      .slice(0, MAX_STOELEN)
      .map((s) => s.sleutel),
  )
  const stoelen = alle.filter((s) => meedoen.has(s.sleutel))

  const herhaald = mensen.map((m) =>
    stoelen.map((s) => herhalingen(eerder, m.id, s.werkplek.id)),
  )
  const waarde = mensen.map((m, p) =>
    stoelen.map((s, i) =>
      waardering(niveauVan(niveaus, m.id, s.werkplek.id), s.belang, herhaald[p][i]),
    ),
  )

  const S = stoelen.length
  const P = mensen.length
  const toewijzing = new Map<string, number>()

  if (S > 0 && P > 0) {
    const maskers = 1 << S
    // dp[bezet] = de hoogste score waarmee precies die stoelen bezet zijn,
    // of -1 als die combinatie niet te bereiken is.
    let dp = new Int32Array(maskers).fill(-1)
    dp[0] = 0
    const keuzes: Int8Array[] = []

    for (let p = 0; p < P; p++) {
      const volgende = new Int32Array(maskers).fill(-1)
      const gekozen = new Int8Array(maskers).fill(-1)
      for (let bezet = 0; bezet < maskers; bezet++) {
        const nu = dp[bezet]
        if (nu < 0) continue
        for (let s = 0; s < S; s++) {
          if (bezet & (1 << s)) continue
          const w = waarde[p][s]
          if (w === null) continue
          const erbij = bezet | (1 << s)
          if (nu + w > volgende[erbij]) {
            volgende[erbij] = nu + w
            gekozen[erbij] = s
          }
        }
        // Deze persoon overslaan. Staat achteraan, zodat een gevulde stoel bij
        // gelijke score voorgaat op een lege.
        if (nu > volgende[bezet]) {
          volgende[bezet] = nu
          gekozen[bezet] = -1
        }
      }
      dp = volgende
      keuzes.push(gekozen)
    }

    let beste = 0
    for (let bezet = 1; bezet < maskers; bezet++) if (dp[bezet] > dp[beste]) beste = bezet

    let bezet = beste
    for (let p = P - 1; p >= 0; p--) {
      const s = keuzes[p][bezet]
      if (s >= 0) {
        toewijzing.set(stoelen[s].sleutel, p)
        bezet ^= 1 << s
      }
    }
  }

  const plekken: Plekvulling[] = alle.map((stoel) => {
    const i = toewijzing.get(stoel.sleutel)
    if (i === undefined) return { stoel, persoon: null, niveau: null, herhalingen: 0 }
    const index = stoelen.findIndex((s) => s.sleutel === stoel.sleutel)
    return {
      stoel,
      persoon: mensen[i],
      niveau: niveauVan(niveaus, mensen[i].id, stoel.werkplek.id),
      herhalingen: herhaald[i][index],
    }
  })

  const ingedeeld = new Set([...toewijzing.values()])
  const over = mensen
    .map((persoon, p) => ({
      persoon,
      p,
      // Wie overal 'nooit' staat kan nergens heen. Dat is iets anders dan
      // "we hadden genoeg mensen", en dat hoort op het scherm te verschillen.
      reden: waarde[p].every((w) => w === null) ? ('kan_niks' as const) : ('te_veel' as const),
    }))
    .filter((r) => !ingedeeld.has(r.p))
    .map(({ persoon, reden }) => ({ persoon, reden }))

  return { plekken, over, onbezet: plekken.filter((p) => !p.persoon).map((p) => p.stoel) }
}

/* ------------------------------------------------------- wie er die avond is --- */

export type SpitsShift = {
  medewerker_id: string | null
  voornaam: string | null
  achternaam: string | null
  begint: string | null
  eindigt: string | null
}

export type Volk = {
  /** De hele spits aanwezig: deze mensen deelt de app in. */
  heel: { persoon: Persoon; tijd: string }[]
  /** Wel aanwezig, maar niet van 17 tot 20. Die zet je er met de hand bij. */
  deels: { persoon: Persoon; tijd: string }[]
  /** Diensten zonder naam. Een gat in het rooster, nog geen gat in de spits. */
  open: number
}

const overlapt = (begint: string | null, eindigt: string | null) =>
  Boolean(begint && eindigt && begint < SPITS.tot && eindigt > SPITS.van)

const heleSpits = (begint: string | null, eindigt: string | null) =>
  Boolean(begint && eindigt && begint <= SPITS.van && eindigt >= SPITS.tot)

/** Wie er van de geplande diensten in de spits staat.
 *
 *  Alleen wie er van 17 tot 20 is wordt ingedeeld. Iemand die om 19 uur weg
 *  moet kun je niet op de kassa zetten; die staat apart, zodat je hem zelf kunt
 *  plaatsen als je dat wil. */
export function spitsVolk(shifts: SpitsShift[], namen: Map<string, string>): Volk {
  const per = new Map<string, { persoon: Persoon; tijden: string[]; heel: boolean }>()
  let open = 0

  for (const s of shifts) {
    const begint = schoonTijd(s.begint)
    const eindigt = schoonTijd(s.eindigt)
    if (!overlapt(begint, eindigt)) continue
    if (!s.medewerker_id) {
      open++
      continue
    }
    const naam =
      namen.get(s.medewerker_id) ??
      [s.voornaam, s.achternaam].filter(Boolean).join(' ') ??
      'Onbekend'
    const al = per.get(s.medewerker_id) ?? {
      persoon: { id: s.medewerker_id, naam },
      tijden: [],
      heel: false,
    }
    al.tijden.push(`${begint}–${eindigt}`)
    // Twee diensten op één dag: de dienst die de spits dekt bepaalt het.
    al.heel = al.heel || heleSpits(begint, eindigt)
    per.set(s.medewerker_id, al)
  }

  const op = (r: { persoon: Persoon; tijden: string[] }) => ({
    persoon: r.persoon,
    tijd: r.tijden.join(' + '),
  })
  const rijen = [...per.values()].sort((a, b) => a.persoon.naam.localeCompare(b.persoon.naam))

  return {
    heel: rijen.filter((r) => r.heel).map(op),
    deels: rijen.filter((r) => !r.heel).map(op),
    open,
  }
}

/* ---------------------------------------------------------------- ophalen --- */

export function useWerkplekken() {
  return useQuery({
    queryKey: ['werkplekken'],
    queryFn: async (): Promise<Werkplek[]> => {
      const { data, error } = await supabase
        .from('werkplekken')
        .select('id,naam,aantal,belang,volgorde,actief')
        .order('volgorde')
      if (error) throw new Error(error.message)
      return (data ?? []) as Werkplek[]
    },
  })
}

export function useNiveaus() {
  return useQuery({
    queryKey: ['werkplek-niveaus'],
    queryFn: async (): Promise<Map<string, Niveau>> => {
      const { data, error } = await supabase
        .from('medewerker_werkplek')
        .select('medewerker_id,werkplek_id,niveau')
      if (error) throw new Error(error.message)
      return new Map(
        (data ?? []).map((r) => [
          sleutelVan(r.medewerker_id as string, r.werkplek_id as string),
          r.niveau as Niveau,
        ]),
      )
    },
  })
}

export function useSpitsShifts(datum: string) {
  return useQuery({
    queryKey: ['spits-shifts', datum],
    queryFn: async (): Promise<SpitsShift[]> => {
      const { data, error } = await supabase
        .from('geplande_shifts')
        .select('medewerker_id,voornaam,achternaam,begint,eindigt')
        .eq('datum', datum)
      if (error) throw new Error(error.message)
      return (data ?? []) as SpitsShift[]
    },
  })
}

export type Vastgelegd = {
  werkplek_id: string
  plek: number
  medewerker_id: string
  vastgezet_op: string
}

export function useIndeling(datum: string) {
  return useQuery({
    queryKey: ['spits-indeling', datum],
    queryFn: async (): Promise<Vastgelegd[]> => {
      const { data, error } = await supabase
        .from('spits_indeling')
        .select('werkplek_id,plek,medewerker_id,vastgezet_op')
        .eq('datum', datum)
      if (error) throw new Error(error.message)
      return (data ?? []) as Vastgelegd[]
    },
  })
}

/** De vastgelegde indelingen van vóór deze datum, voor de afwisseling. */
export function useEerdereIndelingen(voor: string) {
  return useQuery({
    queryKey: ['spits-eerder', voor],
    queryFn: async (): Promise<Eerder[]> => {
      const { data, error } = await supabase
        .from('spits_indeling')
        .select('datum,medewerker_id,werkplek_id')
        .lt('datum', voor)
        .order('datum', { ascending: false })
        .limit(200)
      if (error) throw new Error(error.message)
      return (data ?? []) as Eerder[]
    },
  })
}

/* --------------------------------------------------------------- opslaan --- */

export function useNiveauZetten() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (keuze: {
      medewerker_id: string
      werkplek_id: string
      niveau: Geschiktheid
    }) => {
      // 'onbekend' is geen waarde maar het ontbreken ervan; dus weghalen in
      // plaats van opslaan.
      if (keuze.niveau === 'onbekend') {
        const { error } = await supabase
          .from('medewerker_werkplek')
          .delete()
          .eq('medewerker_id', keuze.medewerker_id)
          .eq('werkplek_id', keuze.werkplek_id)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase.from('medewerker_werkplek').upsert(
        {
          medewerker_id: keuze.medewerker_id,
          werkplek_id: keuze.werkplek_id,
          niveau: keuze.niveau,
          gezet_op: new Date().toISOString(),
        },
        { onConflict: 'medewerker_id,werkplek_id' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkplek-niveaus'] }),
  })
}

export function useWerkplekWijzigen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (wijziging: { id: string } & Partial<Omit<Werkplek, 'id'>>) => {
      const { id, ...velden } = wijziging
      const { error } = await supabase.from('werkplekken').update(velden).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['werkplekken'] }),
  })
}

export function useIndelingVastleggen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      datum: string
      plekken: { werkplek_id: string; plek: number; medewerker_id: string }[]
    }) => {
      const door = (await supabase.auth.getUser()).data.user?.email ?? null

      /* Eerst weg, dan opnieuw. Een plek die onbezet blijft moet ook echt
         verdwijnen, en bijwerken per regel laat een oude indeling half staan.
         Gaat het insert daarna mis, dan is de avond leeg — dat ziet hij, en
         opnieuw vastleggen kost één tik. Half goed zou hij niet zien. */
      const { error: weg } = await supabase.from('spits_indeling').delete().eq('datum', opdracht.datum)
      if (weg) throw new Error(weg.message)

      if (opdracht.plekken.length === 0) return
      const { error } = await supabase.from('spits_indeling').insert(
        opdracht.plekken.map((p) => ({
          datum: opdracht.datum,
          werkplek_id: p.werkplek_id,
          plek: p.plek,
          medewerker_id: p.medewerker_id,
          vastgezet_op: new Date().toISOString(),
          vastgezet_door: door,
        })),
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: (_uit, opdracht) => {
      client.invalidateQueries({ queryKey: ['spits-indeling', opdracht.datum] })
      client.invalidateQueries({ queryKey: ['spits-eerder'] })
      client.invalidateQueries({ queryKey: ['mijn-plekken'] })
    },
  })
}

/* -------------------------------------------------- voor de medewerker --- */

export type MijnPlek = { datum: string; werkplek_id: string; plek: number }

/** Waar ik de komende avonden sta. De database laat alleen mijn eigen regels
 *  los; zie het beleid eigen_plek. */
export function useMijnPlekken(vanaf: string) {
  return useQuery({
    queryKey: ['mijn-plekken', vanaf],
    queryFn: async (): Promise<MijnPlek[]> => {
      const { data, error } = await supabase
        .from('spits_indeling')
        .select('datum,werkplek_id,plek')
        .gte('datum', vanaf)
        .order('datum')
      if (error) throw new Error(error.message)
      return (data ?? []) as MijnPlek[]
    },
  })
}
