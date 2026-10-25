/* De brief bij een contractvoorstel.
 *
 * Tot 25 oktober 2026 las een medewerker vier regels samenvatting. Genoeg om te
 * zien wát er wordt aangeboden, niet genoeg om er ja of nee op te zeggen —
 * zeker niet bij een aanbod vaste uren, waarvan de gevolgen pas blijken als het
 * rustig is in de zaak.
 *
 * Wat hier staat is de tekst zoals die is goedgekeurd op 25 oktober 2026; zie
 * docs/Modules/personeel/brieven.md voor de overwegingen per blok.
 *
 * De brief is opgebouwd uit blokken en niet uit html. Dezelfde brief gaat naar
 * drie plekken — het scherm van de medewerker, de mail en de geprinte versie —
 * en elk van die drie zet hem anders neer. Eén bron, drie weergaven; andersom
 * zou de tekst op drie plekken onderhouden moeten worden en binnen een jaar uit
 * elkaar lopen.
 *
 * De samenvatting van vier regels bestaat nog: die staat in de lijst bij Sander,
 * waar je wilt kunnen zien wat er is aangeboden zonder een brief te lezen.
 */

import { supabase } from './supabase'
import { uur, type Contract } from './contracten'
import { metVasteUren, metVerlenging, type Voorstel } from './contractvoorstellen'

export type Blok =
  | { soort: 'alinea'; tekst: string }
  | { soort: 'kop'; tekst: string }
  | { soort: 'lijst'; regels: string[] }
  /** Iets waar je overheen zou lezen terwijl het de kern is. */
  | { soort: 'kader'; tekst: string }

export type Brief = {
  aanhef: string
  blokken: Blok[]
  afsluiting: string[]
}

const getal = (w: number | string | null | undefined): number | null =>
  w === null || w === undefined || w === '' ? null : Number.isFinite(Number(w)) ? Number(w) : null

const datum = (d: string | null | undefined): string =>
  d
    ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

const euro = (n: number): string => `€ ${n.toFixed(2).replace('.', ',')}`

/** De urenafspraak in één zin, zoals hij in de brief staat. */
export function urenzin(v: Partial<Voorstel>): string {
  const vast = getal(v.uren_vast)
  const min = getal(v.uren_min)
  const max = getal(v.uren_max)
  if (v.soort === 'vaste_uren') {
    return vast === null ? 'Vaste uren per week.' : `${uur(vast)} vaste uren per week.`
  }
  if (v.soort === 'min_max' || v.soort === 'bandbreedte') {
    if (min === null && max === null) return 'De uren spreken we nog af.'
    return `Tussen ${min === null ? '?' : uur(min)} en ${max === null ? '?' : uur(max)} uur per week.`
  }
  return 'Geen vaste uren: je werkt op afroep.'
}

/* Hoe je antwoordt. Staat in elke brief waarin iets te kiezen valt, en is
   bewust hetzelfde: wie er twee krijgt hoeft niet twee keer uit te zoeken waar
   hij moet zijn. */
function hoeJeAntwoordt(uiterlijk: string | null | undefined, twee: boolean): Blok[] {
  return [
    { soort: 'kop', tekst: 'Hoe je antwoordt' },
    {
      soort: 'alinea',
      tekst:
        (uiterlijk ? `Laat het vóór ${datum(uiterlijk)} weten. ` : 'Laat het me weten. ') +
        'Dat doe je in de app, onder Mijn dossier: eerst zeg je dat je dit gelezen hebt, daarna kies je.' +
        (twee ? ' Je beantwoordt de twee vragen apart.' : ''),
    },
  ]
}

/* `metUren` staat op false als er in dezelfde brief ook vaste uren worden
   aangeboden. De uren zijn dan de tweede vraag en horen niet in het rijtje van
   de verlenging: daar zouden ze lezen als onderdeel van de verlenging, terwijl
   hij ze juist apart mag weigeren. */
