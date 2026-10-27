# Rooster en gewerkte uren

Besloten op 20 september 2026.

## Waarom

Het rooster wordt gemaakt in eitje en dat blijft zo. Die app is van de
medewerkers, ze kijken er toch al in, en er is geen reden om een tweede plek te
maken waar iemand zijn dienst moet zoeken.

Wat eitje niet doet is onthouden. Je ziet er een week, en de week daarna is de
vorige weg. Vragen die daardoor onbeantwoord blijven:

- wie werkt er structureel meer dan er gepland stond, en wie minder;
- hoeveel uur maakte iemand vorig kwartaal, bij een gesprek over een contract;
- welke dagen liepen uit, en bij wie.

Daarom worden de exports hierheen gehaald en bewaard. Een week wordt geen twee
weken: ze blijven staan zoals ze waren.

## Hoe het werkt

Uit eitje komen twee exports, allebei als xlsx:

| Export | Wat erin staat |
|---|---|
| Geplande shifts | het rooster: naam, datum, team, tijdvak, uren |
| Gewerkte uren | de registratie: voornaam, datum, tijdvak, pauze, uren |

Je sleept zo'n bestand op **Rooster → Importeren**. De app leest zelf welk van
de twee het is (aan het tabblad `log`, en anders aan de kolommen) en laat eerst
zien wat er zou gebeuren: hoeveel nieuw is, wat er verandert, en wat er al
precies zo stond. Pas daarna lees je het in.

Historie gaat er op dezelfde manier in. Eén export over een heel jaar is voor de
app hetzelfde als één over een week.

### Waarom het twee keer importeren geen twee keer telt

Elke regel in de export heeft een `support ID` — het `record_id` van eitje. Dat
is de sleutel in de database. Dezelfde week opnieuw inlezen werkt de bestaande
regels bij; een shift die in eitje is verschoven verschuift hier mee. Zonder die
sleutel zou elke correctie een extra dienst worden en klopt elke telling daarna
niet meer.

Wat er *niet* gebeurt: een shift die in eitje verwijderd is, verdwijnt hier niet
vanzelf. Hij stond er, dus hij blijft staan.

### Namen

Hier zit het enige echte handwerk. De urenexport geeft alleen een voornaam, en
waar wel een achternaam staat komt die niet altijd overeen met het
personeelsbestand: in eitje "Ilona Swagerman", bij ons "Swagerman-Honselaar".

De app zoekt daarom van streng naar ruim — volledige naam, dan achternaam die
een deel van de andere is, dan voornaam alleen — en koppelt alleen als er
precies één medewerker overblijft. Twee mensen die Evi heten leveren geen gok
op maar een vraag. Wie overblijft wijs je één keer met de hand aan; dat wordt
bewaard in `rooster_namen` en daarna gaat het vanzelf.

"Hoort niet bij ons personeel" is een geldig antwoord, bijvoorbeeld bij een
uitzendkracht. Die naam vraagt dan niet elke week opnieuw om aandacht, en de
uren blijven wel bewaard.

### Gepland naast gewerkt

Op **Week** ligt het gewerkte over het geplande heen: je ziet per dag wie er
stond, wat het werd, en hoeveel het scheelt. Op **Per medewerker** staat
hetzelfde opgeteld over een maand of een jaar.

Een verschil wordt alleen geteld over dagen waarvan de uren zijn ingelezen.
Anders zou een week die wel op het rooster staat maar waarvan de registratie nog
moet komen, eruitzien alsof niemand is komen opdagen.

Wat er verder uit valt te lezen:

- **open diensten** — een shift zonder naam: ingeroosterd, nog niemand op gezet;
- **niet ingepland** — gewerkt op een dag waarop niets stond;
- **nul-urenregels** — in- en uitgeklokt op dezelfde minuut. Die komen voor
  (elf keer in augustus 2026) en worden bewaard, maar tellen nergens in mee.

## Waar het staat

| Wat | Waar |
|---|---|
| xlsx uitpakken | `src/lib/xlsx-lezen.ts` |
| export begrijpen | `src/lib/eitje.ts` |
| naam bij medewerker zoeken | `src/lib/koppelen.ts` |
| ophalen, vergelijken, optellen | `src/lib/rooster.ts` |
| schermen | `src/pages/Rooster*.tsx` |
| tabellen | `supabase/migrations/20260920000001_rooster.sql` |

