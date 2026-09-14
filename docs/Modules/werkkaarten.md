# Werkkaarten

Vastgelegd op 24 augustus 2026, naar de pdf *zonnetje_werkkaarten_2*
(versie juli 2026).

## Waarom los van recepten

Een **recept** gaat over de voorbereiding: pindasaus maken in bulk, met
ingrediënten en hoeveelheden. Een **werkkaart** gaat over de service: hoe stapel
ik dit broodje terwijl er twintig mensen staan. Andere vraag, ander moment,
andere weergave — dus twee onderdelen naast elkaar en niet één lijst waarin ze
door elkaar staan.

## Opzoeken in twee tikken

Vijf categorieën — belegde broodjes, burgers, salades, wraps, kapsalon — en
daarachter de gerechten. Geen zoekveld: met vette vingers typ je niet.

## Twee weergaven

**Lijst.** Genummerde stappen van 1 tot 12. Voor broodjes, salades, wraps en de
kapsalon.

**Stapel.** Blokken van onder naar boven, met kleur per soort: groente groen,
vlees bruin, bacon rood, kaas en ei geel, saus oranje. Voor de burgers, want daar
laat de kaart zien hóe het ligt.

Staat op een kaart geen weergave, dan geldt die van de categorie. Zo kan één
burger toch een lijst zijn als dat beter past.

## De gedeelde bereiding

Wat voor élke burger geldt staat op één plek bij de categorie en verschijnt boven
elke burgerkaart. Wijzig je het, dan klopt het meteen op alle vijf.

**Gewijzigd op 24 augustus 2026:** burgers gaan niet meer in de oven maar op de
plaat, en worden daar meteen iets platter gedrukt met de burgerpers. De
gekaramelliseerde uien gaan mee op de plaat, de cheddar op de burger, en bacon en
ei apart op dezelfde plaat. Alleen het broodje gaat nog de oven in, drie minuten.
Voor de baktijd op de plaat is bewust geen timer: dat gaat op het oog, en een
timer die afgaat terwijl je ernaast staat is alleen maar lawaai.

Een bereidingsblok was platte tekst zonder timer. Omdat dat broodje er wel een
nodig heeft, hebben categorie én kaart nu `bereiding_minuten` en
`bereiding_label`: één timer per blok. Genoeg voor wat er op de kaarten staat;
komt er ooit een blok met twee tijden, dan worden het losse stappen.

**Ook gewijzigd op 24 augustus:** de gedeelde bereiding somde alle varianten op,
dus wie een classic maakte las ook wat er bij een cheeseburger en een smokey
moet. Precies het soort verwarring waardoor er in de drukte een verkeerde burger
de deur uit gaat.

Nu staat in `gedeelde_bereiding` alleen wat voor élke burger geldt, en in
`eigen_bereiding` per kaart alleen zijn eigen toevoeging. Het scherm plakt die
twee tot één lijstje. Je leest dus alleen wat voor jouw burger geldt, en een
wijziging aan de uien hoeft nog steeds maar op één plek.

De Royal Spicy volgt die bereiding niet en heeft daarom `gebruikt_gedeelde` uit
staan, met zijn eigen drie stappen in `eigen_bereiding`.

## De timer

Staat er een aantal minuten bij een stap, dan wordt die stap een knop. Drie
dingen die daarbij bewust zo gebouwd zijn:

- **Meerdere tegelijk.** Er staan twee dingen in de oven. De lopende timers staan
  als balk bovenin, ook als je naar een andere kaart bladert.
- **Rekenen met de eindtijd, niet met tellen.** Een browser die op de achtergrond
  staat slaat tikken over; een timer die optelt loopt dan achter. Dit is de fout
  die je bij veel keukentimers ziet.
- **Geluid dat de app zelf maakt.** Drie korte piepjes via de Web Audio API, geen
  bestand dat geladen moet worden. Werkt dus ook als het internet hapert.

Staat de telefoon op stil, dan hoor je niets — daar kan de app niets aan doen.
De melding staat wel groot in beeld en knippert.

## Wat er bewust niet in zit

**Afvinken tijdens het maken.** Op een werklijst is dat nuttig, hier niet:
tijdens de drukte wil je kijken en doorwerken, niet tikken.

## Wie mag wat

Lezen mag iedereen die is ingelogd. Aanpassen wie het recht `recepten` heeft —
zie [rechten](rechten.md). Het is hetzelfde soort werk, dus geen apart vinkje.

## Wat erin staat

21 gerechten met 159 stappen, overgenomen uit de pdf. De migratie voert ze alleen
in als er nog niets staat, zodat opnieuw draaien niets dubbel zet en handmatige
wijzigingen blijven staan.
