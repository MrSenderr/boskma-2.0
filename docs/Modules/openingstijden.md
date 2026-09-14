# Openingstijden

Vastgelegd op 24 augustus 2026.

Dinsdag tot en met zondag van 12:00 tot 20:00. Maandag dicht. Daarnaast losse
dagen die afwijken: tweede kerstdag dicht, met de kermis eerder open.

## Waarom dit geen instelling in een hoekje is

De app rekende tot nu toe elke dag mee. Gevolg:

- in de **weekafsluiting** stond elke maandag "0 van 6 gemeten" in het rood;
- in de **uitdraai voor een controle** zat elke maandag een gat.

Dat is geen verzuim maar een gesloten deur, en dat verschil moet de app kennen —
zeker in een document dat je aan een inspecteur geeft.

## Wat eraan hangt

| Waar | Wat het doet |
|---|---|
| Weekafsluiting | Een gesloten dag telt niet mee en staat grijs met "dicht". |
| Uitdraai | Idem; geen onverklaarbare gaten meer. |
| Vandaag (medewerker) | Op een gesloten dag geen rondes en geen werklijsten, met de reden erbij als die er is. |
| Temperaturen | De sluitingsronde is aan de beurt **een uur voor sluitingstijd**, afgeleid uit het rooster. Stond eerst los ingesteld op 19:00. |
| MEP | De lijst die 's avonds gemaakt wordt, gaat over de **eerstvolgende opendag**. Op zondagavond is dat dinsdag. |

## Hoe het werkt

Twee tabellen. `openingsdagen` is het weekrooster, één rij per dag, ISO-nummering
(1 = maandag, 7 = zondag — hetzelfde als `EXTRACT(isodow …)`, dus nergens
omrekenen). `afwijkende_dagen` is per datum, en **wint** van het weekrooster.

Één regel die er bewust in zit: is het rooster nog niet geladen, dan doet de app
alsof er gewerkt wordt. Een dag ten onrechte meetellen valt op en corrigeer je;
een dag ten onrechte overslaan verdwijnt stil uit je dossier, en dat is erger.

`volgendeOpendag()` kijkt maximaal veertien dagen vooruit. Veertien dagen dicht
bestaat niet; komt het daar toch, dan is er iets mis met het rooster en neemt hij
gewoon morgen — beter een dag te vroeg dan een lijst die nergens landt.