function verlengblok(v: Partial<Voorstel>, huidig: Contract | null, metUren = true): Blok[] {
  const blokken: Blok[] = [
    {
      soort: 'alinea',
      tekst: huidig?.eindigt
        ? `Je contract loopt af op ${datum(huidig.eindigt)}. Ik wil graag met je door.`
        : 'Ik wil graag met je door.',
    },
    { soort: 'kop', tekst: 'Wat ik je aanbied' },
  ]

  const regels: string[] = [
    v.duur === 'onbepaalde'
      ? `Een contract voor onbepaalde tijd, vanaf ${datum(v.begint)}. Dat betekent dat er geen einddatum meer is.`
      : `Een contract van ${datum(v.begint)} tot en met ${datum(v.eindigt)}.`,
    ...(metUren ? [urenzin(v)] : []),
  ]
  const loon = getal(v.uurloon)
  if (loon !== null) regels.push(`${euro(loon)} bruto per uur.`)
  if (v.functie) regels.push(`Functie: ${v.functie}.`)
  blokken.push({ soort: 'lijst', regels })

  return blokken
}

function vasteUrenblok(v: Partial<Voorstel>): Blok[] {
  const n = getal(v.uren_vast)
  const loon = getal(v.uurloon)

  /* Of het gemiddelde een heel jaar beslaat komt uit de bron, niet uit de
     woorden in de omschrijving — die mag Sander zelf typen. */
  const deels = v.gemiddelde_bron === 'deels_berekend'
  const basis = v.gemiddelde_over
    ? `Dat is het gemiddelde dat je ${v.gemiddelde_over} hebt gewerkt` +
      (deels ? ' (dat is nog geen heel jaar; ik heb gerekend met de uren die ik heb).' : '.')
    : null

  return [
    {
      soort: 'alinea',
      tekst:
        'Je werkt nu langer dan een jaar als oproepkracht. Volgens de wet moet ik je dan vaste uren aanbieden. Dat doe ik hierbij.',
    },
    { soort: 'kop', tekst: 'Mijn aanbod' },
    {
      soort: 'lijst',
      regels: [
        n === null
          ? `Vaste uren per week, vanaf ${datum(v.begint)}.`
          : `${uur(n)} vaste uren per week, vanaf ${datum(v.begint)}.`,
        ...(basis ? [basis] : []),
        ...(loon !== null ? [`Je uurloon verandert niet: ${euro(loon)} bruto per uur.`] : []),
      ],
    },
    { soort: 'kop', tekst: 'Wat vaste uren betekenen' },
    { soort: 'alinea', tekst: 'Het werkt twee kanten op.' },
    {
      soort: 'lijst',
      regels: [
        'Ik rooster die uren in en betaal ze, ook als het rustig is. Je weet dus van tevoren wat je verdient.',
        'Jij werkt die uren ook, ook als je die week liever iets anders had gedaan.',
        'Meer werken mag altijd, in overleg.',
        'Minder werken gaat niet zomaar; dat spreken we dan samen af.',
      ],
    },
    { soort: 'kop', tekst: 'Je mag nee zeggen' },
    {
      soort: 'alinea',
      tekst:
        'Dit is een aanbod, geen verplichting. Zeg je nee, dan blijf je oproepkracht precies zoals nu en verandert er niets. Over twaalf maanden krijg je dan opnieuw een aanbod. Nee zeggen heeft geen gevolgen voor je werk hier.',
    },
  ]
}

