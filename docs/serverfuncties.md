# De serverfuncties

Er draaien vierentwintig functies op Supabase. Sinds 24 oktober 2026 staat de
broncode van alle vierentwintig in deze map (`supabase/functions`). Daarvoor
stond die van dertien ervan alleen nog in de oude map `boskma-app` — de map die
op de nominatie staat om opgeruimd te worden.

## Wat er toen aan het licht kwam

Van vier functies was de versie die draaide **ouder** dan de versie in de oude
map: `daily-digest`, `stuur-contract`, `teken-contract` en
`stuur-medewerker-verzoek`. Ze missen de sleutelreparatie die wel in de code
stond maar nooit is uitgerold (`SERVICE_ROLE_JWT ?? SUPABASE_SERVICE_ROLE_KEY`,
commit 5ec7880). In deze map staat de nieuwere versie; die is nog niet
uitgerold, omdat geen van de vier ergens wordt aangeroepen.

## Wie roept wat aan

Uit de database (`net.http_post`): `kim-push`, `ruim-id-kopieen-op`,
`weer-verzamelen`.

Uit de app: `stuur-inloglink`, `stuur-loonbureau`, `stuur-verkoopfactuur`,
`verkoopfactuur-pdf`, `send-push`, `send-onboarding`, `submit-onboarding`,
`weer-verzamelen`, `rooster-inlezen` (via het script in Gmail).

Nergens meer aangeroepen, voor zover te vinden in beide mappen en de database:
`daily-digest`, `daily-reminders`, `stuur-contract`, `teken-contract`,
`stuur-medewerker-verzoek`, `stuur-melding`, `stuur-kennismaking`,
`generate-contract-pdf`, `vb-proxy`, `f1-nieuws`, `f1-live`.

Weggooien is pas veilig als zeker is dat er niets buiten deze twee mappen naar
wijst. Twee dingen om op te letten:

- `medewerker-gegevens` wordt aangeroepen door `medewerker-gegevens.html`, een
  losse pagina die de **oude app** serveert. `stuur-medewerker-verzoek` mailt
  de link ernaartoe. Gaat de oude app weg, dan valt dat formulier om. In
  boskma-2.0 zit inmiddels Mijn gegevens, dat hetzelfde doet voor wie inlogt.
- `generate-contract-pdf`, `stuur-contract` en `teken-contract` horen bij de
  contractgenerator die bewust is uitgezet.

## verify_jwt

`supabase functions deploy` zet `verify_jwt` áán tenzij het in
`supabase/config.toml` anders staat. Daar ging het op 23 oktober 2026 mis bij
`kim-push`: die werd dicht gezet voor de database, die hem zonder sleutel
aanroept. De meldingen vallen dan stil zonder dat iets klaagt.

Sindsdien staat het per functie in `config.toml`. Zet daar een nieuwe functie
in zodra die zijn eigen deur bewaakt, en rol hem anders gewoon uit.

**`verify_jwt = true` is geen slot.** Supabase controleert alleen dát er een
geldige sleutel meekomt, en de publieke sleutel staat in elke browser die de
app opent.

## Wie belt er aan

Een functie die namens Sander iets verstuurt, een nummer uitdeelt of een
invullink aanmaakt, vraagt zelf wie er aanbelt. Dat gebeurt met `wieBelt` uit
`_shared/beller.ts`, dat het aan de database vraagt (`is_app_user`) zodat
nergens een mailadres hardgecodeerd staat.

Dat doen op 24 oktober 2026: `send-onboarding`, `stuur-loonbureau`,
`verkoopfactuur-pdf` en `stuur-verkoopfactuur`.

`send-onboarding` was de ergste. Die stond met `verify_jwt = false` en zonder
enige eigen controle open, en geeft in zijn antwoord het token terug waarmee je
het invulformulier van een sollicitant opent — BSN en rekeningnummer. Je had er
alleen een sollicitatienummer voor nodig. Dat is een UUID en dus niet te raden,
maar wie er een te pakken kreeg kon ermee bij die gegevens.

`verkoopfactuur-pdf` accepteert ook de serversleutel, want
`stuur-verkoopfactuur` roept hem onderweg aan. Wie die sleutel heeft kan toch
al alles; het is geen extra recht, alleen een andere weg naar binnen.

### Waar het met opzet níet staat

`stuur-inloglink` vraag je juist aan wanneer je nog niet bent ingelogd. Eisen
dat de beller een beheerder is zou inloggen onmogelijk maken. Wat hem beschermt
is dat zijn antwoord niets verraadt: of het adres bestaat of niet, je krijgt
hetzelfde te horen.

`medewerker-gegevens` en `submit-onboarding` worden ingevuld door iemand die
niet inlogt. De niet te raden code in de link ís daar de sleutel.

`rooster-inlezen` heeft zijn eigen sleutel (`ROOSTER_SLEUTEL`), meegestuurd
door het script in Sanders Gmail.

`kim-push` zoekt de rij zelf op, gebruikt uit het verzoek alleen tabel en
nummer, en doet per rij hooguit één keer iets.
