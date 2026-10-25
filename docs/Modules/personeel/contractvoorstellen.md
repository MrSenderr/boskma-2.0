# Contractvoorstellen — verlengen, stoppen, vaste uren

Plan, vastgelegd op 25 oktober 2026. Helemaal gebouwd.

## Doel

Contract verlengen, stoppen of vaste uren aanbieden loopt via de app, tot en
met het tekenen. Sander stelt het voorstel op, de medewerker ziet het in zijn
eigen deel van de app, bevestigt dat hij het heeft ontvangen, kiest en tekent.
Het **loonbureau maakt het contract**. Papier blijft altijd mogelijk.

## Wat de wet vraagt

Geen juridisch advies; de open punten onderaan laat Sander nakijken.

**Aanzeggen** (art. 7:668 BW). Bij een tijdelijk contract van zes maanden of
langer: uiterlijk een maand voor de einddatum schriftelijk laten weten óf het
contract doorgaat en zo ja onder welke voorwaarden. Digitaal mag, als de
ontvangst te bewijzen is. Te laat of niet: aanzegvergoeding van maximaal een
bruto maandloon (naar rato bij te laat), te vorderen binnen twee maanden na de
einddatum.

**Aanbod vaste uren** (art. 7:628a lid 5 BW). Na twaalf maanden op een
oproepovereenkomst: binnen een maand schriftelijk of elektronisch een aanbod
doen voor minstens het gemiddelde aantal verloonde uren van die twaalf maanden.
Een aanbod vóór de twaalf maanden telt niet. De medewerker heeft een maand om
te reageren en **mag weigeren**; dan blijft hij oproepkracht en volgt elke
twaalf maanden een nieuw aanbod. Bij aannemen gaan de uren uiterlijk in op de
eerste dag van de vijftiende maand. Geen aanbod: loonvordering over die uren,
verjaring pas na vijf jaar.

**Vaste uren** werken twee kanten op: de medewerker werkt ze, Boskma roostert
ze in en betaalt ze, ook als het rustig is. Meer werken in overleg.

**Ketenregeling** (art. 7:668a BW). Maximaal drie tijdelijke contracten in
maximaal drie jaar; daarna een contract voor onbepaalde tijd. Een pauze van
meer dan zes maanden reset de telling. Geldt niet voor wie jonger is dan 18 en
gemiddeld minder dan 12 uur per week werkt. Bij de overname tellen de
contracten bij Kai mee (opvolgend werkgeverschap).

**Wet meer zekerheid flexwerkers** (Stb. 2026, 205). Grotendeels per
1 januari 2028. Nulurencontracten verdwijnen, behalve voor wie jonger is dan 18,
scholieren en studenten met een bijbaan (gemiddeld maximaal 16 uur per week) en
AOW-gerechtigden. In de plaats komt een bandbreedtecontract: vast minimum, het
maximum ten hoogste 30% hoger. Contracten van vóór 1 januari 2028 lopen tot hun
einddatum. De tussenpoos in de ketenregeling wordt drie jaar.

## Volgorde van bouwen

1. **Contractgeschiedenis per medewerker.** Alle contracten op een rij, ook die
   bij Kai: soort, begin, einde, uren. Nodig om de keten en de twaalf maanden
   goed te tellen. Hierop bouwt de rest.
2. **Gewerkte uren.** Het gemiddelde over twaalf maanden, uit de gewerkte uren
   die al uit Eitje worden geïmporteerd (`rooster`, soort *gewerkt*).