/** De brief die de medewerker leest. */
export function brieftekst(opdracht: {
  voorstel: Partial<Voorstel>
  voornaam: string | null
  huidig: Contract | null
}): Brief {
  const { voorstel: v, huidig } = opdracht
  const aanhef = `Hoi ${(opdracht.voornaam ?? '').trim() || 'daar'},`
  const afsluiting = ['Groet,', 'Sander']
  const toelichting: Blok[] = v.toelichting
    ? [{ soort: 'alinea', tekst: v.toelichting.trim() }]
    : []

  if (v.aard === 'stoppen') {
    return {
      aanhef,
      blokken: [
        {
          soort: 'alinea',
          tekst:
            'Ik moet je volgens de wet op tijd laten weten of je contract doorgaat. Bij deze: je contract wordt niet verlengd.',
        },
        {
          soort: 'alinea',
          tekst: huidig?.eindigt
            ? `Je contract loopt af op ${datum(huidig.eindigt)}. Dat is je laatste werkdag. Je hoeft zelf niets op te zeggen.`
            : 'Je hoeft zelf niets op te zeggen.',
        },
        ...toelichting,
        { soort: 'kop', tekst: 'Wat er daarna gebeurt' },
        {
          soort: 'alinea',
          tekst:
            'Het loonbureau maakt je eindafrekening. Vakantiedagen die je nog over hebt worden daarbij uitbetaald. Je laatste loonstrook en je jaaropgave krijg je zoals je ze altijd krijgt.',
        },
        { soort: 'kop', tekst: 'Even bevestigen' },
        {
          soort: 'alinea',
          tekst:
            'Wil je in de app, onder Mijn dossier, aangeven dat je dit gelezen hebt? Dan weet ik zeker dat het is aangekomen. Dat is het enige wat ik van je vraag.',
        },
      ],
      afsluiting,
    }
  }

  const verlengt = metVerlenging(v.aard ?? 'verlengen')
  const uren = metVasteUren(v.aard ?? 'verlengen')
  const blokken: Blok[] = []

  if (verlengt) blokken.push(...verlengblok(v, huidig, !uren))

  /* Twee vragen in één brief, en dat moet eraf te lezen zijn: hij mag de
     verlenging aannemen en de uren weigeren. */
  if (verlengt && uren) {
    blokken.push({
      soort: 'kader',
      tekst:
        'Let op: dit zijn twee aparte vragen. Je kunt de verlenging aannemen en de vaste uren weigeren. Dan verleng je als oproepkracht, zoals nu. Je kunt ze ook allebei aannemen, of allebei weigeren.',
    })
  }

  if (uren) blokken.push(...vasteUrenblok(v))

  blokken.push(...toelichting)
  blokken.push(...hoeJeAntwoordt(v.uiterlijk, verlengt && uren))

  if (verlengt && !uren && huidig?.eindigt) {
    blokken.push({
      soort: 'alinea',
      tekst: `Zeg je nee, dan loopt je contract gewoon af op ${datum(huidig.eindigt)}. Daar is niets mis mee — laat het me dan wel op tijd weten, dan houd ik er rekening mee bij het rooster.`,
    })
  }

  blokken.push({
    soort: 'alinea',
    tekst: uren
      ? 'Twijfel je? Loop even binnen, dan reken ik het met je door.'
      : 'Vragen? Loop even binnen of stuur me een berichtje.',
  })

  return { aanhef, blokken, afsluiting }
}

/* De brief als platte tekst. Dit is wat er wordt bewaard als bewijsstuk: wat er
   die dag is aangeboden, leesbaar, zonder opmaak die over een jaar anders
   uitpakt. */
