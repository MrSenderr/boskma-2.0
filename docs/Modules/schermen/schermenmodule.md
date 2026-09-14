# Schermenmodule

Vastgelegd op 24 augustus 2026, na een vragenronde met Sander.

## Wat het is

Zes schermen in de zaak. Op elk draait `dist/signage.html` op een Raspberry Pi.
Dat pagina'tje haalt elke **dertig seconden** op wat het moet tonen en meldt zich
in dezelfde beweging (`screens.last_seen`).

## Wat er gekozen is

| Vraag | Keuze |
|---|---|
| Hoe vul je een scherm | Eén vaste afbeelding. Geen diavoorstelling meer aanmaken. |
| Zes schermen samen of los | Elk scherm apart. Geen sets voor de hele wand. |
| De 29 bestaande afbeeldingen | Bibliotheek houden, met mappen erbij. |
| Extra's | Alleen zien of een scherm nog leeft. Geen herstart- of verversknop. |

## Twee dingen uit de schermcode die de vorm bepalen

**Een reeks wint van een vast beeld.** In `signage.html` staat:

```js
if (!stappen.length && screen && screen.length) { … toon actieve_afbeelding_url … }
```

Staan er actieve regels in `screen_rotatie`, dan kijkt het scherm dus niet naar
`screens.actieve_afbeelding_url`. Zonder waarschuwing zou je in het beheer een
afbeelding kiezen en zou er niets gebeuren — precies het soort fout waarbij je
gaat denken dat de app stuk is.

Daarom: op een scherm met een lopende reeks staat een oranje balk met een knop
**Reeks stoppen**. Dat zet `actief = false` op die regels; het gooit ze niet weg.
De kermisreeks van zestien beelden op scherm 3 blijft dus bewaard en kan volgend
jaar weer aan met één knop.

**Dertig seconden betekent iets.** Vier rondjes overslaan doet een scherm niet
zomaar, dus twee minuten stilte is een betrouwbaar teken dat er iets hangt. Die
grens staat als `STIL_TE_LANG` in `src/lib/schermen.ts`, afgeleid van het
meldritme — niet als los verzonnen getal.

## Afbeelding weghalen haalt hem niet uit de opslag

De rij uit `screen_images` gaat weg, het bestand blijft staan. Er kan een scherm
of een bewaarde reeks naar wijzen die niet in dit overzicht zichtbaar is, en een
zwart scherm boven de balie is erger dan een ongebruikt bestand in de opslag.
Staat een afbeelding op een scherm, dan zegt het scherm dat voordat je hem
weghaalt.

## Wat er niet in zit

- `screen_schedules` (afbeelding per tijdslot) — leeg, nooit gebruikt.
- `screen_commands` (herstarten en verversen op afstand) — bestaat aan de Pi-kant
  en blijft werken, maar heeft geen knop in het nieuwe beheer. Sander koos ervoor
  om erheen te lopen als er iets hangt.
- Nieuwe reeksen aanmaken. Bestaande reeksen kun je stoppen en weer starten, maar
  er komt er geen bij. Wil je dat ooit toch, dan is het `screen_rotatie` met
  `volgorde` en `seconden` — de tabel kan het al.
