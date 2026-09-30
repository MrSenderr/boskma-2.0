/* Rooster en gewerkte uren: ophalen, vergelijken, importeren, optellen.
 *
 * Het rooster wordt gemaakt in eitje. Wat hier gebeurt is bewaren wat daar
 * stond, zodat er over een half jaar nog iets van te zeggen valt, en het naast
 * de urenregistratie leggen: wie werkte er meer dan er stond, wie minder.
 *
 * Zie docs/Modules/rooster.md.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { koppel, naamSleutel, type Afspraak, type Kandidaat, type Reden } from './koppelen'
import { naarKlok, type Eitjebestand, type Regel } from './eitje'

export type Shift = {
  bron_id: string
  datum: string
  voornaam: string | null
  achternaam: string | null
  medewerker_id: string | null
  team: string | null
  soort: string | null
  begint: string | null
  eindigt: string | null
  minuten: number
  pauze_minuten: number
}

const VELDEN =
  'bron_id,datum,voornaam,achternaam,medewerker_id,begint,eindigt,minuten'

/* ------------------------------------------------------------------ weken --- */

/** De maandag van de week waar deze datum in valt. */
export function maandagVan(datum: Date | string): string {
  const d = typeof datum === 'string' ? new Date(`${datum}T12:00:00`) : new Date(datum)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function verschuif(datum: string, dagen: number): string {
  const d = new Date(`${datum}T12:00:00`)
  d.setDate(d.getDate() + dagen)
  return d.toISOString().slice(0, 10)
}

export function weekVan(maandag: string): string[] {
  return Array.from({ length: 7 }, (_, i) => verschuif(maandag, i))
}

/** Het weeknummer zoals Nederland het telt (ISO 8601). */
export function weeknummer(datum: string): number {
  const d = new Date(`${datum}T12:00:00`)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const eersteDonderdag = new Date(d.getFullYear(), 0, 4)
  eersteDonderdag.setDate(eersteDonderdag.getDate() + 3 - ((eersteDonderdag.getDay() + 6) % 7))
  return 1 + Math.round((d.getTime() - eersteDonderdag.getTime()) / (7 * 86_400_000))
}

export function dagnaam(datum: string, lang = false): string {
  return new Date(`${datum}T12:00:00`).toLocaleDateString('nl-NL', {
    weekday: lang ? 'long' : 'short',
  })
}

export function datumKort(datum: string): string {
  return new Date(`${datum}T12:00:00`).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  })
}

export function maandNaam(maand: string): string {
  return new Date(`${maand}-01T12:00:00`).toLocaleDateString('nl-NL', {
    month: 'long',
    year: 'numeric',
  })
}

/* ----------------------------------------------------------------- ophalen --- */

/** Postgres geeft een `time` terug als "12:00:00", de export schrijft "12:00".
 *  Zonder dit verschil weg te nemen lijkt elke regel bij een herimport
 *  gewijzigd, en staan er seconden op het scherm die niemand wil zien. */
export function schoonTijd(tijd: string | null): string | null {
  return tijd ? tijd.slice(0, 5) : null
}

function schoon(rijen: Shift[]): Shift[] {
  return rijen.map((r) => ({ ...r, begint: schoonTijd(r.begint), eindigt: schoonTijd(r.eindigt) }))
}

async function haal(tabel: 'geplande_shifts' | 'gewerkte_uren', van: string, tot: string) {
  const extra = tabel === 'gewerkte_uren' ? ',pauze_minuten,soort' : ',team'
  const { data, error } = await supabase
    .from(tabel)
    .select(VELDEN + extra)
    .gte('datum', van)
    .lte('datum', tot)
    .order('datum')
  if (error) throw new Error(error.message)
  return schoon((data ?? []) as unknown as Shift[])
}

/** Gepland en gewerkt over dezelfde periode, in één keer. */
export function useRooster(van: string, tot: string) {
  return useQuery({
    queryKey: ['rooster', van, tot],
    queryFn: async () => ({
      gepland: await haal('geplande_shifts', van, tot),
      gewerkt: await haal('gewerkte_uren', van, tot),
    }),
  })
}

