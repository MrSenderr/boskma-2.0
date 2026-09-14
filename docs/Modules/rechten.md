# Rechten

Vastgelegd op 24 augustus 2026.

Tot dan waren er twee soorten mensen: Sander (`is_app_user()`) en medewerkers.
Voor de recepten was daar een tussenvorm voor nodig — "jij en wie je aanwijst".

## Losse vinkjes, geen rollen

Per medewerker aan of uit:

| Recht | Wat het geeft |
|---|---|
| `recepten` | Recepten schrijven en aanpassen. Lezen mag iedereen al. |
| `mep` | De vaste voorbereidingslijst beheren. |
| `haccp` | Apparaten en werklijsten aanpassen. Metingen doen mag iedereen al. |

Sander koos vinkjes boven rollen: wie de recepten bijhoudt hoeft daarom nog niet
bij de werklijsten te kunnen.

## Waar de grens ligt

In de database, in `heeft_recht(recht)`. Die functie geeft true als je
`is_app_user()` bent óf als er voor jou een rij in `medewerker_rechten` staat.
De RLS-regels van `mep_sjablonen`, `recepten` en `recept_fotos` roepen hem aan.

De schermen verbergen alleen knoppen. Dat is voor het gemak, niet voor de
veiligheid — een verborgen knop houdt niemand tegen, een RLS-regel wel.

## Wat er níét onder valt

Personeel, instellingen, schermen en de weekafsluiting blijven van Sander alleen.
Daar is geen vinkje voor, en dat is met opzet: dat zijn de plekken met
persoonsgegevens en met zijn handtekening eronder.


## Wat iemand in zijn menu ziet

Vastgelegd op 26 augustus 2026. Los van de rechten hierboven, en met een ander
doel: **dit ruimt een menu op, het sluit niets af.**

Per medewerker een vinkje voor Temperaturen, Taken, MEP, Werkkaarten, Recepten,
Werkwijzen, en de drie knoppen onder *Tussendoor* (levering, frituurvet, melden).
Vandaag, Mijn gegevens en Mijn dossier staan er altijd — die zijn van hem.

**Uitgezet betekent: niet in het menu, wel bereikbaar.** Staat Recepten uit, dan
werkt de knop *Recept* bij een MEP-taak gewoon, en wie het adres intikt komt er
ook. Dat is met opzet: iemand achter de balie hoeft geen receptenboek in zijn
menu, maar als hij toevallig pindasaus maakt moet die uitleg er wel zijn.

Daarom staat er ook geen route-slot omheen. Zou dat er wel zijn, dan liep je bij
zo'n knop tegen een dichte deur — en dat is precies het tegenovergestelde van wat
dit moet doen.

De tabel `medewerker_verborgen` bewaart wat er **weg** moet, niet wat er mag.
Daarmee ziet een nieuwe medewerker vanzelf alles, en is dit een uitzondering die
je bewust maakt in plaats van een lijst die je bij iedere nieuwe medewerker moet
aanvinken.
