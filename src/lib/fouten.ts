/* Technische foutmeldingen omzetten naar iets waar je wat aan hebt.

   De database en de inlogdienst praten Engels en in hun eigen termen. Dat zegt
   niets over wat je eraan kunt doen; deze vertalingen wel. */

type Vertaling = { herken: RegExp; tekst: string; uitloggen?: boolean }

const VERTALINGEN: Vertaling[] = [
  {
    /* De database weigert een inlogbewijs dat volgens háár klok nog moet
       ingaan. Dat ligt aan de server, niet aan het apparaat van de gebruiker —
       uitloggen helpt dan juist niet, wachten wel. */
    herken: /issued at future|iat.*future/i,
    tekst:
      'De server loopt even achter op zichzelf en accepteert je inlog daardoor nog niet. Wacht een halve minuut en laad de pagina opnieuw. Blijft het staan, zeg het dan tegen Sander.',
  },
  {
    herken: /jwt expired|token is expired|invalid refresh token|refresh_token_not_found/i,
    tekst: 'Je bent uitgelogd geraakt. Log opnieuw in.',
    uitloggen: true,
  },
  {
    herken: /jwt|invalid claim|bad_jwt/i,
    tekst: 'Er is iets mis met je inlog. Log opnieuw in.',
    uitloggen: true,
  },
  {
    herken: /permission denied|row-level security|42501/i,
    tekst: 'Je mag dit niet inzien. Klopt dat niet, vraag Sander om je rechten na te kijken.',
  },
  {
    herken: /failed to fetch|networkerror|load failed/i,
    tekst: 'Geen verbinding met de server. Controleer je internet en probeer het opnieuw.',
  },
  {
    herken: /could not find the function|schema cache|PGRST202/i,
    tekst:
      'De app vraagt iets wat de server nog niet kent. Meestal helpt opnieuw laden; blijft het staan, zeg het dan tegen Sander.',
  },
]

export function leesbareFout(bericht: string): { tekst: string; uitloggen: boolean; ruw: string } {
  const gevonden = VERTALINGEN.find((v) => v.herken.test(bericht))
  return {
    tekst: gevonden?.tekst ?? bericht,
    uitloggen: gevonden?.uitloggen ?? false,
    ruw: bericht,
  }
}

/** Een sessie die niet meer klopt. Daar helpt opnieuw proberen niet tegen: het
 *  token is kapot, en verversen lukt daar juist niet mee. */
export function isSessiefout(bericht: string) {
  return VERTALINGEN.some((v) => v.uitloggen && v.herken.test(bericht))
}

/* Een inlogbewijs dat volgens de database "nog moet ingaan" wordt na een paar
   seconden vanzelf geldig. Daarom bij deze ene fout blijven proberen in plaats
   van meteen een rood scherm tonen. */
export function isTijdelijkeKlokfout(bericht: string) {
  return /issued at future|iat.*future/i.test(bericht)
}
