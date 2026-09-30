/* De exports van eitje lezen.
 *
 * Twee soorten: "Geplande shifts" (het rooster) en "Gewerkte uren" (de
 * urenregistratie). Ze hebben niet dezelfde kolommen en zelfs niet dezelfde
 * manier om een datum op te schrijven — het rooster zegt "08/09/2026", de uren
 * zeggen "zaterdag 01 augustus" en laten het jaartal weg. Hier wordt daar één
 * vorm van gemaakt.
 *
 * De kolomvolgorde ligt niet vast: eitje laat je zelf kiezen wat er in een
 * export staat. Daarom wordt er nooit op plek gelezen maar op naam. Het tabblad
 * "log" noemt de kolommen bij hun interne naam (user_first_name, shift_date);
 * staat dat tabblad er niet, dan worden de Nederlandse koppen gebruikt. Een
 * kolom erbij zetten in eitje breekt de import dus niet.
 */

import type { Werkboek } from './xlsx-lezen'

export type Exportsoort = 'planning' | 'gewerkt'

export type Regel = {
  /** het "support ID" uit de export: het record_id van eitje */
  bron_id: string
  datum: string
  /** Leeg bij een open dienst: wel ingeroosterd, nog niemand op gezet. */
  voornaam: string | null
  achternaam: string | null
  team: string | null
  soort: string | null
  begint: string | null
  eindigt: string | null
  minuten: number
  pauze_minuten: number
  maaltijden: string | null
}

export type Eitjebestand = {
  soort: Exportsoort
  periode: { van: string; tot: string } | null
  geexporteerdOp: string | null
  exportNummer: string | null
  vestigingen: string | null
  regels: Regel[]
  /** Wat opvalt maar de import niet tegenhoudt. */
  waarschuwingen: string[]
}

/* ------------------------------------------------------------- kolommen --- */

type Veld =
  | 'voornaam'
  | 'achternaam'
  | 'datum'
  | 'team'
  | 'uren'
  | 'tijdvak'
  | 'pauze'
  | 'maaltijden'
  | 'soort'
  | 'bron_id'

/** Links de interne naam uit het tabblad "log", rechts de Nederlandse kop
 *  boven de kolom. Allebei wijzen ze hetzelfde veld aan. */
const VELDEN: Record<string, Veld> = {
  user_first_name: 'voornaam',
  voornaam: 'voornaam',
  user_last_name: 'achternaam',
  achternaam: 'achternaam',
  shift_date: 'datum',
  datum: 'datum',
  shift_team: 'team',
  team: 'team',
  shift_hours: 'uren',
  uren: 'uren',
  shift_start_end_time_range: 'tijdvak',
  'start- tot eindtijd': 'tijdvak',
  shift_break_time: 'pauze',
  pauze: 'pauze',
  shift_meals: 'maaltijden',
  maaltijden: 'maaltijden',
  shift_type: 'soort',
  type: 'soort',
  record_id: 'bron_id',
  'support id': 'bron_id',
}

const SOORTEN: Record<string, Exportsoort> = {
  planning_shift: 'planning',
  time_registration_shift: 'gewerkt',
}

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

/* ---------------------------------------------------------------- hulpjes --- */

/** Kleine letters, zonder accenten, zonder de sorteerpijl die eitje voor een
 *  kopje zet, en met één spatie tussen de woorden. */
