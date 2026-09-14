# Module: Personeel

Van binnengekomen sollicitatie tot "het loonbureau heeft alles", zonder
overtikwerk. Plus een overzicht van wie compleet is en wie niet.

Eén module, één lijst. Een sollicitant en een medewerker zijn niet twee aparte
administraties maar dezelfde persoon in een andere fase — je ziet altijd in welke
fase iemand zit.

## Afbakening

| | |
|---|---|
| Gebruiker | Sander, alleen. Opzet houdt rekening met later meer |
| Doel | sollicitaties opvangen, gegevens verzamelen, overzicht houden, doorgeven aan Loonbureau Westfriesland |
| Sollicitaties | komen binnen via werkenbij.snackerietzonnetje.nl |
| Omvang | ± 10 medewerkers, doorloop maximaal 5 per jaar |
| Loonbureau | Loonbureau Westfriesland, `h.mes@lbwf.nl`, cc naar Sander |

Wat er **niet** in komt, want dat staat in Eitje: rooster, gewerkte uren, verlof
en de contracten zelf. Het loonbureau maakt de contracten op; deze module levert
alleen de gegevens aan waaruit zij dat doen — inclusief van wanneer tot wanneer.

Ook niet: het contract genereren of laten tekenen. Dat blijft uit.

## Wat er al werkt en gewoon meegaat

Dit hoeft niet verzonnen te worden, alleen netjes opnieuw opgebouwd:

- **De invullink.** Sander deelt hem via WhatsApp of mail, de medewerker vult in
  één keer alles in. Werkt naar tevredenheid — niet verbouwen, alleen overzetten.
- **De loonheffingsverklaring.** Eigen model, "Vrije opgaaf conform art. 28 Wet
  LB 1964", goedgekeurd door het loonbureau, mét handtekening die de medewerker
  op zijn telefoon zet.
- **Het mutatieformulier** als PDF, opgemaakt via de eigen PDF-dienst op
  `pdf.boskmafoodservice.nl`.
- **Het versturen** via Resend vanaf `onboarding@boskmafoodservice.nl`.

## De keten

1. Iemand solliciteert via `werkenbij.snackerietzonnetje.nl` en verschijnt
   vanzelf in de lijst als **sollicitant**
2. Sander spreekt hem, en besluit: afwijzen, of **aannemen**
3. Aannemen zet dezelfde persoon door naar **medewerker** — één knop, geen
   overtikwerk, geen tweede kaart
4. Sander deelt de invullink — WhatsApp of mail, zelf te kiezen
5. Medewerker vult in: persoonsgegevens, loonheffing met handtekening, ID-kopie
6. In de app springt hij op **compleet**
7. Sander vult aan wat de medewerker niet weet: contracttype, duur, functie,
   ingangsdatum, eventueel einddatum, uurloon, proefperiode
8. Sander verstuurt → mutatieformulier + loonheffingsverklaring + ID-kopie gaan
   in één mail naar het loonbureau
9. Sander vinkt af dat het loonbureau bevestigd heeft

Iemand die nooit gesolliciteerd heeft — of die er al werkt — kan Sander
rechtstreeks als medewerker toevoegen. Dan begint het gewoon bij stap 4.

## De twee documenten

### Mutatieformulier

Kop met Boskma Foodservice V.O.F., adres en KvK-nummer, en de soort mutatie.

**Contractgegevens** — vult Sander in:
medewerker · contracttype · functie · ingangsdatum · einddatum · uurloon bruto ·
proefperiode ja/nee · contract opstellen door loonbureau ja/nee

**Medewerkergegevens** — komt uit het invulformulier:
geboortedatum en -plaats · geslacht · BSN · adres · IBAN · loonheffingskorting ·
in dienst sinds · e-mail · telefoon

Voettekst: "Vertrouwelijk — uitsluitend bestemd voor loonbureau".

### Loonheffingsverklaring

Blijft precies zoals hij is, want hij is goedgekeurd:

1. Uw gegevens — achternaam en voorletters, BSN, straat en huisnummer, postcode
   en woonplaats, land, geboortedatum
2. Loonheffingskorting toepassen — ja vanaf datum / nee vanaf datum, plus
   alleenstaande-ouderenkorting
3. Ondertekening — datum en handtekening, met de verklaringstekst eronder

## Wie vult wat in

| De medewerker | Sander |
|---|---|
| naam, geboortedatum en -plaats | contracttype |
| adres | functie |
| telefoon, e-mail | ingangsdatum en einddatum |
| BSN | uurloon |
| IBAN | proefperiode |
| geslacht | contract door loonbureau ja/nee |
| loonheffingskorting + handtekening | |
| kopie ID voor- en achterkant | |
| noodcontact | |
| t-shirtmaat | |

