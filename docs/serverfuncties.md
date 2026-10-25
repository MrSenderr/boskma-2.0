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

Uit de database met `net.http_post`: `kim-push`, `ruim-id-kopieen-op`,
`weer-verzamelen`.

Uit de database met een **webhook-trigger** op een tabel: `dynamic-function`
(mail bij een nieuwe sollicitatie) en `send-push`, allebei op `sollicitaties`.
Let op: die staan niet in de tekst van een databasefunctie maar in de
triggerdefinitie, dus zoeken op `functions/v1/` in `pg_get_functiondef` vindt ze
niet. Zoek ook in `pg_get_triggerdef`.

Uit de app: `stuur-inloglink`, `stuur-loonbureau`, `stuur-getekend-contract`,
`stuur-voorstel`, `stuur-ondertekening`, `teken-contract`, `brief-pdf`,
`stuur-verkoopfactuur`, `verkoopfactuur-pdf`, `send-onboarding`,
`submit-onboarding`, `weer-verzamelen`, en `rooster-inlezen` via het script in
Gmail.

## Wat er op 24 oktober 2026 is weggehaald

Elf functies die nergens meer vandaan werden aangeroepen zijn verwijderd bij
Supabase en uit deze map:

`daily-digest` · `daily-reminders` · `stuur-melding` · `stuur-kennismaking` ·
`stuur-contract` · `teken-contract` · `generate-contract-pdf` ·
`stuur-medewerker-verzoek` · `vb-proxy` · `f1-nieuws` · `f1-live`

Doorzocht voordat ze weggingen: beide app-mappen, de inkoop-app, de
databasefuncties, de cron, de **webhook-triggers**, de schermgegevens en het
aanroeplogboek van de laatste etmaal.

Later die dag ging `medewerker-gegevens` er ook af, en daarmee het hele
draadje naar de oude app: `stuur-medewerker-verzoek` mailde een link naar
`medewerker-gegevens.html`, een pagina die de oude app serveerde, en die riep
deze functie aan. In boskma-2.0 doet **Mijn gegevens** hetzelfde voor wie
inlogt, en wat er nog ontbreekt kan Sander op de persoonskaart invullen.

Nagekeken voordat dat wegging: van de twaalf ingevulde formulieren staan de
gegevens van iedereen die nu in dienst is ook op zijn persoonskaart. Alleen
Sander zelf en drie mensen die niet meer in de personeelslijst staan (Daisy
Vermeer, Jasper Wijdenes, Tessa Vertelman) hebben gegevens die alleen in de
oude tabel staan.

**De tabel `medewerker_gegevens` blijft bestaan.** Daar is niets van
weggegooid. Maar niets in de nieuwe app leest hem, en er staan BSN's,
rekeningnummers en kopieën van identiteitsbewijzen in van mensen die hier niet
meer werken. Dat is een opruimvraag die nog openstaat; zie ook
`ruim-id-kopieen-op`, dat voor de nieuwe app wél al schoonmaakt.

**Terughalen** kan altijd — de broncode staat in commit `5edf7c7`:

```
git show 5edf7c7:supabase/functions/<naam>/index.ts > supabase/functions/<naam>/index.ts
npx supabase functions deploy <naam> --project-ref xukzumqddeateztmjpzf
```

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

## Opruimen van identiteitsbewijzen

`ruim-id-kopieen-op` draait dagelijks om zes uur. De regel staat in
`docs/modules/personeel/personeelsmodule.md`: het loonbureau bewaart de
kopieën, wij houden ze veertien dagen als vangnet. BSN en rekeningnummer
blijven staan — die heb je nodig voor de mutaties.

Sinds 24 oktober 2026 loopt hij langs drie plekken in plaats van één:

1. **De personeelskaarten.** Veertien dagen na `loonbureau_verstuurd_op`.
2. **De oude tabel `medewerker_gegevens`** van het invulformulier uit
   boskma-app. Die had geen loonbureau-datum, dus telt `ingediend_op`. Een
   bestand dat óók op een personeelskaart staat blijft met rust; dan is de
   kaart de baas.
3. **Wezen in de opslag.** Bestanden waar nergens nog een verwijzing naar
   staat. De eerste twee rondes werken van de administratie naar de opslag en
   vinden die dus nooit. Hier wordt het omgekeerd gedaan, met een marge van
   dertig dagen: het formulier zet eerst het bestand neer en bewaart daarna pas
   de verwijzing, en een upload van vanmiddag is dus even een wees zonder dat
   er iets mis is.

Op die dag lagen er **tweeëntwintig wezen** uit juni en juli, en acht kopieën
van vier mensen die niet in de personeelslijst staan. Allemaal weg. Van
zesentwintig bestanden naar vier, en die vier horen bij Maartje en Nathal, die
nog niet naar het loonbureau zijn gestuurd.

Nog iets dat daarbij aan het licht kwam: de opslag antwoordt op het verwijderen
van een bestand dat er niet meer is met **400**, niet met 404. Dat werd als
mislukking gelezen, dus veertien verwijzingen naar allang verdwenen bestanden
bleven staan en werden elke dag opnieuw gemeld. Nu wordt "not_found" in de
tekst ook als klaar gelezen.
