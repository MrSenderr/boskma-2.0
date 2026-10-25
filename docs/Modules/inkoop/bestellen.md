# Bestelvoorstel per leverdag

Gebouwd op 25 oktober 2026.

## Waarom

De inkoopmodule liet vooral zien wat er ooit is binnengekomen: facturen,
prijzen, stuksprijzen. Allemaal waar, en allemaal gegevens waar je op een
dinsdagochtend niets mee doet. Dit is de eerste pagina die een vraag
beantwoordt die er werkelijk is — wat moet er deze dinsdag besteld worden.

## Waarom het kan

De afleverdatum staat bij 96% van de factuurregels, en het patroon is scherp.
Sinds juli 2026, over zestien weken gemeten:

| Dag | Leverdagen | Regels | Inkoop |
|---|---|---|---|
| Dinsdag | 16 | 577 | € 16.729 |
| Donderdag | 16 | 534 | € 22.602 |
| rest samen | 22 | 156 | € 3.971 |

Dinsdag en donderdag zijn de leverdagen; de rest is losse aanvulling. Een
dinsdaglevering lijkt op andere dinsdagen, niet op de donderdag ervoor — daarom
gaat alles per weekdag.

## Hoe het rekent

`inkoop.bestelpatroon` telt per weekdag en artikel over de laatste twaalf
weken: hoe vaak het op een leverdag van die soort stond, en hoeveel er dan
gemiddeld van kwam. Emballage telt niet mee; statiegeld is geen bestelling.

Het gemiddelde is per kéér dat je het bestelde, niet per leverdag. Anders zakt
iets wat je om de week neemt weg in het voorstel.

De view stelt niets voor en bestelt niets. Hij telt wat er is gebeurd; wat
daarvan een voorstel wordt bepaalt het scherm.

## Keuzes in het scherm

**Twee lijsten.** Wat op minstens de helft van de leverdagen voorkwam staat
aangevinkt klaar; de rest staat eronder, uit, als geheugensteun. Alles in één
lijst zou betekenen dat je honderdzeventig regels naloopt om er twintig over te
houden.

**Naar boven afgerond, op halven, nooit onder één.** Te weinig betekent dat je
het op zaterdag niet hebt; te veel dat het een week langer ligt. Het precieze
gemiddelde staat ernaast, zodat je ziet waar het voorstel vandaan komt.

**Een dag telt pas als leverdag bij drie keer in twaalf weken.** Er staan losse
aanvullingen in de gegevens — één woensdag, een paar zondagen — en daar bouw je
geen voorstel op.

**Per leverancier gegroepeerd**, op het scherm en in de gekopieerde lijst: je
bestelt bij Veldboer en bij Het Grootslag apart.

## Wat het niet doet

Bestellen. De app weet niet wat er nog in de vriezer ligt, dus het voorgestelde
aantal is een beginpunt en geen uitkomst. Er komt een lijst uit die je kopieert
en doorgeeft langs de weg die je al gebruikt.

Het geschatte bedrag staat op de laatst bekende prijs; acties en
prijsstijgingen zitten er niet in.
