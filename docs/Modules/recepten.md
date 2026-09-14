# Recepten

Vastgelegd op 24 augustus 2026.

## Wat erin staat

Naam, waar het recept voor is ("1 bak — ongeveer 40 porties"), een korte
omschrijving, ingrediënten, bereiding en foto's.

**Ingrediënten zijn één tekstveld met een regel per ingrediënt**, geen aparte
tabel met velden. Sander schrijft ze zelf en dat moet vlot typen; een lijst
regels leest net zo goed als een raster, en er is niets om verkeerd in te vullen.

## Geen meerekenen

Staat er op de MEP "2 bakken", dan blijft dat een aantekening. De app
verdubbelt de ingrediënten niet.

Dat is een keuze, geen ontbrekende functie. Meerekenen vraagt dat elke
hoeveelheid kloppend en in een herkenbare eenheid is ingevoerd, en één slordige
regel levert dan een fout getal op waar de kok het uit zijn hoofd goed had. Het
risico is groter dan de winst.

## Waar je ze vindt

Twee plekken, want in de keuken wil je niet zoeken:

- een **receptenboek** met zoeken door naam, ingrediënten en bereiding;
- een knop **Recept** bij een MEP-taak. Koppel je het recept voor pindasaus aan
  de taak "Pindasaus maken", dan staat het daar met één tik open.

## Wie mag wat

Lezen mag iedereen die is ingelogd. Schrijven en aanpassen alleen wie het recht
`recepten` heeft — zie [rechten](rechten.md). De grens ligt in de database, in
`heeft_recht()`; de schermen verbergen alleen knoppen.

Foto's staan in de bak `Documenten` onder `recepten/`, met een tijdelijk adres
van een uur. Ze zijn dus niet met een los webadres door te sturen aan iemand die
niet is ingelogd.
