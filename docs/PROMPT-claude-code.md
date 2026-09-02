# Opdracht: Verzekeringsinzicht-export toevoegen aan boskma-app

Bouw in de HR-module van boskma-app (Node.js + PostgreSQL 16) een export van alle actieve medewerkers naar het CSV-formaat van Verzekeringsinzicht. Specificatie en voorbeeldbestand staan in deze map:

- `SPEC-verzekeringsinzicht-csv.md` — kolommen, formaat, bedrijfsregels (leidend)
- `voorbeeld-export-verzekeringsinzicht.csv` — echte export uit Verzekeringsinzicht; adressen daarin zijn placeholders, formaat is leidend

## Stappen

1. **Inventariseer het datamodel.** Bekijk de medewerkerstabel(len) en het personeelsdossier. Maak een mapping van elk CSV-veld naar een bestaande kolom. Rapporteer welke velden ontbreken.
2. **Vul het model aan** waar nodig met een migratie. Verwacht dat minimaal deze velden bestaan of erbij moeten: voorletters, tussenvoegsel, achternaam, geboortedatum, geslacht (M/V/O), straat, huisnummer, toevoeging, postcode, plaats, land (default NL), begindatum, einddatum, contracttype (ONB/BEP), dienstverbandsoort (enum uit spec), contracturen per week, functie, dga (default false), werknemernummer. Geen aparte velden voor ParttimePercentage/Dienstverband/Werkzaamheden — die worden afgeleid (zie bedrijfsregels in de spec).
3. **Endpoint**: `GET /api/hr/export/verzekeringsinzicht` (alleen ingelogd/admin), geeft het CSV-bestand als download met de juiste headers, bestandsnaam `werknemers-Arbeidsovereenkomst-<jjjjmmdd>.csv`. UTF-8 met BOM, eerste regel `SEP=;`.
4. **Validatie vóór export**: controleer per medewerker de verplichte velden en waardebereiken uit de spec. Bij fouten: geen bestand, maar een lijst met medewerker + ontbrekend/ongeldig veld, zodat ik dat in de app kan aanvullen.
5. **UI**: knop "Export Verzekeringsinzicht" op de medewerkersoverzichtpagina in de HR-module, met foutmelding-weergave uit stap 4. Als de medewerkerbewerkpagina de nieuwe velden nog niet toont, voeg ze toe.
6. **Test**: unit-test op de CSV-builder met minstens één 0-urencontract, één regulier parttime, één fulltime en één ONB zonder einddatum. Vergelijk kolomvolgorde en header regel-voor-regel met het voorbeeldbestand.

## Werkwijze
- Volg de bestaande conventies in de codebase (structuur routes, DB-laag, frontend).
- Klein en iteratief: eerst mapping + rapport van ontbrekende velden laten zien, dan pas migratie en code.
- Geen externe CSV-library nodig als er al een is; anders `csv-stringify` of handmatig (velden zijn simpel).
