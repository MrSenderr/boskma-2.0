# Mise en place

Vastgelegd op 24 augustus 2026, naar het papieren formulier
*Mise en place - keuken*.

## Hoe het gaat

Aan het eind van de dag vinkt **wie er sluit** aan wat er de volgende opendag
klaargemaakt moet worden, met **hoeveel** ("2 bakken") en **wat er bijzonder
aan is** ("weinig pinda's meer"). Onderaan een vak voor opmerkingen die voor de
hele dag gelden.

De volgende dag werkt de keuken de lijst af en tikt aan wat af is, **met naam
erbij**. Sander koos dat bewust: handig om iets terug te zoeken, met het besef
dat het ook kan voelen als meekijken.

**Wat niet af komt blijft staan.** Een open taak van gisteren komt vandaag weer
op de lijst, met de datum erbij. Er verdwijnt niets omdat de dag om is.

## Niet "morgen" maar de volgende opendag

De zaak is maandag dicht. Op zondagavond gaat de lijst dus over **dinsdag**, en
dat staat er voluit — "morgen" zou hier stelselmatig fout zijn. Zie
[openingstijden](openingstijden.md).

## De lijst

Zeventien taken, in groepen: snijwerk, warm, sauzen, snacks, overig. Wie het
recht `mep` heeft kan taken toevoegen, hernoemen, groeperen en uitzetten. IJs in
de winter uit, in de zomer weer aan; uitzetten gooit niets weg.

## Wat er in de database gebeurde

De tabellen `mep_sjablonen` en `mep_dag_taken` bestonden al voor de tabletapp en
zijn hergebruikt in plaats van er een tweede stel naast te zetten. De kolommen
`herhaling`, `weekdagen` en `tweewekelijks_pariteit` gingen ervan uit dat de app
zelf een dagelijst genereert. Zo werkt het hier niet; die kolommen blijven staan
maar worden niet gebruikt.

In `mep_sjablonen` stonden twintig rijen uit die tabletapp, met drie dubbelingen
en een paar typefouten:

| Stond er | Werd |
|---|---|
| Berehappen maken *(naast* Berenhappen maken*)* | uitgezet als dubbel |
| Pindas saus maken *(naast* Pindasaus maken*)* | uitgezet als dubbel |
| Sla snijden *(twee keer)* | tweede uitgezet |
| Bieslook | Bieslook snijden |
| Rode ui | Rode ui snijden |
| Uien karamelliseren | Uien karameliseren |
| Pindas saus portioneren | Pindasaus portioneren |

De dubbelingen zijn eerst uitgezet, omdat er oude dagelijsten naar bleken te
verwijzen — negenendertig stuks. Op verzoek van Sander zijn ze daarna alsnog
verwijderd. Dat kan veilig: `mep_dag_taken` bewaart de naam in een eigen kolom en
de verwijzing staat op `ON DELETE SET NULL`, dus een oude lijst blijft leesbaar
en alleen het draadje naar de vaste lijst valt weg.

Om dezelfde reden zit er een prullenbak bij elke taak in het beheerscherm: wie
het recht `mep` heeft kan een taak weggooien zonder dat er geschiedenis
verdwijnt. Wie hem alleen even niet wil zien, gebruikt *uitzetten*.

`datum` in `mep_dag_taken` is de dag **waarvóór** het werk is, niet de dag dat
het is aangevinkt. Dat onderscheid is het hele idee van dit scherm.