export function sleutel(tekst: string): string {
  return tekst
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[▲▼]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** "08:00" wordt 480. Ook "8:00" en "1:05:00" komen voor. */
export function naarMinuten(tekst: string): number {
  const delen = tekst.trim().split(':')
  if (delen.length < 2 || delen.some((d) => !/^\d+$/.test(d))) return 0
  return Number(delen[0]) * 60 + Number(delen[1])
}

export function naarKlok(minuten: number): string {
  const teken = minuten < 0 ? '-' : ''
  const m = Math.abs(Math.round(minuten))
  return `${teken}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Uren als decimaal getal, op twee cijfers. Voor optellen in een grafiek. */
export function naarUren(minuten: number): number {
  return Math.round((minuten / 60) * 100) / 100
}

function tweeCijfers(n: number) {
  return String(n).padStart(2, '0')
}

/** Alle vormen die in de exports voorkomen, naar jjjj-mm-dd.
 *
 *  De urenexport laat het jaartal weg ("zaterdag 01 augustus"). Dat komt dan
 *  uit de periode van de export. Een periode die over de jaarwisseling loopt
 *  zou bij een vast jaartal de helft van december of januari een jaar
 *  misplaatsen, dus wordt het jaar gekozen waarin de datum ook echt valt. */
export function naarDatum(tekst: string, periode?: { van: string; tot: string } | null): string | null {
  const schoon = sleutel(tekst)
  if (!schoon) return null

  const iso = schoon.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const cijfers = schoon.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (cijfers) {
    const jaar = Number(cijfers[3])
    return `${jaar < 100 ? 2000 + jaar : jaar}-${tweeCijfers(Number(cijfers[2]))}-${tweeCijfers(Number(cijfers[1]))}`
  }

  const metMaandnaam = schoon.match(/(\d{1,2})\s+([a-z]+)/)
  if (metMaandnaam) {
    const maand = MAANDEN.indexOf(metMaandnaam[2])
    if (maand < 0) return null
    const dag = Number(metMaandnaam[1])
    const kandidaten = periode
      ? [Number(periode.van.slice(0, 4)), Number(periode.tot.slice(0, 4))]
      : [new Date().getFullYear()]
    for (const jaar of [...new Set(kandidaten)]) {
      const datum = `${jaar}-${tweeCijfers(maand + 1)}-${tweeCijfers(dag)}`
      if (!periode || (datum >= periode.van && datum <= periode.tot)) return datum
    }
    return `${kandidaten[0]}-${tweeCijfers(maand + 1)}-${tweeCijfers(dag)}`
  }
  return null
}

/** "12:00 - 19:45" wordt de twee tijden. */
function splitsTijdvak(tekst: string): [string | null, string | null] {
  const tijden = tekst.match(/\d{1,2}:\d{2}/g)
  if (!tijden || tijden.length < 2) return [null, null]
  const nul = (t: string) => (t.length === 4 ? `0${t}` : t)
  return [nul(tijden[0]), nul(tijden[1])]
}

/* ----------------------------------------------------------------- lezen --- */

/** Uit de informatieblokken bovenaan een tabblad: de waarde achter een label. */
function waardeBij(rijen: string[][], label: string): string | null {
  const rij = rijen.find((r) => sleutel(r[0] ?? '').startsWith(sleutel(label)))
  return rij ? (rij[1] ?? '').trim() || null : null
}

function leesPeriode(rijen: string[][]): { van: string; tot: string } | null {
  // "maandag 07-09-2026 – zondag 13-09-2026", met een gedachtestreepje.
  const tekst = waardeBij(rijen, 'Geëxporteerde periode')
  if (!tekst) return null
  const datums = tekst.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g)
  if (!datums || datums.length < 2) return null
  const van = naarDatum(datums[0])
  const tot = naarDatum(datums[1])
  return van && tot ? { van, tot } : null
}

function kolommenUitLog(log: string[][] | undefined): Map<Veld, number> | null {
  const regel = log && waardeBij(log, 'Columns')
  if (!regel) return null
  const uit = new Map<Veld, number>()
  for (const deel of regel.split(',')) {
    const stuk = deel.trim().match(/^(\d+)\.\s*(.+)$/)
    if (!stuk) continue
    const veld = VELDEN[sleutel(stuk[2])]
    if (veld) uit.set(veld, Number(stuk[1]))
  }
  return uit.size ? uit : null
}

function kolommenUitKop(rij: string[]): Map<Veld, number> {
  const uit = new Map<Veld, number>()
  rij.forEach((kop, plek) => {
    const veld = VELDEN[sleutel(kop)]
    if (veld !== undefined && !uit.has(veld)) uit.set(veld, plek)
  })
  return uit
}

/** De rij met de kopjes: de eerste rij die een kolomnaam bevat die we kennen.
 *  Daarboven staan de informatieblokken, die per export verschillen in hoogte. */
function zoekKop(rijen: string[][]): number {
  return rijen.findIndex(
    (r) => r.filter((cel) => VELDEN[sleutel(cel)] !== undefined).length >= 3,
  )
}

export function leesEitje(werkboek: Werkboek): Eitjebestand {
  const tabel = werkboek.get('table') ?? [...werkboek.values()][0]
  if (!tabel) throw new Error('Dit bestand heeft geen tabblad met gegevens.')
  const log = werkboek.get('log')

  const soortTekst = log ? waardeBij(log, 'Table type') : null
  const soort = soortTekst ? SOORTEN[sleutel(soortTekst)] : undefined

  const kop = zoekKop(tabel)
  if (kop < 0) throw new Error('In dit bestand staan geen herkenbare kolommen.')
  const kolommen = kolommenUitLog(log) ?? kolommenUitKop(tabel[kop])

  // Zonder het tabblad "log" is de soort af te leiden uit wat er in staat: een
  // rooster heeft een team, de urenregistratie een pauze.
  const gekozenSoort: Exportsoort =
    soort ?? (kolommen.has('pauze') || kolommen.has('soort') ? 'gewerkt' : 'planning')

  const periode = leesPeriode(tabel) ?? leesPeriodeUitLog(log)
  const waarschuwingen: string[] = []
  const regels: Regel[] = []
  const gezien = new Set<string>()
  let zonderDatum = 0

  const cel = (rij: string[], veld: Veld): string => {
    const plek = kolommen.get(veld)
    return plek === undefined ? '' : (rij[plek] ?? '').trim()
  }

  for (const rij of tabel.slice(kop + 1)) {
    const bron_id = cel(rij, 'bron_id')
    // De laatste regel van een export is een optelling: wel een urentotaal,
    // geen id. Een regel zónder naam maar mét id is iets anders — dat is een
    // open dienst, en die hoort juist zichtbaar te blijven.
    if (!bron_id) continue
    if (gezien.has(bron_id)) continue
    gezien.add(bron_id)

    const datum = naarDatum(cel(rij, 'datum'), periode)
    if (!datum) {
      zonderDatum++
      continue
    }

    const [begint, eindigt] = splitsTijdvak(cel(rij, 'tijdvak'))
    const pauze_minuten = naarMinuten(cel(rij, 'pauze'))
    const urenKolom = cel(rij, 'uren')
    let minuten = naarMinuten(urenKolom)

    // Staat er geen urenkolom in de export, dan volgt de duur uit het tijdvak.
    if (!urenKolom && begint && eindigt) {
      const duur = naarMinuten(eindigt) - naarMinuten(begint)
      minuten = (duur < 0 ? duur + 24 * 60 : duur) - pauze_minuten
    }

    regels.push({
      bron_id,
      datum,
      voornaam: cel(rij, 'voornaam') || null,
      achternaam: cel(rij, 'achternaam') || null,
      team: cel(rij, 'team') || null,
      soort: cel(rij, 'soort') || null,
      begint,
      eindigt,
      minuten,
      pauze_minuten,
      maaltijden: cel(rij, 'maaltijden') || null,
    })
  }

  if (zonderDatum) {
    waarschuwingen.push(
      `${zonderDatum} ${zonderDatum === 1 ? 'regel is' : 'regels zijn'} overgeslagen omdat de datum onleesbaar was.`,
    )
  }

  const open = regels.filter((r) => !r.voornaam).length
  if (open) {
    waarschuwingen.push(
      `${open} ${open === 1 ? 'dienst staat' : 'diensten staan'} nog open: ingeroosterd, maar er staat niemand op.`,
    )
  }

  const leeg = regels.filter((r) => r.minuten === 0).length
  if (leeg) {
    waarschuwingen.push(
      `${leeg} ${leeg === 1 ? 'regel staat' : 'regels staan'} op nul uur — iemand die in- en uitklokte zonder tussenliggende tijd. Ze worden wel bewaard maar tellen nergens in mee.`,
    )
  }

  if (!kolommen.has('achternaam')) {
    waarschuwingen.push(
      'Deze export heeft geen achternaam. Koppelen gebeurt dan op voornaam; zet de kolom in eitje erbij en het wordt sluitend.',
    )
  }

  return {
    soort: gekozenSoort,
    periode,
    geexporteerdOp: (log && waardeBij(log, 'Export time')) ?? waardeBij(tabel, 'Geëxporteerd op'),
    exportNummer: log ? waardeBij(log, 'Excel') : null,
    vestigingen: waardeBij(tabel, 'Vestigingen'),
    regels,
    waarschuwingen,
  }
}

function leesPeriodeUitLog(log: string[][] | undefined): { van: string; tot: string } | null {
  if (!log) return null
  const van = naarDatum(waardeBij(log, 'Start date') ?? '')
  const tot = naarDatum(waardeBij(log, 'End date') ?? '')
  return van && tot ? { van, tot } : null
}
