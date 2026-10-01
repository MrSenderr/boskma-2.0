/* Het rooster van één dag als tijdlijn.

   De vraag die dit beantwoordt is "wie staat er als we opengaan". Daarom loopt
   er een lijn door de openingstijd heen en staan de mensen op volgorde van hun
   begintijd: wie bovenaan staat opent mee.

   Alleen rekenwerk, geen scherm — zo is het te toetsen. */

import { naamUit, type Shift } from './rooster'

/** "12:00" wordt 720. Onleesbare of ontbrekende tijden geven null. */
export function naarMinuten(tijd: string | null | undefined): number | null {
  const m = (tijd ?? '').match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const uren = Number(m[1])
  const minuten = Number(m[2])
  if (uren > 23 || minuten > 59) return null
  return uren * 60 + minuten
}

export function naarTijd(minuten: number): string {
  return `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`
}

export type Venster = { van: number; tot: number }

/** Het tijdvak dat de tijdlijn laat zien, afgerond op hele uren.
 *
 *  Een dienst mag nooit buiten beeld vallen, dus de vroegste begintijd en de
 *  laatste eindtijd tellen altijd mee — ook als iemand om half elf begint om
 *  voor te bereiden. De openingstijd hoort er ook in, anders staat de lijn
 *  waar je naar kijkt buiten het plaatje. */
export function venster(diensten: Dienst[], ijkpunten: (number | null)[] = []): Venster {
  const punten: number[] = []
  for (const d of diensten) punten.push(d.begint, d.eindigt)
  for (const p of ijkpunten) if (p !== null) punten.push(p)

  if (punten.length === 0) return { van: 10 * 60, tot: 21 * 60 }

  let van = Math.floor(Math.min(...punten) / 60) * 60
  let tot = Math.ceil(Math.max(...punten) / 60) * 60

  // Een tijdlijn van één uur breed leest als een streepje. Vier uur is het
  // minimum waarbij de verhoudingen nog iets zeggen.
  const minimaal = 4 * 60
  if (tot - van < minimaal) {
    const tekort = minimaal - (tot - van)
    van = Math.max(0, van - Math.floor(tekort / 2))
    tot = Math.min(24 * 60, van + minimaal)
  }
  return { van, tot }
}

/** Waar een balk begint en hoe breed hij is, in procenten van het venster. */
export function balk(begint: number, eindigt: number, v: Venster) {
  const breedteVenster = Math.max(1, v.tot - v.van)
  const links = ((begint - v.van) / breedteVenster) * 100
  const breedte = ((eindigt - begint) / breedteVenster) * 100
  return {
    links: Math.max(0, Math.min(100, links)),
    breedte: Math.max(0.5, Math.min(100 - Math.max(0, links), breedte)),
  }
}

/** De hele uren die als streepje op de as komen. */
export function uurstreepjes(v: Venster): number[] {
  const uren: number[] = []
  for (let m = Math.ceil(v.van / 60) * 60; m <= v.tot; m += 60) uren.push(m)
  return uren
}

export type Dienst = {
  sleutel: string
  naam: string
  /** Een dienst zonder naam: ingeroosterd, nog niemand op gezet. */
  open: boolean
  begint: number
  eindigt: number
  team: string | null
  /** Staat deze persoon er als de zaak opengaat? */
  opent: boolean
}

export type Dagtijdlijn = {
  diensten: Dienst[]
  /** Diensten zonder bruikbare tijden; die kun je niet tekenen. */
  zonderTijd: { sleutel: string; naam: string; open: boolean }[]
  venster: Venster
  /** De openingstijd in minuten, als die er is. */
  opening: number | null
  sluiting: number | null
}

/** Het rooster van één dag omgerekend naar wat het scherm nodig heeft.
 *
 *  `van` en `tot` zijn de openingstijden van die dag; die komen uit de
 *  openingstijden-module, zodat de lijn meeschuift als je een keer eerder
 *  opengaat en een gesloten maandag zich vanzelf als gesloten laat zien. */
export function dagtijdlijn(
  gepland: Shift[],
  van: string | null,
  tot: string | null,
): Dagtijdlijn {
  const opening = naarMinuten(van)
  const sluiting = naarMinuten(tot)

  const diensten: Dienst[] = []
  const zonderTijd: { sleutel: string; naam: string; open: boolean }[] = []

  for (const rij of gepland) {
    const begint = naarMinuten(rij.begint)
    const eindigt = naarMinuten(rij.eindigt)
    const open = !rij.voornaam
    if (begint === null || eindigt === null || eindigt <= begint) {
      zonderTijd.push({ sleutel: rij.bron_id, naam: naamUit(rij), open })
      continue
    }
    diensten.push({
      sleutel: rij.bron_id,
      naam: naamUit(rij),
      open,
      begint,
      eindigt,
      team: rij.team,
      // Wie om of voor openingstijd begint doet de opening mee. Precies om
      // 12:00 telt mee: dan sta je er.
      opent: opening !== null && begint <= opening,
    })
  }

  // Op volgorde van begintijd: de mensen die openen staan bovenaan, en dat is
  // waar deze tijdlijn voor gemaakt is.
  diensten.sort((a, b) => a.begint - b.begint || a.eindigt - b.eindigt || a.naam.localeCompare(b.naam))

  return {
    diensten,
    zonderTijd,
    /* Altijd een uur aanloop vóór openingstijd in beeld. Dat houdt de
       openingslijn vrij van de rand, en je ziet meteen of er iemand is om
       voor te bereiden of dat het tot twaalf uur leeg blijft. */
    venster: venster(diensten, [opening === null ? null : opening - 60, opening, sluiting]),
    opening,
    sluiting,
  }
}