/** Wie er te koppelen valt. Bewust een eigen query met drie velden: de
 *  personeelslijst haalt meer op dan hier nodig is. */
export function useKandidaten() {
  return useQuery({
    queryKey: ['rooster-kandidaten'],
    queryFn: async (): Promise<Kandidaat[]> => {
      const { data, error } = await supabase
        .from('sollicitaties')
        .select('id,voornaam,achternaam,uit_dienst_op')
        .eq('fase', 'medewerker')
        .eq('is_apparaat', false)
        .order('voornaam')
      if (error) throw new Error(error.message)
      return (data ?? []) as Kandidaat[]
    },
  })
}

export function useAfspraken() {
  return useQuery({
    queryKey: ['rooster-namen'],
    queryFn: async (): Promise<Map<string, Afspraak>> => {
      const { data, error } = await supabase
        .from('rooster_namen')
        .select('naam,medewerker_id,negeren')
      if (error) throw new Error(error.message)
      return new Map(
        (data ?? []).map((r) => [
          r.naam as string,
          { medewerker_id: r.medewerker_id as string | null, negeren: r.negeren as boolean },
        ]),
      )
    },
  })
}

export function useNaamVastleggen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (keuze: { naam: string; medewerker_id: string | null }) => {
      const { error } = await supabase.from('rooster_namen').upsert(
        {
          naam: keuze.naam,
          medewerker_id: keuze.medewerker_id,
          negeren: keuze.medewerker_id === null,
          gezet_op: new Date().toISOString(),
        },
        { onConflict: 'naam' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['rooster-namen'] }),
  })
}

