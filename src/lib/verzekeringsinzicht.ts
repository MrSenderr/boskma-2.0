/* Export van het personeelsbestand naar Verzekeringsinzicht.

   Formaat en bedrijfsregels staan in docs/SPEC-verzekeringsinzicht-csv.md; die
   spec is leidend. Het voorbeeldbestand ernaast toont bij een 0-urencontract
   nog 0.00 in de urenkolommen, maar de spec zegt dat 0 geweigerd wordt en het
   minimum 1 is. We volgen de spec.

   Alles hier is gewone rekenarij zonder database, zodat het te testen is. */

import { supabase } from './supabase'

/* Bewust een eigen vorm en niet Persoon: daar hangt onboarding_data aan, met
   BSN en rekeningnummer erin. Voor een export naar de verzekeraar zijn die niet
   nodig, dus halen we ze ook niet op. */
export type ExportPersoon = {
  id: string
  voornaam: string | null
  achternaam: string | null
  voorletters: string | null
  tussenvoegsel: string | null
  geboortedatum: string | null
  email: string | null
  telefoonnummer: string | null
  geslacht: string | null
  straat: string | null
  huisnummer: string | null
  toevoeging: string | null
  postcode: string | null
  woonplaats: string | null
  contracttype: string | null
  contractduur: 'bepaalde' | 'onbepaalde' | null
  contracturen: number | null
  functie: string | null
  ingangsdatum: string | null
  einddatum: string | null
  fase: string
  uit_dienst_op: string | null
  loonbureau_verstuurd_op: string | null
}

export const KOLOMMEN = [
  'voorletters', 'tussenvoegsel', 'achternaam', 'geboorte_datum', 'geslacht',
  'dga', 'email', 'telefoon', 'werknemernummer', 'straat', 'huisnummer',
  'toevoeging', 'postcode', 'plaats', 'land', 'Begindatum', 'Contract',
  'DienstverbandSoort', 'Einddatum', 'Afdeling', 'Functieomschrijving',
  'Werkzaamheden', 'Dienstverband', 'ParttimePercentage', 'Contracturen',
] as const

/** Iedereen bij ons werkt in de zaak: handenarbeid. */
const WERKZAAMHEDEN = 'H'
const LAND = 'NL'
/** Een directeur-grootaandeelhouder zit hier niet tussen. */
const DGA = 'n'

/** Een volle werkweek. Hiermee wordt het parttimepercentage berekend. */
export const VOLLEDIGE_WEEK = 40

/* ------------------------------------------------------------------ naam --- */

/* Losse woorden vóór de achternaam. Alleen als los woord herkend, zodat
   "Vandenberg" heel blijft. Langste combinaties eerst. */
const TUSSENVOEGSELS = [
  'van der', 'van den', 'van de', "van 't", 'van het', 'in de', 'in het', "in 't",
  'op de', 'op den', 'aan de', 'aan den', 'uit de', 'uit den', 'van',
  'de', 'den', 'der', 'het', "'t", 'te', 'ten', 'ter', 'ver', 'bij', 'voor', 'op',
]

/** "Jan" wordt J., "Jan Pieter" en "Jan-Pieter" worden J.P. */
export function afgeleideVoorletters(voornaam: string | null | undefined): string {
  return (voornaam ?? '')
    .split(/[\s-]+/)
    .map((deel) => deel.trim())
    .filter(Boolean)
    .map((deel) => `${deel[0].toUpperCase()}.`)
    .join('')
}

/** "de Vries" uit elkaar in "de" en "Vries". Herkent hij niets, dan blijft de
 *  achternaam heel — liever niets doen dan iets afknippen dat erbij hoort. */
export function splitsAchternaam(achternaam: string | null | undefined): {
  tussenvoegsel: string
  achternaam: string
} {
  const heel = (achternaam ?? '').trim()
  const laag = heel.toLowerCase()
  for (const tv of TUSSENVOEGSELS) {
    if (laag.startsWith(`${tv} `)) {
      return { tussenvoegsel: tv, achternaam: heel.slice(tv.length + 1).trim() }
    }
  }
  return { tussenvoegsel: '', achternaam: heel }
}

/** Wat er uiteindelijk in de drie naamkolommen komt. Wat Sander heeft
 *  ingevuld wint van wat wij afleiden. */
export function naamdelen(p: ExportPersoon) {
  const gesplitst = splitsAchternaam(p.achternaam)
  const tussenvoegsel = (p.tussenvoegsel ?? '').trim() || gesplitst.tussenvoegsel
  // Staat het tussenvoegsel nog vóór de achternaam, dan hoort het daar niet
  // ook nog eens te blijven staan.
  const heel = (p.achternaam ?? '').trim()
  const zonder = heel.toLowerCase().startsWith(`${tussenvoegsel.toLowerCase()} `)
    ? heel.slice(tussenvoegsel.length + 1).trim()
    : heel
  return {
    voorletters: (p.voorletters ?? '').trim() || afgeleideVoorletters(p.voornaam),
    tussenvoegsel,
    achternaam: zonder,
  }
}