3. **Contractwaker uitbreiden.** Rekenen met de echte startdatum, ook bij
   overgenomen medewerkers, en tonen hoeveelste contract het is ("contract 3
   van 3"). Bij elk seintje een knop **Voorstel opstellen**, vooringevuld.
4. **Voorstel opstellen (Sander).** Verlengen, stoppen, vaste uren of een
   combinatie, met duur, uren en loon. Voorbeeld zien, dan versturen. *Gebouwd
   25 oktober 2026.*
5. **Voorstel bekijken (medewerker).** Melding op de telefoon; onder *Mijn
   dossier* ontvangst bevestigen en bij vaste uren kiezen. Alles met tijdstip:
   verstuurd, geopend, bevestigd, gekozen. Niet geopend als de deadline nadert:
   de app waarschuwt Sander om het op papier te geven. *Gebouwd 25 oktober
   2026.* Keuzes die daarbij zijn gemaakt: altijd mail (dat is het bewijsstuk)
   en push als de medewerker die zelf aanzet onder *Mijn gegevens*; ontvangst
   bevestigen en kiezen zijn twee stappen; waarschuwing aan Sander twee weken
   én een week voor de uiterlijke datum; de medewerker mag altijd iets bij zijn
   antwoord schrijven.
6. **Naar het loonbureau.** Aangenomen of verlengd: verzoek om het contract op
   te stellen, met de afgesproken duur, uren en loon. Stoppen of "blijft
   oproepkracht": alleen een melding. *Gebouwd 25 oktober 2026.* Het blad heet
   *Wijziging dienstverband* en gaat over dezelfde weg als het
   mutatieformulier (`stuur-loonbureau`), zonder BSN, adres of
   identiteitsbewijs — die heeft het loonbureau al. Er staat bij wanneer de
   medewerker akkoord gaf en op welke tekst, zodat zij opstellen wat er is
   aangeboden. Sander drukt zelf af; de app zegt het als er een verzoek
   klaarligt. Het nieuwe contract komt pas in `contracten` als het getekend is
   (stap 7 en 8); tot die tijd zwijgt de contractwaker over een contract
   waarover al iets is afgesproken.
7. **Digitaal tekenen.** Sander uploadt de PDF van het loonbureau als
   *Contract*. De medewerker tekent in de app (naam typen, handtekening met de
   vinger), daarna Sander. De app maakt de getekende PDF met een extra pagina:
   wie tekende, wanneer, en een controlecode (SHA-256) van het origineel.
   Terugval: printen, tekenen, scannen, uploaden als *Getekend contract*.
   *Gebouwd 25 oktober 2026.* Keuzes die daarbij zijn gemaakt: naam voluit
   typen plus een bevestiging is verplicht, de krabbel niet (met een muis wordt
   het een hanenpoot, en een verplicht vakje dat niet wil is een medewerker die
   niet tekent); onder de 18 komt er een vak voor een ouder of verzorger, nu
   nog zonder verplichting zolang het open punt bij Pieter ligt; zodra beiden
   hebben getekend gaat het stuk meteen naar het loonbureau, langs dezelfde weg
   als een gescand contract. De medewerker tekent eerst en de werkgever
   tekent mee — de database houdt die volgorde vast. De controlecode wordt bij
   het afmaken opnieuw uitgerekend over de bytes in de opslag; klopt hij niet,
   dan gaat er niets door.
8. **Afronden.** Het getekende contract staat in het dossier en gaat vanzelf
   terug naar het loonbureau — dat bestaat al (`stuur-getekend-contract`).
   *Gebouwd 25 oktober 2026.* Daar is bij gekomen dat het afgesprokene nu ook
   in `public.contracten` terechtkomt, want zonder dat bleef de app rekenen met
   het contract dat eronder lag. Eén onderscheid bepaalt wat er gebeurt: een
   geaccepteerde verlenging is een nieuw contract en telt mee in de keten, een
   aangenomen aanbod vaste uren verandert het lopende contract en maakt de
   keten dus níet langer. Zou dat laatste een rij opleveren, dan zou de app bij
   de volgende verlenging zeggen dat die vanzelf vast wordt terwijl dat niet zo
   is. Een gescand contract krijgt dezelfde vraag bij het uploaden, zodat de
   papieren weg op hetzelfde uitkomt. En loopt een contract af zonder dat er
   iets nieuws ligt, dan vraagt het startscherm of de medewerker uit dienst
   moet — de app doet dat niet zelf, want het raakt zijn toegang, het rooster
   en de loonstrook.
9. **Teksten en brieven.** Als laatste. Eén brief voor alle gevallen, in
   eenvoudige taal, met blokken: A verlengen, B niet verlengen, C aanbod vaste
   uren (met uitleg wat vaste uren betekenen), plus ontvangstbevestiging en
   keuzestrook. *Gebouwd 25 oktober 2026; de teksten staan in
   [brieven.md](brieven.md) en in `src/lib/brieven.ts`.* De
   ontvangstbevestiging en de keuzestrook waren onderweg al gebouwd als knoppen
   in de app; de strook is er nu alleen nog op de geprinte versie. Die geprinte
   versie was het echte gat: papier is overal de terugval, maar de app maakte
   dat papier niet.

   Een brief wordt in twee vormen bewaard: als platte tekst (het bewijsstuk) en
   met zijn opbouw (zodat het scherm van de medewerker toont wat er werkelijk
   is verstuurd, ook als de tekst in de app later verandert).

   Het blad voor het loonbureau is dezelfde dag uitgekleed: daar stond het hele
   bewijsspoor en de volledige brief op, en daar doet het loonbureau niets mee.
   Nu staat er alleen wat zij nodig hebben om een contract te typen.

## Het twaalfmaandsgemiddelde, stand 25 oktober 2026

De gewerkte uren staan pas vanaf juli 2026 in de app. De uitdraai van Eitje
droeg bovendien het etiket *1 januari – 31 december 2026* terwijl er alleen
uren vanaf juli in zaten; zou de app dat etiket geloven, dan tellen januari tot
en met juni als maanden zonder werk. Voor één medewerker scheelde dat 5,59
tegen 14,24 uur per week — en een aanbod onder het echte gemiddelde blijft vijf
jaar opeisbaar.

Wat de app daarom doet:

- Een maand telt pas als ingelezen als minstens twee medewerkers er uren in
  hebben (`maanden_met_uren()`). De eigenaar en de oefenkaart tellen niet mee;
  in mei 2026 stonden zes regels van Sander zelf, en één iemands uren maken
  geen maand van de zaak.
- Het gemiddelde wordt berekend over de maanden die er zijn, niet over twaalf.
  Het voorstel onthoudt welke periode dat was (`gemiddelde_over`) en of het een
  heel jaar beslaat (`gemiddelde_bron`: `berekend`, `deels_berekend` of
  `loonbureau`).
- Een aanbod op minder dan twaalf maanden mag de deur uit, met een
  waarschuwing. Géén aanbod doen is duurder: dan loopt de vordering over álle
  uren in plaats van over het verschil.
- Het loonbureau weet de verloonde uren van het hele jaar exact — zij hebben ze
  uitbetaald. Dat getal kan het berekende overschrijven, en komt dan met bron
  en periode op het blad dat naar het loonbureau gaat.

## Het verlengproces in twee stappen — 25 oktober 2026

Een voorstel opstellen begon met een keuzelijst van drie soorten. Dat zette de
drie naast elkaar alsof het gelijkwaardige smaken zijn, en dat zijn ze niet.

Nu staan er twee vragen. Eerst: ga je door met deze medewerker, ja of nee. Pas
bij ja komt de tweede: langs welke weg — een aanbod vaste uren, of doorgaan
zoals het contract nu loopt.

Bij die tweede vraag zegt de app welke weg hier geldt. Werkt iemand twaalf
maanden als oproepkracht, dan is een aanbod vaste uren verplicht (art. 7:628a
lid 5 BW) en is doorgaan op afroep geen keuze van de werkgever: dat wordt het
pas als de medewerker het aanbod weigert. Is die twaalf maanden nog niet vol,
of is er het afgelopen jaar al een aanbod gedaan, dan zijn het wél twee
gelijkwaardige wegen — en dat staat er dan ook bij, met vanaf wanneer het
verandert.

Beide wegen staan er altijd, ook de weg die nu niet mag. Alleen de geldende
tonen zou korter zijn, maar dan zie je niet dát er een andere bestaat en dus
ook niet waarom deze er nu is. Het formulier begint wel op de weg die geldt.

Kies je toch de andere, dan waarschuwt de app en houdt hij niets tegen: er zijn
redenen die de app niet kan overzien. `aanbodStand()` in contractwaker.ts
beantwoordt de vraag of een aanbod verschuldigd is — dezelfde regel als waar
het seintje op het startscherm op rust, zodat de twee niet uit elkaar lopen.

## Eerst het aanbod, dan de verlenging — 25 oktober 2026

Bij de eerste proef kwam er "akkoord met verlengen, vaste uren geweigerd" uit
één voorstel. Dat kan, maar dan moet de verlenging uit twee antwoorden worden
afgeleid en krijgt het loonbureau een verzoek dat pas te begrijpen is als je
allebei de antwoorden kent.

Daarom staat *Verlengen én vaste uren aanbieden* niet meer in de keuzelijst. De
aard bestaat nog wel — voorstellen van vóór die datum blijven werken zoals ze
zijn verstuurd — maar nieuwe voorstellen gaan in twee stappen:

1. Het aanbod vaste uren.
2. Met de uitkomst in de hand de verlenging. De app vult die voor: aangenomen
   wordt een contract met vaste uren, geweigerd wordt oproepkracht. En het
   seintje op het startscherm zegt dan niet meer "laten weten of je verlengt"
   maar "aanbod vaste uren is beantwoord — nu de verlenging".

Let op de klok: aanzeggen moet uiterlijk een maand voor de einddatum, en op een
aanbod heeft iemand een maand om te antwoorden. Twee stappen passen alleen als
je op tijd met het aanbod begint.

## Afspraken

- Het loonbureau maakt het contract, niet de app.
- Digitaal tekenen in de app, zonder tekendienst; papier als terugval.
- Bandbreedtecontracten (minimum en maximum) passen er nu al in, zodat er in
  2028 niets verbouwd hoeft te worden.

## Open punten voor Pieter

- Tellen de twaalf maanden en de contracten bij Kai mee na de overname?
- Is digitaal tekenen in de app goed genoeg, ook voor medewerkers onder de 18?
- Moet een ouder of verzorger mee tekenen bij een verlenging?
- Wijkt de horeca-cao af van de ketenregeling of het aanbod vaste uren?
- Wat betekent het overgangsrecht van 2028 voor nulurencontracten voor
  onbepaalde tijd (zoals bij Denzel)?