export function useImports() {
  return useQuery({
    queryKey: ['rooster-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooster_imports')
        .select('*')
        .order('op', { ascending: false })
        .limit(20)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/* -------------------------------------------------------------- vergelijken --- */

export type Beoordeelde = {
  regel: Regel
  medewerker_id: string | null
  reden: Reden
  staat: 'nieuw' | 'gewijzigd' | 'ongewijzigd'
  /** Wat er verandert ten opzichte van wat er al stond. */
  was?: string
}

export type Voorstel = {
  soort: Eitjebestand['soort']
  regels: Beoordeelde[]
  nieuw: number
  gewijzigd: number
  ongewijzigd: number
  /** Namen die nergens bij passen, elk één keer, met hoe vaak ze voorkomen. */
  onbekend: { sleutel: string; naam: string; aantal: number; reden: Reden }[]
  open: number
}

function beschrijf(regel: { begint: string | null; eindigt: string | null; minuten: number }) {
  return `${regel.begint ?? '?'}–${regel.eindigt ?? '?'} (${naarKlok(regel.minuten)})`
}

/** Wat de import zou doen, zonder iets te doen. Zo staat er op het scherm wat
 *  er verandert vóórdat het gebeurt — bij een wekelijkse handeling wil je een
 *  vergissing zien, niet achteraf ontdekken. */
export function beoordeel(
  bestand: Eitjebestand,
  bestaand: Map<string, Shift>,
  kandidaten: Kandidaat[],
  afspraken: Map<string, Afspraak>,
): Voorstel {
  const regels: Beoordeelde[] = bestand.regels.map((regel) => {
    const { medewerker_id, reden } = koppel(regel, kandidaten, afspraken)
    const er = bestaand.get(regel.bron_id)

    let staat: Beoordeelde['staat'] = 'nieuw'
    let was: string | undefined
    if (er) {
      const zelfde =
        er.datum === regel.datum &&
        er.minuten === regel.minuten &&
        (er.begint ?? '') === (regel.begint ?? '') &&
        (er.eindigt ?? '') === (regel.eindigt ?? '') &&
        er.medewerker_id === medewerker_id
      staat = zelfde ? 'ongewijzigd' : 'gewijzigd'
      if (!zelfde) was = `${er.datum} ${beschrijf(er)}`
    }
    return { regel, medewerker_id, reden, staat, was }
  })

  const onbekend = new Map<string, { sleutel: string; naam: string; aantal: number; reden: Reden }>()
  for (const r of regels) {
    if (r.medewerker_id || r.reden === 'open' || r.reden === 'genegeerd') continue
    const sleutel = naamSleutel(r.regel.voornaam, r.regel.achternaam)
    const al = onbekend.get(sleutel)
    if (al) al.aantal++
    else
      onbekend.set(sleutel, {
        sleutel,
        naam: [r.regel.voornaam, r.regel.achternaam].filter(Boolean).join(' '),
        aantal: 1,
        reden: r.reden,
      })
  }

  return {
    soort: bestand.soort,
    regels,
    nieuw: regels.filter((r) => r.staat === 'nieuw').length,
    gewijzigd: regels.filter((r) => r.staat === 'gewijzigd').length,
    ongewijzigd: regels.filter((r) => r.staat === 'ongewijzigd').length,
    onbekend: [...onbekend.values()].sort((a, b) => b.aantal - a.aantal),
    open: regels.filter((r) => r.reden === 'open').length,
  }
}

/** Wat er al van deze regels in de database staat, op bron_id. */
export async function haalBestaand(
  soort: Eitjebestand['soort'],
  bronIds: string[],
): Promise<Map<string, Shift>> {
  const tabel = soort === 'planning' ? 'geplande_shifts' : 'gewerkte_uren'
  const uit = new Map<string, Shift>()
  // PostgREST zet de vraag in de URL; een jaar aan regels in één keer wordt te
  // lang. Vandaar in stukken.
  for (let i = 0; i < bronIds.length; i += 200) {
    const { data, error } = await supabase
      .from(tabel)
      .select(VELDEN)
      .in('bron_id', bronIds.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const rij of schoon((data ?? []) as unknown as Shift[])) uit.set(rij.bron_id, rij)
  }
  return uit
}

/* --------------------------------------------------------------- importeren --- */

export function useImporteren() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (opdracht: {
      bestand: Eitjebestand
      bestandsnaam: string
      voorstel: Voorstel
    }) => {
      const { bestand, bestandsnaam, voorstel } = opdracht
      const tabel = bestand.soort === 'planning' ? 'geplande_shifts' : 'gewerkte_uren'

      const { data: logboek, error: logfout } = await supabase
        .from('rooster_imports')
        .insert({
          soort: bestand.soort,
          bestandsnaam,
          export_nummer: bestand.exportNummer,
          geexporteerd_op: bestand.geexporteerdOp,
          periode_van: bestand.periode?.van ?? null,
          periode_tot: bestand.periode?.tot ?? null,
          aantal_regels: voorstel.regels.length,
          aantal_nieuw: voorstel.nieuw,
          aantal_gewijzigd: voorstel.gewijzigd,
          door: (await supabase.auth.getUser()).data.user?.email ?? null,
        })
        .select('id')
        .single()
      if (logfout) throw new Error(logfout.message)

      const rijen = voorstel.regels.map(({ regel, medewerker_id }) => ({
        bron_id: regel.bron_id,
        datum: regel.datum,
        voornaam: regel.voornaam,
        achternaam: regel.achternaam,
        medewerker_id,
        begint: regel.begint,
        eindigt: regel.eindigt,
        minuten: regel.minuten,
        import_id: logboek.id,
        bijgewerkt_op: new Date().toISOString(),
        ...(bestand.soort === 'planning'
          ? { team: regel.team }
          : { pauze_minuten: regel.pauze_minuten, soort: regel.soort, maaltijden: regel.maaltijden }),
      }))

      for (let i = 0; i < rijen.length; i += 500) {
        const { error } = await supabase
          .from(tabel)
          .upsert(rijen.slice(i, i + 500), { onConflict: 'bron_id' })
        if (error) throw new Error(error.message)
      }
      return { aantal: rijen.length }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['rooster'] })
      client.invalidateQueries({ queryKey: ['rooster-imports'] })
    },
  })
}

