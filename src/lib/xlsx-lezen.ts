/* Een xlsx-bestand uitpakken tot tabellen met tekst.
 *
 * Waarom zelfgeschreven en geen bibliotheek: een xlsx is een zip met wat XML,
 * en de browser kan allebei al. De bekende leesbibliotheek is vier megabyte,
 * publiceert de veilige versies niet meer op npm, en kan duizend dingen die we
 * niet doen. Wat we wél nodig hebben is honderd regels.
 *
 * Alles komt eruit als tekst, precies zoals het in het bestand staat. De
 * exports van eitje bevatten geen getallen of echte datums — "08:00" en
 * "08/09/2026" zijn daar tekst — dus rekenen met celwaardes hoort in
 * lib/eitje.ts, niet hier.
 */

/* ------------------------------------------------------------------- zip --- */

type Bestand = { naam: string; begin: number; lengte: number; methode: number }

const HANDTEKENING_EINDE = 0x06054b50
const HANDTEKENING_MAP = 0x02014b50

/** De inhoudsopgave staat achteraan in een zip, dus die zoeken we van achter
 *  naar voren. Het staartstuk mag een comment bevatten van maximaal 64 kB. */
function leesInhoudsopgave(kijk: DataView): Bestand[] {
  const eind = kijk.byteLength
  let staart = -1
  for (let i = eind - 22; i >= Math.max(0, eind - 65_557); i--) {
    if (kijk.getUint32(i, true) === HANDTEKENING_EINDE) {
      staart = i
      break
    }
  }
  if (staart < 0) throw new Error('Dit is geen geldig Excel-bestand (geen zip).')

  const aantal = kijk.getUint16(staart + 10, true)
  let plek = kijk.getUint32(staart + 16, true)
  const bestanden: Bestand[] = []

  for (let n = 0; n < aantal; n++) {
    if (kijk.getUint32(plek, true) !== HANDTEKENING_MAP) break
    const methode = kijk.getUint16(plek + 10, true)
    const lengte = kijk.getUint32(plek + 20, true)
    const naamLengte = kijk.getUint16(plek + 28, true)
    const extraLengte = kijk.getUint16(plek + 30, true)
    const commentLengte = kijk.getUint16(plek + 32, true)
    const kopPlek = kijk.getUint32(plek + 42, true)

    const naam = new TextDecoder().decode(
      new Uint8Array(kijk.buffer, kijk.byteOffset + plek + 46, naamLengte),
    )

    // De lokale kop herhaalt naam en extra-veld, en pas daarachter staan de
    // bytes. De lengtes daarvan verschillen van die in de inhoudsopgave, dus ze
    // moeten hier opnieuw gelezen worden.
    const lokaalNaam = kijk.getUint16(kopPlek + 26, true)
    const lokaalExtra = kijk.getUint16(kopPlek + 28, true)
    bestanden.push({ naam, begin: kopPlek + 30 + lokaalNaam + lokaalExtra, lengte, methode })

    plek += 46 + naamLengte + extraLengte + commentLengte
  }
  return bestanden
}

async function pakUit(bytes: Uint8Array, methode: number): Promise<string> {
  if (methode === 0) return new TextDecoder().decode(bytes)
  if (methode !== 8) throw new Error(`Onbekende compressie in het bestand (${methode}).`)

  const stroom = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stroom).text()
}

/* ------------------------------------------------------------------- xml --- */

const ENTITEITEN: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function ontcijfer(tekst: string): string {
  return tekst.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (heel, naam: string) => {
    if (naam.startsWith('#x') || naam.startsWith('#X'))
      return String.fromCodePoint(parseInt(naam.slice(2), 16))
    if (naam.startsWith('#')) return String.fromCodePoint(parseInt(naam.slice(1), 10))
    return ENTITEITEN[naam] ?? heel
  })
}

/** Alle <t>-stukjes achter elkaar. Opgemaakte tekst valt in een cel uiteen in
 *  meerdere stukjes; los gelezen zou "'t Zonnetje" dan drie cellen worden. */
function tekstUit(xml: string): string {
  let uit = ''
  for (const deel of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) uit += ontcijfer(deel[1])
  return uit
}

function kolomNummer(verwijzing: string): number {
  const letters = verwijzing.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const letter of letters) n = n * 26 + (letter.charCodeAt(0) - 64)
  return n - 1
}

function leesBlad(xml: string, gedeeldeTeksten: string[]): string[][] {
  const rijen: string[][] = []

  for (const rij of xml.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cellen: string[] = []
    for (const cel of (rij[1] ?? '').matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const kenmerken = cel[1] ?? ''
      const inhoud = cel[2] ?? ''
      const plek = kolomNummer(kenmerken.match(/r="([A-Z]+)\d+"/)?.[1] ?? 'A')
      const soort = kenmerken.match(/t="([^"]+)"/)?.[1]

      let waarde = ''
      if (soort === 's') {
        const nummer = Number(inhoud.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
        waarde = gedeeldeTeksten[nummer] ?? ''
      } else if (soort === 'inlineStr') {
        waarde = tekstUit(inhoud)
      } else {
        waarde = ontcijfer(inhoud.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
      }

      // Lege cellen tussendoor overslaan zou alles naar links schuiven.
      while (cellen.length < plek) cellen.push('')
      cellen[plek] = waarde
    }
    rijen.push(cellen)
  }
  return rijen
}

/* ------------------------------------------------------------------ lezen --- */

export type Werkboek = Map<string, string[][]>

/** De tabbladen van een xlsx, op naam, elk als rijen met tekst. */
export async function leesWerkboek(inhoud: ArrayBuffer): Promise<Werkboek> {
  const kijk = new DataView(inhoud)
  const bytes = new Uint8Array(inhoud)
  const bestanden = leesInhoudsopgave(kijk)

  const haal = async (naam: string): Promise<string | null> => {
    const b = bestanden.find((x) => x.naam === naam)
    if (!b) return null
    return pakUit(bytes.subarray(b.begin, b.begin + b.lengte), b.methode)
  }

  const werkboek = await haal('xl/workbook.xml')
  if (!werkboek) throw new Error('Dit Excel-bestand mist zijn werkboek.')

  const gedeeld = await haal('xl/sharedStrings.xml')
  const gedeeldeTeksten = gedeeld
    ? [...gedeeld.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => tekstUit(m[1]))
    : []

  // Het werkboek noemt de tabbladen bij naam met een verwijzing (rId1); welk
  // bestand daarbij hoort staat in een apart koppelbestand.
  const koppelingen = (await haal('xl/_rels/workbook.xml.rels')) ?? ''
  const pad = new Map<string, string>()
  for (const r of koppelingen.matchAll(/Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) {
    pad.set(r[1], r[2].replace(/^\/?xl\//, '').replace(/^\.\//, ''))
  }

  const uit: Werkboek = new Map()
  for (const blad of werkboek.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const naam = ontcijfer(blad[1].match(/name="([^"]*)"/)?.[1] ?? '')
    const verwijzing = blad[1].match(/r:id="([^"]+)"/)?.[1]
    const doel = verwijzing ? pad.get(verwijzing) : undefined
    const xml = doel ? await haal(`xl/${doel}`) : null
    if (xml) uit.set(naam, leesBlad(xml, gedeeldeTeksten))
  }

  if (uit.size === 0) throw new Error('Dit Excel-bestand heeft geen leesbare tabbladen.')
  return uit
}
