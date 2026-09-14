# Module: HACCP en schoonmaak

Dagelijkse registratie van temperaturen, schoonmaak en leveringen in Snackerie
't Zonnetje. Doel: aantoonbaar voldoen aan de Hygiënecode voor de Horeca, met
minder werk dan papier — niet met meer.

## Afbakening

| | |
|---|---|
| Registreert | elke medewerker, onder eigen naam |
| Beheert en sluit af | Sander; later eventueel aangewezen personen |
| Plek | webapp op de eigen telefoon; later dezelfde app op een vaste tablet |
| Grondslag | Hygiënecode voor de Horeca |
| Onderdelen | temperaturen, schoonmaak- en openings/sluitingstaken, frituurvet, leveringen |

Wat er **niet** in komt: mise en place, recepten, voorraad, allergenenbeheer.
Die kunnen later, maar ze verwateren nu de kern. Een registratiemodule die te
veel wil, wordt niet gebruikt.

## Waarom de telefoon eerst en de tablet later

Er hangt geen tablet, en dat is de enige reden dat de bestaande module stilstaat.
Wachten op hardware kost maanden; iedereen heeft al een telefoon op zak.

De telefoon is bovendien inhoudelijk beter voor dit doel:

- de meting wordt gedaan **bij het apparaat**, niet achteraf uit het hoofd bij
  een scherm aan de muur;
- iedereen registreert onder **zijn eigen naam**, automatisch. Bij een gedeelde
  tablet met pincodes tekent in de praktijk één iemand alles af.

De tablet komt er later bij als vaste plek voor de dagelijkse lijst. Dezelfde
app, groter scherm, geen extra bouwwerk.

## Alles instelbaar, niets in de code

**Uitgangspunt, vastgelegd op 23 augustus 2026:** geen enkel apparaat en geen
enkele taak staat in de code. Sander voegt ze zelf toe, wijzigt ze zelf en zet ze
zelf uit, via een beheerscherm. Komt er een vriezer bij, dan hoeft daar niemand
voor gebeld te worden.

De toets: een ander bedrijf zou deze module moeten kunnen inrichten zonder dat er
één regel code verandert. Dat is de meetlat, niet het doel — er komt géén
systeem waar meerdere bedrijven tegelijk in zitten. Eén zaak, volledig zelf in
te richten.

Per apparaat is instelbaar: naam, soort, ondergrens, bovengrens, wanneer er
gemeten wordt, volgorde in de lijst, en of hij actief is. Bij het kiezen van een
soort vult de app alvast gangbare grenzen in, die je kunt overschrijven — zodat
je niet vanaf nul begint, maar ook niet vastzit aan wat ik bedacht heb.

Een apparaat dat weggaat wordt op non-actief gezet, niet verwijderd: anders
verdwijnen de metingen van vorig jaar uit je logboek.

De bestaande tabel `haccp_apparaten` ondersteunt dit al — naam, type, actief,
min_temp, max_temp en volgorde staan er per apparaat in. Alleen de meetmomenten
moeten er nog bij.

## De apparaten van 't Zonnetje

Puur ter illustratie — dit is invoer die Sander zelf intikt zodra het
beheerscherm er is. Er hoeft niets van in de code.

Koelcel, Vriescel, Werkbank, Vriezer werkbank, Koeling inpak, Vitrine (koud).

**Standaard meetmoment: bij opening.** Per apparaat aan te passen, mocht er ooit
eentje ook bij sluiting gemeten moeten worden.

Voorstel voor de grenzen die de app alvast invult bij een soort, allemaal te
overschrijven:

| Soort | Ondergrens | Bovengrens |
|---|---|---|
| Koeling | 0 °C | 7 °C |
| Vriezer | −25 °C | −18 °C |
| Warmhoudunit | 60 °C | — |

7 °C is de bovengrens voor gekoelde producten. Wie zelf 4 °C aanhoudt, merkt een
wegzakkende koeling dagen eerder. Dat is een keuze per apparaat, geen keuze van
de app.

## Frituurvet

**Vastgelegd op 24 augustus 2026, na navraag bij Sander.** Wat hieronder eerst
stond — een verversdatum per pan — klopte niet met hoe het in de zaak gaat.

Er staat een filtersysteem met **drie pannen** en een pomp. Bij één handeling
schuift alles een plek op:

- pan 1 gaat naar de afgewerktvetbak;
- pan 2 wordt doorgepompt naar pan 1;
- pan 3 wordt doorgepompt naar pan 2;
- pan 3 wordt gevuld met verse olie.

Daarom legt de app **niet per pan een verversdatum** vast, maar het doorschuiven
zelf: één knop, datum en wie. Uit die momenten volgt de rest.