/* -------------------------------------------------------------- statistiek --- */

export type Statistiek = {
  sleutel: string
  naam: string
  medewerker_id: string | null
  gepland: number
  gewerkt: number
  /** Van `gepland` het deel op dagen waarover ook uren zijn ingelezen. */
  vergelijkbaar: number
  /** Gewerkt min vergelijkbaar. Positief is meer gewerkt dan er stond. */
  verschil: number
  shifts: number
  dagen: number
  /** Langste dienst in minuten; een 12-uursdag valt zo op. */
  langste: number
}

function naamUit(rij: Shift) {
  return [rij.voornaam, rij.achternaam].filter(Boolean).join(' ') || 'Open dienst'
}

/** Per persoon optellen wat er gepland stond en wat er gewerkt is.
 *
 *  Gegroepeerd op medewerker als die bekend is, anders op de naam uit de
 *  export. Zo verdwijnt iemand die nog niet gekoppeld is niet uit het
 *  overzicht — hij staat er, met de aantekening dat hij los staat. */
export function statistiek(gepland: Shift[], gewerkt: Shift[]): Statistiek[] {
  const uit = new Map<string, Statistiek>()
  // Alleen dagen waarover uren zijn ingelezen kun je vergelijken. Zonder die
  // afbakening lijkt iedereen die volgende week is ingeroosterd nu al niet te
  // zijn komen opdagen.
  const metUren = new Set(gewerkt.map((r) => r.datum))

  const pak = (rij: Shift) => {
    const sleutel = rij.medewerker_id ?? `naam:${naamSleutel(rij.voornaam, rij.achternaam)}`
    let s = uit.get(sleutel)
    if (!s) {
      s = {
        sleutel,
        naam: naamUit(rij),
        medewerker_id: rij.medewerker_id,
        gepland: 0,
        gewerkt: 0,
        vergelijkbaar: 0,
        verschil: 0,
        shifts: 0,
        dagen: 0,
        langste: 0,
      }
      uit.set(sleutel, s)
    }
    // De roosterexport heeft een achternaam, de urenexport niet. De langste
    // naam is dus de volledigste.
    if (naamUit(rij).length > s.naam.length) s.naam = naamUit(rij)
    return s
  }

  for (const rij of gepland) {
    const s = pak(rij)
    s.gepland += rij.minuten
    if (metUren.has(rij.datum)) s.vergelijkbaar += rij.minuten
  }

  const dagen = new Map<string, Set<string>>()
  for (const rij of gewerkt) {
    const s = pak(rij)
    s.gewerkt += rij.minuten
    if (rij.minuten > 0) {
      s.shifts++
      s.langste = Math.max(s.langste, rij.minuten)
      if (!dagen.has(s.sleutel)) dagen.set(s.sleutel, new Set())
      dagen.get(s.sleutel)!.add(rij.datum)
    }
  }

  for (const s of uit.values()) {
    s.dagen = dagen.get(s.sleutel)?.size ?? 0
    s.verschil = s.gewerkt - s.vergelijkbaar
  }

  return [...uit.values()].sort((a, b) => b.gewerkt - a.gewerkt || b.gepland - a.gepland)
}

/** Per persoon per dag, voor "wie werkte er langer door dan er stond". Alleen
 *  de dagen waarop het verschilt; de rest is ruis. */