Noodcontact en t-shirtmaat gaan **niet** mee naar het loonbureau; die zijn voor
eigen gebruik.

## Testmodus — staat standaard aan

Er gaat niets naar buiten tot Sander dat bewust aanzet.

- Elke uitgaande mail — naar medewerker én naar loonbureau — gaat naar
  `testmail@boskmafoodservice.nl`
- Onderwerp krijgt `[TEST]` ervoor, en bovenin de mail staat voor wie hij
  eigenlijk bedoeld was
- In de app een gele balk zolang testmodus aan staat
- Uitzetten kan alleen met een bevestiging waarin staat wat er dan gebeurt

Ook de invullink is in testmodus zelf te doorlopen, zodat Sander het formulier
één keer kan invullen alsof hij een nieuwe medewerker is.

## Contracttypes en functies

Keuzemenu's, geen tikwerk:

| Contracttype |
|---|
| Nuluren-overeenkomst (oproep) |
| Vaste uren |

Daarnaast, apart, de duur:

| Duur | Einddatum |
|---|---|
| Bepaalde tijd | verplicht |
| Onbepaalde tijd | vervalt, en staat dan ook niet op het formulier |

Dus het veld einddatum verschijnt alleen als er "bepaalde tijd" is gekozen, en is
dan verplicht. Bij onbepaalde tijd blijft die regel weg uit het mutatieformulier.

| Functie | Functiegroep |
|---|---|
| Medewerker fastservice I | 2 |
| Medewerker fastservice II | 3 (referentiefunctie) |

Uit het CAO-functiehandboek horeca.

## Geen toets op het uurloon

Overwogen en bewust niet gedaan. Het loonbureau bewaakt de loonschalen en het
uurloon staat ook in Eitje; een tweede plek die er iets van vindt levert alleen
verwarring op.

Het veld uurloon blijft wel gewoon op het mutatieformulier staan — dat staat op
het bestaande voorbeeld en het loonbureau heeft het nodig. Er zit alleen geen
controle op.

## De ID-kopie

Gaat mee naar het loonbureau, wordt daar bewaard. In deze app **veertien dagen**,
zodat er iets terug te sturen is als er bij het loonbureau iets misgaat. Daarna
gooit de app hem automatisch weg.

Zo ligt er bij Boskma geen verzameling paspoortkopieën.

## Het overzicht

**De lijst** — twee groepen onder elkaar, sollicitanten boven, medewerkers
eronder. Altijd zichtbaar wie wat is, en per persoon waar het staat:

| Sollicitant | betekent |
|---|---|
| Nieuw | net binnengekomen, nog niets mee gedaan |
| Contact gehad | gebeld of gemaild, wacht op antwoord |
| Gesprek | gesprek gepland of geweest |
| Afgewezen | verdwijnt naar het archief |

| Medewerker | betekent |
|---|---|
| Link verstuurd | wacht op de medewerker |
| Compleet | ingevuld, wacht op Sander |
| Naar loonbureau | verstuurd |
| In dienst | loonbureau heeft bevestigd, klaar |
| Uit dienst | verdwijnt naar het archief |

Aannemen is de overgang van de bovenste tabel naar de onderste. Het is dezelfde
persoon en dezelfde kaart; wat hij als sollicitant heeft ingevuld — naam,
geboortedatum, telefoon, e-mail — staat er dus al in en hoeft niemand opnieuw te
typen.

**Per persoon** een kaart met alle gegevens, de gegenereerde documenten en wat er
wanneer verstuurd is.

**Archief** — wie uit dienst is, verdwijnt uit de lijst maar blijft volledig in
te zien, BSN en rekeningnummer inbegrepen. Er wordt niets gewist; alleen de
ID-kopie is dan allang weg via de veertiendagenregel.

## Mutatiesoorten

Nu bouwen: **nieuw dienstverband**. Dat is de hoofdmoot.

Zo inrichten dat deze er later bij kunnen zonder verbouwing: contractverlenging,
wijziging uurloon, uit dienst.

## Regels die vastliggen

- **Niets naar buiten in testmodus.** Geen uitzonderingen.
- **BSN en IBAN alleen waar ze nodig zijn.** Niet in lijstjes, niet in
  overzichten — alleen op de kaart van die ene persoon en in de documenten.
- **Alles op naam en met een tijdstip.** Wanneer verstuurd, naar wie, door wie.
- **De verstuurde documenten blijven bewaard** als PDF, zodat je later kunt
  terugkijken wat er precies is doorgegeven.

