# Specificatie CSV-import Verzekeringsinzicht (werknemers / arbeidsovereenkomst)

## Bestandsformaat
- UTF-8 **met BOM**
- Eerste regel letterlijk: `SEP=;`
- Scheidingsteken `;`, geen quotes tenzij nodig
- Datums: `dd-mm-jjjj`; lege einddatum: leeg laten (voorbeeld toont `00-00-0000`, maar leeg werkt in de bestaande export)
- Kolomvolgorde exact als in `voorbeeld-export-verzekeringsinzicht.csv`
- Bestandsnaam bij voorkeur: `werknemers-Arbeidsovereenkomst-<jjjjmmdd>.csv`

## Kolommen (in volgorde)

| Kolom | Verplicht | Toegestane waarden | Opmerking |
|---|---|---|---|
| voorletters | ja | vrij | bijv. `J.` |
| tussenvoegsel | nee | vrij | |
| achternaam | ja | vrij | |
| geboorte_datum | ja | dd-mm-jjjj | samen met geslacht sleutel voor matching bestaande medewerker |
| geslacht | ja | `M` / `V` / `O` | |
| dga | nee | `j` / `n` | kleine letters |
| email | nee | vrij | |
| telefoon | nee | vrij | |
| werknemernummer | nee | vrij | wij gebruiken initialen (bijv. `JD`) of intern personeelsnummer |
| straat | ja | vrij | |
| huisnummer | ja | NL-formaat | |
| toevoeging | nee | vrij | |
| postcode | ja | `1234AB` (zonder spatie) | |
| plaats | ja | vrij | export gebruikt HOOFDLETTERS |
| land | ja | `NL` / `BE` / `FR` | ISO-landcode |
| Begindatum | ja | dd-mm-jjjj | |
| Contract | ja | `ONB` / `BEP` | onbepaalde / bepaalde tijd |
| DienstverbandSoort | nee | `regulier` / `onbekend` / `0-uren` / `min-max` / `voorovereenkomst` / `uitzendkracht` / `bbl` / `stagiair` | |
| Einddatum | alleen bij BEP | dd-mm-jjjj | |
| Afdeling | nee | vrij | |
| Functieomschrijving | nee | vrij | |
| Werkzaamheden | nee | `A` / `C` / `R` / `H` / `Z` | Administratief / Commercieel / Reizend / Handenarbeid / Zware handenarbeid |
| Dienstverband | ja | `ft` / `pt` | kleine letters |
| ParttimePercentage | ja | 1–100 | geheel getal |
| Contracturen | ja | 1–60 | geheel getal |

## Bedrijfsregels 't Zonnetje
- 0-urencontract → `DienstverbandSoort = 0-uren`, `Dienstverband = pt`, `ParttimePercentage = 1`, `Contracturen = 1` (minimum is 1, 0 wordt geweigerd)
- Vast aantal uren → `regulier`, percentage = uren / 40 × 100 (afgerond), `ft` bij 40 uur
- Werkzaamheden voor snackbarpersoneel: `H` (handenarbeid)
- Alleen medewerkers met een lopend of toekomstig dienstverband exporteren (einddatum leeg of ≥ vandaag)
