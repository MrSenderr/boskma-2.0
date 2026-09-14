# Tablets in de zaak en de keuken

Vastgelegd op 26 augustus 2026. Twee tablets: één in de zaak voor de taken, één
in de keuken voor MEP, recepten en werkwijzen.

## Eén account, iedereen gebruikt hem

De tablet ligt in de zaak en iedereen pakt hem. Daar hoort geen persoonlijk
account bij: dan staat er iemands naam onder alles, en ligt de tablet eruit zodra
die persoon zijn wachtwoord wijzigt.

Daarom één account — `sander+tablet@boskmafoodservice.nl` — dat één doel dient:
ingelogd blijven. Eén keer inloggen met de code is genoeg; de sessie ververst
zichzelf zolang de tablet gebruikt wordt.

Het is een medewerkeraccount, dus er is geen toegang tot personeel, de kas of de
instellingen. En er staat **geen uitlogknop** in tabletmodus: één misklik en er
kan niemand meer bij tot iemand de inlogcode ophaalt. Uitloggen doe je door eerst
de tabletmodus uit te zetten.

`is_apparaat` houdt het account uit de personeelslijst. Meer doet die vlag niet
meer; de tabletmodus zelf hangt er niet aan.

## De tabletmodus hangt aan het adres

Open `nieuw.boskmafoodservice.nl/tablet` voor de algemene tablet, of `/keuken` of
`/zaak` voor een tablet die één ding doet. Vanaf dat moment staat de
app in tabletstand: alles fors groter, een kort menu, en bij elke handeling de
vraag wie het deed. De stand blijft staan, ook als je doorklikt naar een recept.
Uitzetten kan onderin het menu.

**Waarom aan het adres en niet aan het account.** De eerste opzet leidde dit af
uit het ingelogde account, met een vlag `is_apparaat` in de database. Dat moest
door drie lagen kloppen — database, API-cache, app — en liep steeds ergens anders
vast: de database klopte, de app klopte, en de laag ertussen gaf een verouderd
antwoord omdat PostgREST de vorm van functies in het geheugen houdt.

Met een adres is er één ding om te controleren, en je kunt het op elke telefoon
proberen met welk account dan ook. De apparaataccounts blijven werken voor wie ze
al ingericht heeft, maar ze zijn niet meer nodig.

## Wie legt het vast

**Bij elke handeling** vraagt de app wie het deed, met grote knoppen over het
hele scherm. Niet één keer bij binnenkomst: dan komt het werk van een collega die
er even bijkomt op jouw naam te staan.

Sander koos dat bewust boven een keuze die een tijdje blijft staan. De prijs is
een tik extra per handeling; bij een lange werklijst kan dat stroperig worden, en
dan zetten we er alsnog een korte nawerking in.

De namenlijst komt langs `wie_werkt_er()`, een functie die alleen een naam en een
nummer teruggeeft. Een tablet mag de personeelstabel niet lezen — daar staan
adressen, BSN's en lonen in.

Alles wat wordt vastgelegd komt op naam van de **gekozen** persoon: temperaturen,
werklijsten, MEP, leveringen, frituurvet en meldingen. Daarvoor is
`taak_zetten()` uitgebreid met een naam; die wint van de ingelogde gebruiker.

Het klaarzetten van de MEP voor morgen vraagt géén naam: dat is voorbereiden,
geen vastleggen van gedaan werk.

## Het menu per tablet

| Adres | In het menu |
|---|---|
| `/tablet` | Alles wat een medewerker doet |
| `/keuken` | Vandaag · MEP · Werkkaarten · Recepten · Werkwijzen |
| `/zaak` | Vandaag · Temperaturen · Taken · Melden · Levering · Frituurvet |

Staat vast in `TABLETMENU` in `src/lib/tabletmodus.ts`. Kort houden: een tablet
doet één ding, en hoe minder er staat hoe sneller je vindt wat je zoekt.

## Alles fors groter

Een tablet bekijk je van een meter afstand, met vette vingers. Omdat de hele app
in rem rekent was daar één regel voor nodig — de basisgrootte van 16 naar 21
pixels, en de rest schaalt mee. Ook de aanraakvlakken: die stonden in pixels en
zijn nu rem, anders bleven ze steken op 44 pixels terwijl de rest meegroeide.

Na drie minuten stilte gaat de tablet terug naar het beginscherm, zodat de
volgende die langsloopt schoon begint.

## Wat er bewust niet op een tablet hoort

**De kastelling.** Die hangt aan het recht `kas` en staat niet in het tabletmenu.
Een kastelling op naam van "wie er toevallig gekozen is" zou het tegenovergestelde
zijn van wat dat dossier moet doen.