/** De spec zegt: initialen. Voorletters zonder punten plus de eerste letter
 *  van de achternaam, dus J. de Vries wordt JV. */
export function werknemernummer(p: ExportPersoon): string {
  const n = naamdelen(p)
  return (n.voorletters.replace(/\./g, '') + (n.achternaam[0] ?? '')).toUpperCase()
}

/* ----------------------------------------------------------------- adres --- */

/** "82 A" en "82A" worden 82 + A. Een kaal nummer blijft kaal. */
export function splitsHuisnummer(huisnummer: string | null | undefined): {
  nummer: string
  toevoeging: string
} {
  const heel = (huisnummer ?? '').trim()
  const m = heel.match(/^(\d+)\s*(.*)$/)
  if (!m) return { nummer: heel, toevoeging: '' }
  return { nummer: m[1], toevoeging: m[2].trim() }
}

/** De spec wil 1234AB, wij bewaren 1234 AB. */
export function postcodeSchoon(postcode: string | null | undefined): string {
  return (postcode ?? '').replace(/\s+/g, '').toUpperCase()
}

/* ---------------------------------------------------------------- datums --- */

/** 2026-07-01 wordt 01-07-2026. */
export function datumNL(datum: string | null | undefined): string {
  if (!datum) return ''
  const m = String(datum).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/* ------------------------------------------------------------- contract --- */

export type Dienstverband = {
  soort: string
  dienstverband: 'ft' | 'pt'
  percentage: number
  uren: number
}

/** Bedrijfsregels uit de spec. Een 0-urencontract heeft geen uren, maar de
 *  spec weigert een 0 — daar staat een 1 voor in de plaats. */
export function dienstverbandVan(p: ExportPersoon): Dienstverband | null {
  const oproep = (p.contracttype ?? '').toLowerCase().includes('nuluren')
  if (oproep) {
    return { soort: '0-uren', dienstverband: 'pt', percentage: 1, uren: 1 }
  }
  const uren = p.contracturen
  if (uren === null || uren === undefined) return null
  const afgerond = Math.round(uren)
  return {
    soort: 'regulier',
    dienstverband: afgerond >= VOLLEDIGE_WEEK ? 'ft' : 'pt',
    percentage: Math.round((afgerond / VOLLEDIGE_WEEK) * 100),
    uren: afgerond,
  }
}

/* ------------------------------------------------------------------ rij --- */

function adresVan(p: ExportPersoon) {
  const gesplitst = splitsHuisnummer(p.huisnummer)
  return {
    straat: (p.straat ?? '').trim(),
    huisnummer: gesplitst.nummer,
    // Een eigen veldje wint; anders knippen we het van het huisnummer af.
    toevoeging: (p.toevoeging ?? '').trim() || gesplitst.toevoeging,
    postcode: postcodeSchoon(p.postcode),
    plaats: (p.woonplaats ?? '').trim().toUpperCase(),
  }
}

function geslachtVan(p: ExportPersoon): string {
  const w = (p.geslacht ?? '').trim().toLowerCase()
  if (w === 'm' || w === 'man') return 'M'
  if (w === 'v' || w === 'vrouw') return 'V'
  if (w === 'o' || w === 'overig') return 'O'
  return ''
}

export function rijVan(p: ExportPersoon): Record<string, string> {
  const naam = naamdelen(p)
  const adres = adresVan(p)
  const dv = dienstverbandVan(p)
  const bepaald = p.contractduur === 'bepaalde'
  return {
    voorletters: naam.voorletters,
    tussenvoegsel: naam.tussenvoegsel,
    achternaam: naam.achternaam,
    geboorte_datum: datumNL(p.geboortedatum),
    geslacht: geslachtVan(p),
    dga: DGA,
    email: p.email ?? '',
    telefoon: p.telefoonnummer ?? '',
    werknemernummer: werknemernummer(p),
    straat: adres.straat,
    huisnummer: adres.huisnummer,
    toevoeging: adres.toevoeging,
    postcode: adres.postcode,
    plaats: adres.plaats,
    land: LAND,
    Begindatum: datumNL(p.ingangsdatum),
    Contract: bepaald ? 'BEP' : p.contractduur === 'onbepaalde' ? 'ONB' : '',
    DienstverbandSoort: dv?.soort ?? '',
    // Alleen een contract voor bepaalde tijd heeft een einddatum.
    Einddatum: bepaald ? datumNL(p.einddatum) : '',
    Afdeling: '',
    Functieomschrijving: p.functie ?? '',
    Werkzaamheden: WERKZAAMHEDEN,
    Dienstverband: dv?.dienstverband ?? '',
    ParttimePercentage: dv ? String(dv.percentage) : '',
    Contracturen: dv ? String(dv.uren) : '',
  }
}

/* ------------------------------------------------------------ nakijken --- */

export type Gebrek = { naam: string; id: string; missers: string[] }

/** Liever een lijstje met wat er mist dan een bestand waar het loonbureau of
 *  de verzekeraar op vastloopt. */
export function keurRij(p: ExportPersoon): string[] {
  const r = rijVan(p)
  const missers: string[] = []
  const eis = (veld: string, label: string) => {
    if (!r[veld]) missers.push(label)
  }
  eis('voorletters', 'voorletters')
  eis('achternaam', 'achternaam')
  eis('geboorte_datum', 'geboortedatum')
  eis('geslacht', 'geslacht (staat in het invulformulier)')
  eis('straat', 'straat')
  eis('huisnummer', 'huisnummer')
  eis('postcode', 'postcode')
  eis('plaats', 'woonplaats')
  eis('Begindatum', 'ingangsdatum')
  eis('Contract', 'bepaalde of onbepaalde tijd')

  if (r.postcode && !/^\d{4}[A-Z]{2}$/.test(r.postcode)) missers.push('postcode klopt niet')
  if (r.Contract === 'BEP' && !r.Einddatum) missers.push('einddatum')

  const dv = dienstverbandVan(p)
  if (!dv) missers.push('contracturen per week')
  else {
    if (dv.percentage < 1 || dv.percentage > 100) missers.push('parttimepercentage buiten 1–100')
    if (dv.uren < 1 || dv.uren > 60) missers.push('contracturen buiten 1–60')
  }
  return missers
}

/* --------------------------------------------------------------- bestand --- */

/** Wie hoort erin: medewerkers met een lopend of toekomstig dienstverband.
 *  Iemand die nog niet naar het loonbureau is heeft nog geen contract en telt
 *  dus niet mee. */
export function teExporteren(personen: ExportPersoon[], vandaag = new Date()): ExportPersoon[] {
  const grens = vandaag.toISOString().slice(0, 10)
  return personen.filter(
    (p) =>
      p.fase === 'medewerker' &&
      !p.uit_dienst_op &&
      p.loonbureau_verstuurd_op &&
      (!p.einddatum || p.einddatum >= grens),
  )
}

/** Puntkomma's en aanhalingstekens komen in namen niet voor, maar een export
 *  die daarop stukloopt is een export die je niet vertrouwt. */
function veld(waarde: string): string {
  if (/[;"\n\r]/.test(waarde)) return `"${waarde.replace(/"/g, '""')}"`
  return waarde
}

export function bouwCsv(personen: ExportPersoon[]): string {
  const regels = [
    'SEP=;',
    KOLOMMEN.join(';'),
    ...personen.map((p) => {
      const r = rijVan(p)
      return KOLOMMEN.map((k) => veld(r[k] ?? '')).join(';')
    }),
  ]
  return `${regels.join('\n')}\n`
}

export function bestandsnaam(vandaag = new Date()): string {
  const d = vandaag.toISOString().slice(0, 10).replace(/-/g, '')
  return `werknemers-Arbeidsovereenkomst-${d}.csv`
}

/** Het bestand moet met een BOM beginnen, anders leest Excel de accenten fout. */
export function csvBestand(personen: ExportPersoon[]): Blob {
  return new Blob(['﻿', bouwCsv(personen)], { type: 'text/csv;charset=utf-8' })
}

/* ---------------------------------------------------------------- ophalen --- */

/* Per veld opgehaald in plaats van het hele invulformulier: zo komen BSN en
   rekeningnummer niet in de browser terecht voor een export die ze niet nodig
   heeft. */
const EXPORT_VELDEN = [
  'id', 'voornaam', 'achternaam', 'voorletters', 'tussenvoegsel', 'geboortedatum',
  'email', 'telefoonnummer', 'contracttype', 'contractduur', 'contracturen',
  'functie', 'ingangsdatum', 'einddatum', 'fase', 'uit_dienst_op',
  'loonbureau_verstuurd_op',
  'geslacht:onboarding_data->>geslacht',
  'straat:onboarding_data->>straat',
  'huisnummer:onboarding_data->>huisnummer',
  'toevoeging:onboarding_data->>toevoeging',
  'postcode:onboarding_data->>postcode',
  'woonplaats:onboarding_data->>woonplaats',
].join(',')

export async function haalExportGegevens(): Promise<ExportPersoon[]> {
  const { data, error } = await supabase
    .from('sollicitaties')
    .select(EXPORT_VELDEN)
    .eq('is_apparaat', false)
    .eq('fase', 'medewerker')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ExportPersoon[]
}

export function naamVanExport(p: ExportPersoon): string {
  return [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Naamloos'
}