De xlsx wordt zonder bibliotheek gelezen: een xlsx is een zip met wat XML, en
de browser kan allebei al (`DecompressionStream`). De bekende leesbibliotheek is
vier megabyte, publiceert zijn veilige versies niet meer op npm, en kan duizend
dingen die we niet doen.

In `docs/voorbeeld-eitje/` staan twee echte exports met verzonnen namen erin.
Daar toetsen de tests op, zodat een verandering in de vorm van de export opvalt
voordat een import ermee misgaat.

## Rechtstreeks uit eitje

Sinds 27 oktober 2026 hoeft de uitdraai niet meer per mail. Eitje heeft een open
API; de serverfunctie `eitje-uren` haalt de gewerkte uren op en zet ze in
dezelfde tabellen als de Excel-import. Die Excel-route blijft ernaast staan.

**Waar het staat.** De documentatie is een Postman-pagina:
<https://documenter.getpostman.com/view/443091/2s9YXk2gBR>. Het hulpartikel van
eitje erover staat op
<https://intercom.help/eitje/nl/articles/8581248-open-api>. Vragen gaan naar
info@eitje.app; het partnercontact was Bas Groenewoud.

**Vier sleutels, geen twee.** De authenticatie gaat via vier losse headers:
`Partner-Username` en `Partner-Password` (die krijg je van eitje als partner) én
`Api-Username` en `Api-Password` (die staan in eitje zelf onder
Bedrijfsinstellingen → Organisatie → API, zichtbaar voor wie admin is in álle
vestigingen). Ze staan in Supabase bij de serverfuncties als
`EITJE_PARTNER_USERNAME`, `EITJE_PARTNER_PASSWORD`, `EITJE_API_USERNAME` en
`EITJE_API_PASSWORD`.

**Het vaste nummer.** De API geeft per persoon een nummer, met e-mailadres en
geboortedatum ernaast. Dat nummer komt in `sollicitaties.eitje_user_id` te
staan, met een uniek slot erop: twee medewerkers met hetzelfde nummer zou
betekenen dat de uren van de één op de ander belanden. Is dat nummer er eenmaal,
dan hoeft er nooit meer op naam geraden te worden — `koppelen.ts` blijft wel
bestaan voor de eerste keer en voor de Excel.

Een koppeling op alleen een voornaam wordt met opzet níet vastgelegd. Die wordt
gemeld zodat je hem zelf aanwijst: het nummer is daarna de waarheid, en een
verkeerd vastgelegd nummer zet jaren uren op de verkeerde persoon zonder dat
iemand het ziet.

**Twee dingen die stil fout zouden gaan.** Eitje schrijft de soort als
`gewerkte_uren`, de database als `gewerkte uren`; `VERLOOND` in
`gewerkteUren.ts` kijkt naar de spatie-versie, dus zonder omzetting tellen de
uren voor nul mee. En de datumstukken overlappen met een dag, omdat nergens
staat of eitje de einddatum meerekent — een dag dubbel ophalen overschrijft
zichzelf, een dag missen maakt het totaal een zevende te laag.

**De proef.** De urenregels worden bewaard onder het nummer dat eitje aan de
dienst geeft, zodat opnieuw ophalen overschrijft in plaats van stapelt. Of dat
dezelfde nummers zijn als het "support ID" uit de Excel was bij het bouwen niet
na te meten. Daarom is er `modus: "proef"`: die legt één week naast wat er al
staat en schrijft niets. Pas als er nummers op elkaar passen gaat de knop
"Uren terughalen" aan.

## Wat er nog niet in zit

- **De planning delen.** Nu kijk je in de app; een weekoverzicht om te
  versturen of op te hangen is er nog niet.
- **Verlof en ziek.** eitje kent die soorten; zodra ze in de export staan komen
  ze mee. De kolom `soort` in `gewerkte_uren` heeft daarom met opzet geen
  CHECK — een onbekende soort hoort ingelezen te worden, niet geweigerd.
- **Het eigen scherm voor een medewerker.** De RLS-regels staan er al op: wie
  inlogt kan zijn eigen regels zien en die van niemand anders.
