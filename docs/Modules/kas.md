# De kastelling

Vastgelegd op 24 augustus 2026. Vervangt het papiertje, niet NTF.

## Hoe het gaat

Lade eruit, alle coupures tellen van 5 cent tot 50 euro. Het totaal tikt Sander
over in NTF om te kijken of het klopt — de app doet daar niets mee. Daarna blijft
een deel in de lade en gaat de rest naar de kluis.

## Alles in centen

Alle bedragen staan als hele getallen in centen, in de database én in de app.
Rekenen met 0,05 en 0,10 als kommagetallen levert na genoeg optellingen
0,30000000000000004 op, en bij een kastelling is dat het verschil tussen "klopt"
en "klopt niet". Pas bij het tonen wordt er door honderd gedeeld.

## De splitsing

Per coupure staat een **gewenst aantal** ingesteld: wat je wilt overhouden om mee
te kunnen wisselen. Daaruit volgt:

- **tekort** = gewenst − geteld, als dat positief is
- **eruit** hangt af van de soort:
  - **biljetten**: alles boven het gewenste aantal. Die moeten naar de bank en
    leveren geen gedoe met rollen op.
  - **munten**: alleen hele rollen uit het overschot. De rest blijft liggen.
- **blijft** = geteld − eruit

**Waarom die rollen** (toegevoegd 25 augustus 2026): eerst ging alles boven het
gewenste aantal eruit, en dan wandelden vier dubbeltjes te veel naar de kluis.
Dat doe je in het echt niet. De rolgroottes zijn de gangbare Europese: 50 stuks
van 5 cent, 40 van 10, 20 en 50 cent, 25 van 1 en 2 euro. Ze staan als kolom
`rol` bij de coupure.

Meer niet. Geen slimmigheid die je later niet meer kunt navertellen — je kunt met
de hand controleren wat de app zegt, en dat is bij geld belangrijker dan een
optimale verdeling.

Het **kasbedrag is de optelsom** van de gewenste aantallen en wordt dus niet apart
ingesteld. Zo kan het nooit uit elkaar lopen met het wisselgeld dat je werkelijk
wilt hebben.

Een eerdere opzet ("alle munten blijven, biljetten vullen aan tot een bedrag")
is verworpen: bij een lade vol munten moet er juist muntgeld uit, en dan is er
geen garantie dat je van elk biljet genoeg overhoudt.

## De kluis heeft twee voorraden

**Briefgeld** loopt op tot een bankstorting. **Munten** blijven liggen als
wisselgeldvoorraad en kunnen terug naar de lade als je klein geld tekort komt —
daar sluit de tekortmelding op aan.

**Per coupure, overal.** Elke mutatie heeft regels met aantallen: hoeveel
dubbeltjes, hoeveel briefjes van twintig. Bij "uit de kassa" komt dat uit de
telling — die informatie werd eerst weggegooid, en dan weet je wel dat er honderd
euro aan munten ligt maar niet of dat rollen dubbeltjes zijn of twee-euromunten.

Het saldo is de optelsom van alle mutaties, niet een apart bijgehouden getal.
Aantallen en bedragen zijn getekend: positief is erbij, negatief is eraf. De
bedragen worden altijd uit de aantallen afgeleid en nooit los ingevoerd, zodat
geld en aantallen niet uit elkaar kunnen lopen.

**Natellen** zet wat jij telt naast wat de app dacht, per coupure, en zet het in
één keer recht. Bij een verschil is een reden verplicht.

Het seintje bij een hoog bedrag gaat over het **briefgeld**: dat is wat naar de
bank moet en waar een verzekering een grens aan stelt. De grens staat als
`kluis_grens` in de instellingen.

## Wisselen met iemand van buiten

Marktkooplui komen met kleingeld en willen er briefgeld voor terug, of andersom.
Dat is **geen omzet en geen correctie**: het totaal blijft gelijk, alleen de
verhouding munten/briefgeld verschuift. Vandaar een eigen soort `wisseling` —
zonder dat zou het als correctie geboekt moeten worden, en dan lijkt het in de
geschiedenis alsof er iets mis was terwijl er niets mis is.

Eén bedrag, gelijk oversteken: het gaat er aan de ene kant bij en aan de andere
kant af. De app laat je niet meer weggeven dan er ligt.

Gebeurt het uit de **lade** in plaats van uit de kluis, dan hoeft er niets
geboekt te worden: bij de telling die avond komt het er vanzelf uit, want je telt
wat er ligt.

## Wat vastligt, ligt vast

Een afgeronde telling verandert niet meer. Corrigeren doe je met een nieuwe
telling of een notitie erbij — net als bij het HACCP-logboek en de leveringen.

## Wie mag dit

Een eigen recht `kas`, naast recepten, MEP en HACCP. Staat standaard bij niemand
aan, en het menu-item verschijnt alleen voor wie het heeft. Dit gaat over geld.