Wat er per pan uit te rekenen valt, en wat niet:

- **Hoe lang de olie in déze pan zit** zegt niets. Bij een doorschuif krijgen
  alle pannen tegelijk nieuwe inhoud, dus dat getal is voor alle drie hetzelfde.
- **Hoe lang de olie in totaal meedraait** zegt wél iets. De olie in pan 3 ging
  vers het systeem in bij het laatste doorschuiven, die in pan 2 bij het
  doorschuiven daarvoor, die in pan 1 bij het doorschuiven daarvóór. Het getal
  van pan 1 is de totale looptijd van een lading olie — dat is waar bij een
  controle naar gekeken wordt.

Staat er nog niet genoeg vastgelegd, dan blijft het leeg. Een verzonnen datum is
erger dan geen datum.

**Geen vast ritme.** Sander schuift door als het nodig is, dus de app herinnert
er niet aan en zeurt niet over een termijn. Hij legt vast wat er gebeurt.

**Geen meting en geen beoordeling erbij.** Alleen datum en wie. Testen met
strips kan later alsnog; eerst het ritme vastleggen. De gangbare norm is
vervangen bij 25% polaire stoffen, maar dat moet Sander toetsen aan zijn eigen
hygiënecode voordat de app er iets over beweert.

Drie pannen ligt vast in `AANTAL_PANNEN` in `src/lib/frituurvet.ts` — één getal,
zodat een vierde pan geen verbouwing is. Sander koos hier bewust voor vast boven
instelbaar, in het besef dat dit niet meeverhuist naar een andere zaak.

De bestaande olieregistratie in de app gaat over prijsafspraken met de
leverancier. Dat is inkoop, geen HACCP. Blijft gescheiden.

## Leveringen

**Vastgelegd op 24 augustus 2026.** Dit gebeurde nog niet, dus geldt één
ontwerpregel boven alle andere: **het moet in drie handelingen klaar zijn**,
anders gebeurt het na twee weken niet meer.

Per levering: **leverancier, temperatuur, aangenomen of geweigerd**. Meer niet.
Sander koos bewust tegen het aanvinken van producten en tegen een foto van de
vrachtbrief — dat maakt het langer, en dan gebeurt het niet.

De leverancier komt uit een lijstje dat vanzelf groeit uit wat er eerder is
ingetikt, dus de tweede keer Sligro is één tik.

**Bij geweigerd is een reden verplicht.** Een geweigerde levering zonder reden is
later niet uit te leggen; daarom laat het scherm je niet aftekenen zonder.

Datum en wie het deed vult de app zelf in. Wijzigen en weggooien kan niet: wat je
hebt afgetekend blijft staan.

Een levering komt op een willekeurig moment binnen. Het is dus geen taak die af
moet, maar een knop die er altijd is — onder *Tussendoor* op Vandaag.

Voorstel voor de grenzen, nog te toetsen aan de hygiënecode: gekoeld ten hoogste
7 °C, diepvries ten hoogste −15 °C bij ontvangst. De app rekent daar nu nog niets
mee; hij legt vast wat je invult en of je het hebt aangenomen.

## De drie werklijsten

Negen papieren lijsten worden er drie. Vastgelegd op 23 augustus 2026.

| Lijst | Komt uit | Taken |
|---|---|---|
| **Openen** | Openlijst front + Openlijst keuken | 21 |
| **Voorbereiden** | Spitsvoorbereiding + Overdaglijst keuken | 23 |
| **Sluiten** | Sluitlijst front + Sluitlijst keuken | 63 |

De spitslijst gold alleen op vrijdag, zaterdag en zondag; die wordt dagelijks.

**Hoeken.** Elke lijst is verdeeld in hoeken, en per hoek tekent iemand af. Zo
ziet niemand 63 taken — je kiest je hoek en ziet er tien à twaalf. Dat werkt op
papier al zo bij de sluitlijst; dat nemen we over.

- Openen: keuken · bakwand en vitrine · balie en kassa · zaak en buiten
- Voorbereiden: bakwand en frituur · vitrine en balie · keuken · kassa
- Sluiten: bakwand · ijshoek · koffiehoek · vitrine en inpakbalie · gastgedeelte ·
  keuken · afsluiten (kassa, alarm, sloten)

Dat laatste blok doet degene die daadwerkelijk afsluit.

**Wat géén vierde lijst wordt.** De weeklijst met dieptaken (16 taken) wordt een
ritme, geen lijst: die taken verschijnen vanzelf onderaan de lijst van de dag
waarop ze aan de beurt zijn. Op papier heb je daar een los vel voor nodig, in een
app niet. Het terras wordt een hoek die met het seizoen aan en uit gaat.

