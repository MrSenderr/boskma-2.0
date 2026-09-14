# Boskma 2.0

De nieuwe beheerapp voor Boskma Foodservice, handelend onder Snackerie
't Zonnetje in Wervershoof. Vervangt op termijn de oude app in `../boskma-app`.

## Waarom deze app opnieuw is opgezet

De oude app is één HTML-bestand van 16.000 regels dat bij elke klik het hele
scherm opnieuw opbouwt, met alle gegevens in één JSON-blob in de database. Van
de vijftien modules waren er twee daadwerkelijk in gebruik. Daarom geen
verbouwing maar een nieuwe start, met alleen wat gebruikt wordt.

De volledige analyse staat in `docs/stijlboek.html` (huisstijl) en
`docs/Modules/haccp/haccpmodule.md` (eerste grote module).

De CAO, het functiehandboek en de loontabel staan niet hier maar in Google Drive,
onder `Boskma Foodservice / 05 Personeel`. Dat zijn documenten van derden die
periodiek vervangen worden; die horen niet in een repo.

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · React Router · TanStack Query ·
supabase-js. Fonts via `@fontsource` (zelf gehost, geen CDN). Iconen via
`lucide-react` (SVG-componenten, geen icoon-font).

Geen enkele afhankelijkheid wordt tijdens gebruik van een vreemde server
geladen. Dat was in de oude app wél zo en dat brak zodra een CDN hikte.

## Regels

**Geen losse kleuren of maten in schermen.** Alles komt uit `src/index.css`
(tokens) en `src/components/ui.tsx` (bouwstenen). Staat er een hexcode of een
losse `px` in een pagina, dan ontbreekt er een component.

**Licht en donker allebei.** De tokens schakelen mee; schermen gebruiken alleen
tokennamen (`bg-surface`, `text-muted`). Nooit een kleur die maar in één thema
klopt. Uitzondering: het inlogscherm is altijd petrol.

**Aanraakbaar.** Minimaal 44px hoog voor alles wat je aan kunt raken. Staat als
basisregel in `index.css`.

**Selecteer alleen wat je toont.** Vooral bij `sollicitaties`: `onboarding_data`
bevat BSN en IBAN en hoort alleen in het ene scherm waar het echt nodig is.

**Nederlands in de code.** Namen van componenten, variabelen en mappen zijn
Nederlands, net als de taal van de app. Alleen begrippen uit de bibliotheken
blijven Engels.

## Database

Dezelfde Supabase als de oude app (`xukzumqddeateztmjpzf`). Sinds augustus 2026
laten de RLS-policies alleen een ingelogde gebruiker toe die op de lijst staat in
`public.is_app_user()`. Iemand toegang geven = die functie aanpassen én een
account aanmaken onder Authentication → Users.

De publieke sleutel mag in de bundel staan; die geeft in zijn eentje nergens
meer toegang toe.

Nieuwe tabellen komen als migratie in `supabase/migrations`. Die map is op
14 september 2026 vanuit `../boskma-app` hierheen verhuisd, samen met de twintig
edge functions in `supabase/functions`.

## Verzamelaars

Een browser-app verzamelt alleen als er een scherm openstaat. Dat is hoe de
weerreeks in `dagboek_dagen` op 24 augustus 2026 stilviel: de oude app vulde
hem, en die werd niet meer geopend. Twintig dagen weg voordat het opviel.

Wat op een schema moet draaien hoort daarom in een edge function met een
cronjob, niet in een scherm. `weer-verzamelen` is het voorbeeld: hij kijkt elke
ronde de hele reeks na in plaats van alleen de laatste dag, zodat een gat zich
de volgende ochtend vanzelf dicht.

## Wat er nog niet in zit

- HACCP en schoonmaak (spec ligt klaar)
- De rest van de personeelsketen: gegevenslink versturen, loonbureau, contract
- Apparatuur en onderhoud
- De app voor medewerkers
