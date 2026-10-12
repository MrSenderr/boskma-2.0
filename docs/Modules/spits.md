# De avondspits indelen

Vastgelegd op 12 oktober 2026.

Vrijdag, zaterdag en zondag van 17 tot 20 draait de zaak op zes werkplekken:
kassa, patatbakker, snackbakker (twee man), chef keuken, runner en keukenhulp.
Dat zijn zeven paar handen. Wie waar het beste staat zat tot nu toe alleen in
Sanders hoofd.

## Wat erin gaat

Drie dingen:

1. **De planning.** Komt uit eitje en staat in `geplande_shifts`. Alleen wie er
   van 17 tot 20 is wordt ingedeeld. Wie om 19 uur weg moet staat apart op het
   scherm — die kun je er met de hand bij zetten, maar de app doet dat niet uit
   zichzelf. Iemand op de kassa die halverwege vertrekt is geen indeling.
2. **De werkplekken** (`werkplekken`). Per plek hoeveel mensen er staan en hoe
   hard de plek bezet moet zijn.
3. **Wat iemand kan** (`medewerker_werkplek`). Per medewerker per plek één van
   vier niveaus. Ingevuld door Sander, niet door de medewerker: dit is een
   beoordeling, geen wens. De wens staat bij de vaste dagen.

| Niveau | Betekenis |
| --- | --- |
| liefst | Hier staat hij het liefst en het best |
| kan | Gaat goed |
| nood | Alleen als het niet anders kan |
| nooit | Harde grens — hier wordt hij niet ingedeeld |

Geen regel betekent **onbekend**: nog niet beoordeeld. Dat is iets anders dan
"nood". De app mag het dan wel, maar zegt erbij dat het een gok is.

## Hoe de verdeling wordt gemaakt

Elke combinatie van persoon en plek krijgt punten:

```
punten = belang van de plek × 100 + hoe goed het past − boete voor herhaling
```

- **belang** staat per plek ingesteld, 1 tot 10. De tweede man op een plek weegt
  één punt lichter dan de eerste, zodat een tweede snackbakker niet vóór de chef
  gaat.
- **hoe goed het past**: liefst 60, kan 40, nood 15, onbekend 5. Op "nooit" komt
  er geen aanbod — die combinatie bestaat niet.
- **boete**: 3 punten per keer dat iemand bij de laatste vier spitsen al op die
  plek stond, tot maximaal 9.

Daar zitten twee regels in die je terug moet kunnen zien:

**Het belang weegt altijd zwaarder dan de match.** Honderd punten per stap is
meer dan het hele verschil tussen "liefst" en "onbekend". De kassa wordt dus
altijd eerder bezet dan de keukenhulp, ook als iemand de keukenhulp prachtig
vindt. Je draait een spits, geen wensconcert.

**De boete kan nooit een niveau omklappen.** Het kleinste gat tussen twee
niveaus is tien punten; de boete loopt tot negen. Afwisseling stuurt een keuze
bij, maar zet nooit iemand op een plek die hij alleen in noodgeval doet.

Alles wat mág levert punten op, ook "onbekend". Daardoor is een bezette plek
altijd beter dan een lege, en blijft er niemand voor niets langs de kant staan.

## Niet van boven naar beneden vullen

Er wordt echt gezocht naar de beste verdeling over de hele groep, niet plek voor
plek gevuld. Dat scheelt. Stel: Daan en Kate zijn allebei de beste kassa, en Kate
komt niet aan de patat. Vul je van boven naar beneden, dan pakt Daan de kassa en
blijft de patat leeg. De app zet Kate op de kassa en Daan aan de patat.

Technisch is dit een toewijzingsprobleem dat met dynamisch programmeren over de
bezette plekken wordt opgelost (`maakIndeling` in `src/lib/spits.ts`). Bij zeven
plekken is dat een kwestie van niets. Boven de zestien plekken zou het merkbaar
worden; dan vallen de onbelangrijkste af.

## Vastleggen

Het voorstel is geen indeling. Je gooit om wat je wil — per plek kies je iemand
anders, en wie je ergens anders neerzet laat zijn vorige plek los — en dan leg je
het vast in `spits_indeling`.

Dat vastleggen doet twee dingen. De medewerker ziet zijn eigen plek in zijn app
(alleen die van hemzelf, net als bij de shifts). En het is het geheugen voor de
afwisseling: zonder vastgelegde indelingen weet de app niet wie er al vier keer
runner was.

Een plek zonder regel is onbezet. Dat is een geldige uitkomst — zijn er maar vijf
mensen, dan blijven er twee plekken leeg — en er staat liever niets dan een lege
regel.

## Waar het staat

- `src/lib/spits.ts` — het rekenwerk en de vragen aan de database
- `src/lib/spits.test.ts` — de regels hierboven, als tests
- `src/pages/RoosterSpits.tsx` — de indeling per avond
- `src/pages/RoosterWerkplekken.tsx` — wie kan waar, en de plekken zelf
- `src/components/MijnPlek.tsx` — wat de medewerker ziet