**De temperatuurtaak is geen vinkje.** Stap 1 van de keuken-openlijst is
"temperatuur koeling + vries controleren en noteren". Daarop tikken opent het
meetscherm. Afvinken zonder gemeten te hebben kan dus niet.

**Toelichtingen blijven staan.** "Vanuit vitrinekoeling", "ca. 45 min preventief
starten", "op zondag in de olie" — daar zit de kennis in. Die staan onder de
taak, net als op papier.

## Afwijkingen: het hart van de module

Een inspecteur kijkt niet naar de meting. Hij kijkt naar wat je deed toen de
meting niet klopte.

Daarom: zodra een waarde buiten de grens valt, gaat de registratie niet dicht.
De app vraagt door:

1. **Wat heb je gedaan?** Thermostaat bijgesteld, deur stond open, product
   weggegooid, monteur gebeld. Keuze uit een lijst, met ruimte voor eigen tekst.
2. **Hermeting.** De app zet een herinnering klaar voor over een uur.
3. **Melding aan Sander**, direct.

Blijft hetzelfde apparaat afwijken, dan hoort daar op termijn automatisch een
storingsmelding uit te rollen richting de onderhoudsmodule. Nu nog niet bouwen,
wel zo inrichten dat het kan.

Dit is meteen het sterkste argument om van papier af te stappen: een papieren
lijst stelt die vervolgvraag nooit.

## Eén app, twee gezichten

Vastgelegd op 23 augustus 2026.

De beheerapp en de medewerkersapp zijn **dezelfde app**. Wat je ziet hangt af van
wie er inlogt:

| Wie | Ziet |
|---|---|
| Medewerker | alleen de takenlijst en de registraties van vandaag |
| Sander | beheer, logboek en cijfers — plus een knop *werk als medewerker* |

Sander tekent dus af in hetzelfde scherm als zijn personeel, want anders test hij
nooit wat zij zien. Aftekenen en temperaturen registreren horen bij het
medewerkersgezicht, niet bij het beheer.

Beheer is: apparaten en taken aanmaken, het logboek inzien, exporteren en de
cijfers bekijken. Daar wordt niets afgetekend.

**Inloggen gaat zonder wachtwoord.** Een medewerker vult zijn mailadres in,
krijgt een link, klikt en is binnen — daarna blijft hij ingelogd. Niemand kan een
wachtwoord vergeten, en het kost niets. Later omzetten naar een code per sms is
één instelling; de rest van de app verandert daar niet van.

## Wie mag wat

| Rol | Mag |
|---|---|
| Medewerker | registreren; eigen registraties van vandaag en deze week inzien |
| Aangewezen persoon | daarnaast afwijkingen afhandelen en de week afsluiten |
| Eigenaar | alles, plus beheer van apparaten en taken, en export |

De rol "aangewezen persoon" wordt meteen gebouwd maar staat voorlopig op
niemand. Later toewijzen is dan een vinkje, geen verbouwing.

## Regels die vastliggen

Deze zijn niet onderhandelbaar, want hierop staat of valt de bewijskracht.

- **De tijd komt van de server.** Nooit van het toestel; een klok is te verzetten.
- **Er wordt niets verwijderd.** Een fout wordt gecorrigeerd, en de correctie is
  zichtbaar met wie hem maakte en wanneer. Een logboek waar dingen uit kunnen
  verdwijnen is geen logboek.
- **Alles staat op naam.** Inloggen per persoon, geen gedeeld account.
- **Achteraf invullen mag, maar is zichtbaar.** Een registratie die later wordt
  toegevoegd dan het moment waarop hij hoort, krijgt die aantekening. Verbieden
  heeft geen zin — verbergen wel schade.
- **Offline werkt.** Invoeren lukt altijd; de app synchroniseert zodra er
  verbinding is, met het werkelijke tijdstip van invoer.

## Uitdraai voor een controle

**Vastgelegd op 24 augustus 2026.** Periode kiezen, alles erin, klaar om te
overhandigen: temperaturen met afwijkingen en wat eraan gedaan is, werklijsten,
leveringen, frituurvet en de afgetekende weken.

**Een afdrukbare pagina, geen bestand van de server.** Sander vroeg om wat het
meest failsafe is, en dat is dit: hoe minder onderdelen er stuk kunnen op het
moment dat er iemand voor je neus staat, hoe beter. Afdrukken of "bewaar als
PDF" zit in elke browser en op elke telefoon.

Twee regels die daarbij vastliggen:

- **Niet stilzwijgend afkappen.** Supabase geeft standaard duizend regels terug.
  Een uitdraai over maanden leest door tot het op is. Een document dat er
  compleet uitziet maar het niet is, is het ergste wat hier kan gebeuren.