export function alsTekst(brief: Brief): string {
  const regels: string[] = [brief.aanhef, '']
  for (const b of brief.blokken) {
    if (b.soort === 'lijst') {
      regels.push(...b.regels.map((r) => `- ${r}`), '')
    } else if (b.soort === 'kop') {
      regels.push(`${b.tekst}`, '')
    } else {
      regels.push(b.tekst, '')
    }
  }
  regels.push(...brief.afsluiting)
  return regels.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/* ------------------------------------------------------------- op papier --- */

function ontsnap(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function blokAlsHtml(b: Blok): string {
  if (b.soort === 'kop') return `<p class="kop">${ontsnap(b.tekst)}</p>`
  if (b.soort === 'lijst') {
    return `<ul>${b.regels.map((r) => `<li>${ontsnap(r)}</li>`).join('')}</ul>`
  }
  if (b.soort === 'kader') return `<div class="kader">${ontsnap(b.tekst)}</div>`
  return `<p>${ontsnap(b.tekst)}</p>`
}

/* De antwoordstrook. Alleen de vragen die er zijn: een hokje voor een
   verlenging die niet wordt aangeboden zou iemand laten tekenen voor iets wat
   niet bestaat. */
function strook(v: Partial<Voorstel>, ouder: boolean): string {
  const aard = v.aard ?? 'verlengen'
  const vragen: string[] = []
  if (metVerlenging(aard)) {
    vragen.push(
      `<p class="vraag">De verlenging: <span class="hok"></span> ik ga akkoord &nbsp;&nbsp; <span class="hok"></span> ik ga niet akkoord</p>`,
    )
  }
  if (metVasteUren(aard)) {
    vragen.push(
      `<p class="vraag">De vaste uren: <span class="hok"></span> ik neem ze aan &nbsp;&nbsp; <span class="hok"></span> ik weiger ze, ik blijf oproepkracht</p>`,
    )
  }
  if (aard === 'stoppen') {
    vragen.push(`<p class="vraag"><span class="hok"></span> ik heb dit gelezen</p>`)
  }

  return `<div class="strook">
    <p class="strookkop">Antwoordstrook</p>
    <p class="lijn">Naam: <span class="in lang"></span> Datum: <span class="in"></span></p>
    ${vragen.join('')}
    <p class="lijn">Opmerking: <span class="in heel"></span></p>
    <p class="lijn">Handtekening: <span class="in lang"></span></p>
    ${
      ouder
        ? `<p class="lijn">Ouder of verzorger — naam: <span class="in"></span> handtekening: <span class="in"></span></p>`
        : ''
    }
    <p class="terug">Graag ingevuld teruggeven aan Sander.</p>
  </div>`
}

/** De brief om uit te printen, met een strook om in te vullen en terug te geven. */
export function bouwPrintbrief(opdracht: {
  brief: Brief
  voorstel: Partial<Voorstel>
  naam: string
  ouder: boolean
}): string {
  const { brief, voorstel, naam, ouder } = opdracht
  const vandaag = new Date().toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Brief ${ontsnap(naam)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1e; font-size: 11pt; line-height: 1.55; margin: 0; }
  .kop { }
  .briefhoofd { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .bedrijf { color: #003a41; font-size: 15pt; font-weight: 700; line-height: 1.2; }
  .bedrijf-sub { color: #6b7280; font-size: 7.5pt; margin-top: 4px; }
  .datum { color: #6b7280; font-size: 8.5pt; text-align: right; }
  .streep { height: 3px; background: #003a41; margin: 12px 0 22px; }
  p { margin: 0 0 11px; }
  p.kop { font-weight: 700; margin: 18px 0 6px; }
  ul { margin: 0 0 11px; padding-left: 20px; }
  li { margin: 0 0 4px; }
  .kader { border-left: 3px solid #003a41; background: #f1efe6; padding: 10px 14px; margin: 16px 0; }
  .strook { border-top: 2px dashed #9ca3af; margin-top: 30px; padding-top: 14px; page-break-inside: avoid; }
  .strookkop { font-weight: 700; font-size: 10pt; letter-spacing: 0.08em; text-transform: uppercase; color: #5c5342; }
  .vraag { margin: 0 0 10px; }
  .hok { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #1c1c1e; vertical-align: -2px; margin-right: 4px; }
  .lijn { margin: 0 0 14px; }
  .in { display: inline-block; border-bottom: 1px solid #1c1c1e; width: 140px; }
  .in.lang { width: 240px; }
  .in.heel { width: 100%; }
  .terug { color: #6b7280; font-size: 9pt; margin-top: 10px; }
</style></head>
<body>
  <div class="briefhoofd">
    <div>
      <div class="bedrijf">Boskma Foodservice V.O.F.</div>
      <div class="bedrijf-sub">Snackerie 't Zonnetje &nbsp;·&nbsp; Dorpsstraat 82, 1693 AH Wervershoof</div>
    </div>
    <div class="datum">Wervershoof, ${vandaag}</div>
  </div>
  <div class="streep"></div>

  <p>${ontsnap(brief.aanhef)}</p>
  ${brief.blokken.map(blokAlsHtml).join('')}
  <p>${brief.afsluiting.map(ontsnap).join('<br>')}</p>

  ${strook(voorstel, ouder)}
</body></html>`
}

/* De brief als pdf ophalen en in de browser laten opslaan.
 *
 * De serverfunctie bewaart hem niet: wat bewaard moet blijven is de brief zoals
 * verstuurd, en die staat al bij het voorstel. Een los pdf'je ernaast zou een
 * tweede waarheid zijn. */
export async function printbriefOphalen(opdracht: {
  html: string
  bestandsnaam: string
}): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('brief-pdf', {
    body: opdracht,
  })
  if (error) throw new Error(error.message)
  if (data instanceof Blob) {
    // De functie geeft bij een fout json terug in plaats van een pdf.
    if (data.type.includes('json')) {
      const tekst = await data.text()
      throw new Error(JSON.parse(tekst)?.error ?? 'De pdf kon niet gemaakt worden.')
    }
    return data
  }
  throw new Error((data as { error?: string })?.error ?? 'De pdf kon niet gemaakt worden.')
}

/** Een blob aanbieden als download. */
export function bewaarAls(blob: Blob, bestandsnaam: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = bestandsnaam
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Opruimen; zonder dit blijft de blob in het geheugen staan.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