## Stand op 23 augustus 2026

Stap 1 tot en met 6 zijn gebouwd en draaien. Wat er nog niet is: het
invulformulier zelf draait nog op de oude onboarding-site — dat werkt, is
goedgekeurd door het loonbureau, en overzetten levert nu niets op behalve
risico. De andere mutatiesoorten (contractverlenging, loonwijziging, uit dienst
melden bij het loonbureau) zijn er ook nog niet.

## Wat een medewerker zelf kan

Besloten op 23 augustus 2026.

**Toegang.** Een medewerker kan pas inloggen zodra zijn dossier naar het
loonbureau is gestuurd. Daarvoor is er nog niets om te tonen. Zodra hij uit
dienst wordt gemeld vervalt de toegang meteen; zijn gegevens blijven wel in het
archief staan.

**Zelf aanpassen:** adres, telefoon, e-mail, noodcontact, kledingmaat en
rekeningnummer.

**Het rekeningnummer is een uitzondering.** Dat raakt de loonbetaling, dus het
wordt niet stilletjes doorgevoerd: de wijziging wordt vastgelegd, Sander ziet
hem op zijn startscherm en beslist of hij naar het loonbureau gaat. Een
verkeerde rekening is lastig terug te draaien, en dit is precies het soort
wijziging waar iemand van buiten belang bij zou hebben.

Tot die goedkeuring blijft het oude rekeningnummer gelden voor het loonbureau,
en ziet de medewerker dat zijn wijziging in behandeling is.

**Wat hij ziet:** zijn eigen gegevens, wat hij zelf heeft afgetekend, en zijn
dossier.

## Het dossier

Besloten op 23 augustus 2026. Bestaat uit **gespreksverslagen** en **documenten**
(loonheffingsverklaring, contract). Verzuim en waarschuwingen horen er
uitdrukkelijk niet bij.

**Een verslag is standaard privé.** Sander schrijft vrijuit; per verslag zet hij
een schakelaar om zodra de medewerker het mag lezen. Zonder die bewuste handeling
ziet niemand iets. Anders ga je anders schrijven, want dan wordt ook een half
afgemaakte notitie meteen gelezen.

**Een gedeeld verslag kan de medewerker aftekenen.** Hij ziet het, en geeft
akkoord — met tijdstip erbij. Daarmee staat vast dat hij het gelezen heeft en
wat er is afgesproken.

Voorstel daarbij, tenzij Sander het anders wil: naast *akkoord* ook *niet
akkoord, met opmerking*. Bij een functioneringsgesprek heeft iemand het recht
zijn eigen kant erbij te zetten, en een dossier waarin dat kan is er een die
standhoudt. Alleen een akkoordknop dwingt iemand tot instemmen of tot niets doen,
en dan weet je achteraf niet wat het was.

Wat er vastligt bij een verslag: wanneer geschreven, door wie, wanneer gedeeld,
wanneer gelezen, en wat de medewerker erop antwoordde. Verslagen worden niet
gewist; een fout wordt gecorrigeerd met de correctie zichtbaar.

Niet: contractgegevens zoals functie en uurloon — die staan in Eitje, en twee
plekken met hetzelfde gaan vroeg of laat afwijken.

## Bouwvolgorde

1. De lijst met sollicitanten en medewerkers, en de kaart per persoon —
   inclusief de knop aannemen
2. Het invulformulier en de link — inclusief handtekening en ID-upload
3. Testmodus, vóór er ook maar één mail verstuurd kan worden
4. De twee documenten opmaken als PDF
5. Versturen naar het loonbureau, met bevestigingsvinkje
6. Archief en het automatisch opruimen van ID-kopieën

Na stap 5 is de module bruikbaar. Eerst een keer echt doorlopen met een
testmedewerker voordat testmodus uit gaat.

## Later, niet nu

- De andere mutatiesoorten
- Personeelsdossiers — beoordelingen, verzuim, documenten
- Toegang voor anderen dan Sander
- Iets uit Eitje halen of ernaartoe sturen

## Besloten op 22 augustus 2026

- Sollicitanten en medewerkers in één lijst, in twee groepen, met aannemen als
  overgang. Geen aparte sollicitatiemodule
- Einddatum alleen bij een contract voor bepaalde tijd
- Geen toets op het uurloon
- In het archief blijft alles zichtbaar, ook BSN en IBAN
- ID-kopie veertien dagen bewaren, daarna automatisch weg
- Testmodus staat standaard aan en gaat pas uit als Sander dat zegt
