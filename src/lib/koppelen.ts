/* Een naam uit de export bij een medewerker zoeken.
 *
 * Dit is het enige lastige stuk van de import. De urenexport geeft alleen een
 * voornaam; de roosterexport geeft er een achternaam bij, maar niet altijd
 * dezelfde als in het personeelsbestand — in eitje staat "Ilona Swagerman", bij
 * ons "Swagerman-Honselaar". Streng matchen laat dus de helft liggen, en ruim
 * matchen zet uren op de verkeerde persoon.
 *
 * Daarom: van streng naar ruim, en alleen aannemen als er precies één
 * medewerker overblijft. Twee mensen die Evi heten leveren geen gok op maar een
 * vraag. Wat hier niet uitkomt, wijs je één keer met de hand aan; dat wordt
 * bewaard in rooster_namen en daarna gaat het vanzelf.
 */

export type Kandidaat = {
  id: string
  voornaam: string | null
  achternaam: string | null
  uit_dienst_op: string | null
}

export type Reden =
  | 'open'
  | 'handmatig'
  | 'genegeerd'
  | 'volledige naam'
  | 'deel van de achternaam'
  | 'voornaam'
  | 'meerdere'
  | 'onbekend'

export type Koppeling = { medewerker_id: string | null; reden: Reden }

/** Wat er met een naam is afgesproken toen hij niet vanzelf te plaatsen was. */
export type Afspraak = { medewerker_id: string | null; negeren: boolean }

function normaliseer(tekst: string | null | undefined): string {
  return (tekst ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** De sleutel waaronder een naam in rooster_namen staat. */
export function naamSleutel(voornaam: string | null, achternaam?: string | null): string {
  return [normaliseer(voornaam), normaliseer(achternaam)].filter(Boolean).join(' ')
}

/** Twee achternamen die bij elkaar horen: "Swagerman" hoort bij
 *  "Swagerman-Honselaar", maar "Deen" hoort niet bij "Deenen". Daarom op
 *  naamdeel vergelijken en niet op letters. */
function zelfdeStam(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const delen = (n: string) => n.split(/[\s-]+/).filter(Boolean)
  const kort = delen(a).length <= delen(b).length ? delen(a) : delen(b)
  const lang = delen(a).length <= delen(b).length ? delen(b) : delen(a)
  return kort.every((deel) => lang.includes(deel))
}

export function koppel(
  naam: { voornaam: string | null; achternaam: string | null },
  kandidaten: Kandidaat[],
  afspraken: Map<string, Afspraak> = new Map(),
): Koppeling {
  if (!naam.voornaam) return { medewerker_id: null, reden: 'open' }

  const voornaam = normaliseer(naam.voornaam)
  const achternaam = normaliseer(naam.achternaam)

  // Een afspraak staat onder de volledige naam. De urenexport kent alleen
  // voornamen, dus daar wordt ook op de kortere sleutel gekeken: één keer
  // "Jasper is Jasper Kool" vastleggen moet voor allebei de exports gelden.
  const afspraak =
    afspraken.get(naamSleutel(naam.voornaam, naam.achternaam)) ??
    afspraken.get(naamSleutel(naam.voornaam))
  if (afspraak) {
    return afspraak.negeren || !afspraak.medewerker_id
      ? { medewerker_id: null, reden: 'genegeerd' }
      : { medewerker_id: afspraak.medewerker_id, reden: 'handmatig' }
  }

  const opVoornaam = kandidaten.filter((k) => normaliseer(k.voornaam) === voornaam)
  if (opVoornaam.length === 0) return { medewerker_id: null, reden: 'onbekend' }

  const enige = (lijst: Kandidaat[], reden: Reden): Koppeling | null =>
    lijst.length === 1 ? { medewerker_id: lijst[0].id, reden } : null

  if (achternaam) {
    const precies = opVoornaam.filter((k) => normaliseer(k.achternaam) === achternaam)
    const gevonden = enige(precies, 'volledige naam')
    if (gevonden) return gevonden

    const bijna = opVoornaam.filter((k) => zelfdeStam(normaliseer(k.achternaam), achternaam))
    const ookGevonden = enige(bijna, 'deel van de achternaam')
    if (ookGevonden) return ookGevonden

    // De voornaam komt voor, de achternaam hoort er niet bij. Dat is eerder een
    // naamgenoot dan een typefout, dus hier niet alsnog op voornaam gokken.
    if (precies.length === 0 && bijna.length === 0) {
      return { medewerker_id: null, reden: opVoornaam.length > 1 ? 'meerdere' : 'onbekend' }
    }
    return { medewerker_id: null, reden: 'meerdere' }
  }

  // Alleen een voornaam. Iemand die uit dienst is telt niet mee zolang er een
  // collega in dienst is die zo heet; in de historie kan hij het wel zijn.
  const inDienst = opVoornaam.filter((k) => !k.uit_dienst_op)
  return (
    enige(inDienst, 'voornaam') ??
    enige(opVoornaam, 'voornaam') ?? { medewerker_id: null, reden: 'meerdere' }
  )
}