export function afwijkendeDagen(gepland: Shift[], gewerkt: Shift[], drempel = 30) {
  const per = new Map<string, { naam: string; datum: string; gepland: number; gewerkt: number }>()
  const metUren = new Set(gewerkt.map((r) => r.datum))

  const plek = (rij: Shift) => {
    const wie = rij.medewerker_id ?? `naam:${naamSleutel(rij.voornaam, rij.achternaam)}`
    const sleutel = `${wie}|${rij.datum}`
    if (!per.has(sleutel))
      per.set(sleutel, { naam: naamUit(rij), datum: rij.datum, gepland: 0, gewerkt: 0 })
    return per.get(sleutel)!
  }

  // Een dag zonder enige urenregistratie is een dag die nog niet is ingelezen,
  // geen dag waarop niemand kwam opdagen.
  for (const rij of gepland) if (metUren.has(rij.datum)) plek(rij).gepland += rij.minuten
  for (const rij of gewerkt) {
    const p = plek(rij)
    p.gewerkt += rij.minuten
    if (naamUit(rij).length > p.naam.length) p.naam = naamUit(rij)
  }

  return [...per.values()]
    .map((p) => ({ ...p, verschil: p.gewerkt - p.gepland }))
    .filter((p) => Math.abs(p.verschil) >= drempel)
    .sort((a, b) => Math.abs(b.verschil) - Math.abs(a.verschil))
}

/* -------------------------------------------------------------- per dag --- */

export type Dagregel = {
  sleutel: string
  naam: string
  medewerker_id: string | null
  team: string | null
  gepland: number
  gewerkt: number
  geplandTijd: string | null
  gewerktTijd: string | null
  /** Er stond een dienst, maar er is niemand op gezet. */
  open: boolean
  /** Gewerkt zonder dat het gepland stond. */
  onverwacht: boolean
}

function tijdvak(rij: Shift) {
  return rij.begint && rij.eindigt ? `${rij.begint} – ${rij.eindigt}` : null
}

/** Het rooster van een dag met de gewerkte uren eroverheen: één regel per
 *  persoon, met wat er stond en wat het werd. */
export function dagoverzicht(gepland: Shift[], gewerkt: Shift[]): Map<string, Dagregel[]> {
  const per = new Map<string, Map<string, Dagregel>>()

  const plek = (rij: Shift) => {
    // Een open dienst krijgt zijn eigen regel per shift; twee onbemande
    // diensten op één dag zijn twee gaten, niet één.
    const wie =
      rij.medewerker_id ??
      (rij.voornaam ? `naam:${naamSleutel(rij.voornaam, rij.achternaam)}` : `open:${rij.bron_id}`)
    if (!per.has(rij.datum)) per.set(rij.datum, new Map())
    const dag = per.get(rij.datum)!
    if (!dag.has(wie))
      dag.set(wie, {
        sleutel: wie,
        naam: naamUit(rij),
        medewerker_id: rij.medewerker_id,
        team: rij.team,
        gepland: 0,
        gewerkt: 0,
        geplandTijd: null,
        gewerktTijd: null,
        open: false,
        onverwacht: false,
      })
    return dag.get(wie)!
  }

  for (const rij of gepland) {
    const r = plek(rij)
    r.gepland += rij.minuten
    r.geplandTijd = r.geplandTijd ? `${r.geplandTijd} + ${tijdvak(rij)}` : tijdvak(rij)
    r.team = r.team ?? rij.team
    if (!rij.voornaam) r.open = true
  }

  for (const rij of gewerkt) {
    const r = plek(rij)
    r.gewerkt += rij.minuten
    r.gewerktTijd = r.gewerktTijd ? `${r.gewerktTijd} + ${tijdvak(rij)}` : tijdvak(rij)
    if (naamUit(rij).length > r.naam.length) r.naam = naamUit(rij)
  }

  const uit = new Map<string, Dagregel[]>()
  for (const [datum, mensen] of per) {
    for (const r of mensen.values()) r.onverwacht = r.gepland === 0 && r.gewerkt > 0
    uit.set(
      datum,
      [...mensen.values()].sort(
        (a, b) => (a.geplandTijd ?? a.gewerktTijd ?? '').localeCompare(b.geplandTijd ?? b.gewerktTijd ?? '') || a.naam.localeCompare(b.naam),
      ),
    )
  }
  return uit
}