- **Een ontbrekend deel zegt dat.** Kan een onderdeel niet opgehaald worden, dan
  staat er een rood kader op die plek — ook op papier. Liever een zichtbaar gat
  dan een stil gat.

Bij de werklijsten staat per dag hoeveel er per lijst is afgevinkt, niet elke
losse taak. Elke tik apart zou over drie maanden tienduizenden regels worden; wie
één dag wil natrekken vindt die in het logboek in de app.

## Weekafsluiting

**Vastgelegd op 24 augustus 2026.** De app zet het overzicht klaar, Sander tikt
het af — hij koos allebei, niet één van beide.

Per week: hoeveel er per dag per ronde gemeten is, alle afwijkingen met de
afhandeling, hoeveel taken er zijn afgevinkt, de leveringen en het frituurvet.
Onderaan één knop: *Ik heb deze week nagekeken*, met datum en op naam.

Dat aftikken ís de handtekening van de leiding die de hygiënecode vraagt. Alleen
Sander kan het, en dat staat in de database vast — niet in het scherm.
Terugdraaien kan niet.

Eén eerlijkheidsregel staat op het scherm zelf: hoeveel er gemeten hád moeten
worden, wordt afgeleid uit de apparaten zoals ze nu staan. Is er later een
koeling bijgekomen, dan lijkt het alsof die er die week ook al stond.

## Schermen op de telefoon

**Vandaag** — het startscherm. Wat er nu nog moet, meer niet. "Openingsronde:
3 van 6." Grote knoppen, geen menu's. Wie klaar is, ziet dat in één blik.

**Temperaturen** — de zes apparaten onder elkaar, per stuk één veld met een
cijfertoetsenbord. Direct groen of rood na het intikken. Bij rood volgt meteen
de vervolgvraag; anders schuift hij door naar het volgende apparaat.

**Taken** — de lijst van vandaag, aftikken met een grote raakvlak. Opmerking en
foto optioneel.

**Levering** — drie velden, zoals hierboven.

**Mijn registraties** — wat ik vandaag en deze week heb gedaan. Alleen van
jezelf, zodat mensen kunnen nakijken wat ze al deden.

Het beheer (apparaten, taken, logboek, export, weekafsluiting) blijft op de
laptop. Dat hoeft niet op een telefoon.

## Wat er al ligt

Het datamodel staat er en is bruikbaar: `haccp_apparaten` met grenzen per
apparaat, `haccp_taken` ingedeeld naar opening, sluiting, mise en place en
schoonmaak dagelijks/wekelijks met voorkeursdag, `haccp_temps`,
`haccp_checklists`, `haccp_leveringen`, `haccp_week_status` en `employee_pins`.
Het beheerscherm bestaat ook al.

Wat ontbreekt: de registratiekant op de telefoon, de afwijkingsafhandeling, het
frituurvet, de export — en het slot. Alle HACCP-tabellen staan nu open voor
iedereen met de publieke sleutel.

## Bouwvolgorde

1. Beheerscherm voor apparaten en taken. Eerst, want zonder dat is er niets om
   op af te tekenen — en het is meteen de proef of er echt niets vastzit in de
   code.
2. Inloggen per persoon. Zonder dit heeft een registratie geen bewijskracht.
3. Temperaturen. De grootste dagelijkse last, dus de snelste winst.
4. Taken en schoonmaak.
5. Afwijkingen: vervolgvraag, hermeting, melding.
6. Leveringen.
7. Frituurvet.
8. Weekafsluiting en export.

Na stap 4 is de module bruikbaar in de zaak. Dan eerst een maand echt draaien
voordat de rest erbij komt.

## Later, niet nu

- Vaste tablet aan de muur, dezelfde app.
- Mise en place en recepten.
- Automatische storingsmelding naar de onderhoudsmodule bij herhaalde afwijking.
- Allergenen.

## Beantwoord op 23 augustus 2026

- Afbakening klopt: zelf inrichten ja, meerdere bedrijven in één systeem nee
- Vitrine is koud — maar dat tikt Sander zelf in, de app hoeft het niet te weten
- Standaard meetmoment: bij opening
- Drie friteuses, er wordt nu nog niet getest
- De hygiënecode is niet als PDF beschikbaar. Daarom levert de app een
  **startlijst** met gangbare horecataken die Sander zelf aanpast. Die lijst is
  mijn beste algemene kennis, geen officiële bron — hij moet hem naast zijn
  eigen hygiënecode leggen voordat hij erop vertrouwt. Omdat alles toch al zelf
  in te richten is, blokkeert dit niets.
