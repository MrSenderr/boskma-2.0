# Personeelsdossier-module — boskma-app

Overdrachtsdocument, opgesteld 27 augustus 2026, dezelfde dag bijgewerkt na een
inventarisatie van wat er al gebouwd was. De schermen komen in `boskma-2.0`, de
migraties in `boskma-app/supabase/migrations`. Zie hoofdstuk 4.

---

## 1. Besluit en aanleiding

De personeelsdossiers staan nu verspreid in iCloud Drive
(`Snackerie 't Zonnetje/06 Medewerkers/`, 51 bestanden, één map per medewerker).
Dat werkt niet: contracten zijn grotendeels niet getekend, loonheffingsverklaringen
ontbreken bijna overal, er staan duplicaten en de mapstructuur is inconsistent.

**Besluit:** alles rond medewerkers gaat naar boskma-app op de eigen VPS.
iCloud wordt géén bronsysteem meer — de app is de enige waarheid. De oude
Kai-documenten blijven in iCloud staan als archief.

Overwogen en afgevallen: een fswatch-watcher op de MacBook die iCloud naar de app
synct. Werkt alleen als de laptop aan staat, en iCloud-placeholders (dataless files)
leveren lege bestanden op. Bovendien is een consumenten-iCloud zonder
verwerkersovereenkomst geen nette plek voor loonheffingsverklaringen en ID-kopieën.

---

## 2. Huidige situatie — 11 medewerkers

| Medewerker | Contract | Getekend | Loonheffings­verklaring | ID-kopie |
|---|---|---|---|---|
| Brian Geusebroek | 16-07-2026 | ❌ | ✅ | ❌ |
| Daan Verhulst | 04-05-2026 | ❌ | ❌ | ❌ |
| Denzel Raven | ⚠️ alleen Kai (25-03-2026) | ❌ | ❌ | ❌ |
| Evi Dudink | 16-07-2026 | ✅ | ❌ | ❌ |
| Ilona Swagerman | ⚠️ alleen Kai (25-05-2025) | ❌ | ❌ | ❌ |
| Jasper Wijdenes | 16-07-2026 | ❌ | ❌ | ❌ |
| Joost van Geest | 04-05-2026 (.docx) | ❌ | ❌ | ❌ |
| Justin Oostwoud | 16-07-2026 | ✅ | ❌ | ❌ |
| Kate Houtenbos | 25-07-2026 | ✅ | ❌ | ❌ |
| Lenthe Deen | 04-05-2026 | ❌ | ❌ | ❌ |
| Thijmen Bakker | 04-05-2026 | ❌ | ❌ | ❌ |

**Prioriteit zodra de module draait:**

1. Denzel en Ilona hebben nog geen contract onder V.O.F. Boskma Foodservice —
   die lopen formeel nog op papier van Kai.
2. 8 van de 11 contracten zijn niet getekend (of de getekende versie is nooit
   gearchiveerd).
3. 10 van de 11 loonheffingsverklaringen ontbreken.
4. Geen enkele ID-kopie aanwezig, terwijl je die als werkgever moet bewaren.

---

## 3. Migratie uit iCloud — 18 bestanden

Basispad: `iCloud Drive/Snackerie 't Zonnetje/06 Medewerkers/`

| # | Medewerker | Categorie | Bronbestand |
|---|---|---|---|
| 1 | Brian Geusebroek | contract | `Brian Geusebroek/Arbeidscontract B Geusebroek.pdf` |
| 2 | Brian Geusebroek | loonheffingsverklaring | `Brian Geusebroek/model_opgaaf_gegevens_loonheffingen_lh0082z11fol 2026.pdf` |
| 3 | Brian Geusebroek | overig | `Brian Geusebroek/Aanvraag Werkkostenregeling/Aanvraagformulier LKS werkgever 2026 WerkSaam WF.pdf` |
| 4 | Daan Verhulst | contract | `Daan Verhulst/Arbeidsovereenkomst Daan.pdf` |
| 5 | Denzel Raven | contract ⚠️ Kai | `Denzel Raven/Contract Denzel onbepaalde tijd.pdf` |
| 6 | Evi Dudink | contract | `Evi Dudink/Arbeidscontract E Dudink.pdf` |
| 7 | Evi Dudink | contract_getekend | `Evi Dudink/Contract Juli 2026 getekend.pdf` |
| 8 | Ilona Swagerman | contract ⚠️ Kai | `Ilona Swagerman/Contract Ilona.pdf` |
| 9 | Ilona Swagerman | loonstrook | `Overige documenten/Loonstroken/Loonstrook Ilona.pdf` |
| 10 | Jasper Wijdenes | contract | `Jasper Wijdenes/Arbeidscontract J Wijdenes.pdf` |
| 11 | Joost van Geest | contract | `Joost van Geest/Arbeidsovereenkomst Joost.docx` |
| 12 | Joost van Geest | loonstrook | `Overige documenten/Loonstroken/Loonstrook Joost.pdf` |
| 13 | Justin Oostwoud | contract | `Justin Oostwoud/Arbeidscontract J Oostwoud.pdf` |
| 14 | Justin Oostwoud | contract_getekend | `Justin Oostwoud/Contract Juli 2026 getekend.pdf` |
| 15 | Kate Houtenbos | contract | `Kate Houtenbos/Arbeidscontract K Houtenbos.pdf` |
| 16 | Kate Houtenbos | contract_getekend | `Kate Houtenbos/Getekend contract Kate Houtenbos Juli 2026.pdf` |
| 17 | Lenthe Deen | contract | `Lenthe Deen/Arbeidsovereenkomst Lenthe.pdf` |
| 18 | Thijmen Bakker | contract | `Thijmen Bakker/Arbeidsovereenkomst Thijmen.pdf` |

### Gaat NIET mee (blijft in iCloud als archief)

- Alle Kai-contracten van 25-03-2026 waar al een nieuwer contract bestaat
- `Overige documenten/Oud-medewerkers (Kai)/` — Aukje Kleijne, Ceesjan Groot
- `Overige documenten/Loonbureau/` — voorbeelddocumenten en oude verzamelloonstaten
- `Loonstrook_2026_02_2.pdf` en `payslips.pdf` — niet herleidbaar naar een persoon
- Algemene documenten (cao, loontabel, huisregels, leeftijdsregels,
  competentieprofielen, toestemmingsformulier). Die horen niet in een persoonlijk
  dossier — overweeg een aparte sectie "Algemeen" in de HR-module.

### Op te ruimen bij de migratie

- `loontabel-1-juli-2026-v2zk.pdf` staat twee keer (los in `06 Medewerkers/` én in
  `Overige documenten/`) — identieke bestanden, één mag weg.
- `Arbeidsovereenkomst Joost.docx` en `Justin Oostwoud/Kai/Arbeidsovereenkomst Justin.docx`
  zijn allebei exact 207.093 bytes. **Controleer voor de migratie of Joost's contract
  niet per ongeluk in Justin's map staat.** Kon niet worden geverifieerd — de bestanden
  zijn iCloud-placeholders en niet lokaal gedownload.
- Lege map `naamloze map`.
- `Contract lente bepaalde tijd.pdf` — typefout, moet Lenthe zijn.
- Mapnaam "Joost van Geest" versus bestandsnaam "Joost van der Geest" — de
  mapnaam klopt: **Joost van Geest**. Bij de import wordt die naam aangehouden.

---

## 4. Besloten op 27 augustus 2026

Na een inventarisatie van wat er al staat. Het oorspronkelijke ontwerp ging uit
van een lege plek; die is er niet. De keten sollicitatie → invulformulier →
loonbureau draait, en er is al een dossier met verslagen en documenten.

- **De app woont in `boskma-2.0`**, niet in `boskma-app`. Alleen de migraties
  staan nog in `boskma-app/supabase/migrations` totdat die map verhuist.
- **Er is geen `medewerkers`-tabel.** Iedereen staat in `sollicitaties`, met een
  kolom `fase` (`sollicitant` of `medewerker`). Sluit daarop aan.
- **Geen MinIO.** De opslag blijft Supabase Storage, bak `Documenten`. Zie
  hoofdstuk 5.
- **Geen nieuwe tabel.** `dossier_documenten` bestaat en wordt uitgebreid.
- **De ID-kopie blijft veertien dagen.** Zie hoofdstuk 8.
- **Een medewerker ziet zijn eigen documenten.** Dat werkt al en blijft zo.

---

## 5. Datamodel

De tabel `dossier_documenten` bestaat sinds 23 augustus 2026 en wordt uitgebreid.
Er komt geen tweede dossiertabel bij: dan gaan het dossierscherm en de
loonheffingskoppeling uit elkaar lopen.

```sql
-- wat er al stond
id              bigserial primary key
medewerker_id   uuid not null references sollicitaties(id)
soort           text not null
naam            text not null          -- oorspronkelijke bestandsnaam
pad             text not null          -- pad in de bak Documenten
toegevoegd_op   timestamptz not null default now()
toegevoegd_door text                   -- mailadres, net als elders in de app

-- wat erbij komt
mime_type       text
bytes           bigint
sha256          char(64)
notitie         text
vervallen_op    timestamptz            -- niet meer actueel
vervangen_door  bigint references dossier_documenten(id)
```

**Categorieën** (`soort`, met een CHECK — de repo gebruikt nergens een enum):

`contract` · `contract_getekend` · `loonheffing` · `mutatieformulier` ·
`loonstrook` · `overig`

`id_kopie` staat er bewust niet bij; die wordt na veertien dagen weggegooid en
hoort dus niet in een dossier thuis.

**Ontwerpkeuzes:**

- `on delete restrict` op de medewerker: een dossier mag niet stilzwijgend
  verdwijnen. Dit was `cascade` en is dus een correctie.
- `vervallen_op` in plaats van weggooien. Een nieuw contract vervangt het oude,
  maar het oude blijft opvraagbaar. Geen harde delete, ook niet in de UI. Bij een
  vervanging wijst `vervangen_door` naar de opvolger; bij "weghalen" blijft die
  leeg en is alleen `vervallen_op` gevuld.
- Unieke index op `(medewerker_id, sha256)` vangt dubbel uploaden af. Het hashen
  gebeurt in de browser met `crypto.subtle` — daar is geen server voor nodig.
- Unieke index op `pad`, zodat er nooit twee regels naar hetzelfde bestand
  wijzen.

**Wat er níet in komt:**

- `geldig_van` / `geldig_tot`. De ingangs- en einddatum van het contract staan al
  op de persoon (`sollicitaties.ingangsdatum` en `einddatum`), en
  personeelsmodule.md is er duidelijk over: contractgegevens niet op twee
  plekken. De signalering "contract loopt af" bouwen we op die kolommen.
- `bewaren_tot`. De termijnen lopen vanaf het einde van het dienstverband en dat
  is bij het uploaden nog niet bekend. Bovendien moeten ze eerst bevestigd worden
  door het loonbureau. Zie hoofdstuk 8.

---

## 6. Opslag — Supabase Storage

De bak **`Documenten`** bestaat en is niet publiek. Wat hoofdstuk 5 van de eerste
versie bij MinIO wilde neerleggen, is hier al zo geregeld:

| eis | hoe het nu werkt |
|---|---|
| niet publiek bereikbaar | geen anonieme leesrechten op de bak |
| geen namen in het pad | `dossier/{medewerker_id}/{tijdstip}-{naam}` |
| tijdelijke downloadlinks | `createSignedUrl`, 60 seconden |
| autorisatie vóór de download | RLS op `storage.objects`, per medewerkersmap |
| bestanden niet door een eigen proces | er ís geen eigen proces; de browser praat rechtstreeks met Supabase |

Het leesrecht van een medewerker hangt aan de **mapnaam**: hij mag bij
`dossier/<zijn eigen id>/` en nergens anders. Alles daarbuiten —
loonheffingsverklaringen, ID-kopieën — blijft dicht.

MinIO erbij zetten zou twee opslagsystemen met twee rechtenmodellen opleveren,
terwijl de bestaande verklaringen en ID-kopieën toch in `Documenten` blijven
staan. Wil je weg van gehost Supabase, dan is dat een besluit over de hele app.

**Wat nog wél moet:**

- Controleer dat de bak `Documenten` in de back-up zit, vóór je iets in iCloud
  opruimt.
- Zet op de bak zelf een maximumgrootte (25 MB) en de toegestane bestandstypes
  (`application/pdf`, `image/jpeg`, `image/png`, de Office-types). Dat is een
  grens die de browser niet kan omzeilen — een controle in de app alleen is dat
  niet.
- Zoek uit of het invulformulier nog met de publieke sleutel in `Documenten` mag
  schrijven. In de migraties staat daar geen regel voor; zie
  `20260825000002_storagebeleid_nakijken.sql`.

---

## 7. Hoe de app erbij komt

Er is geen API-laag en geen Node-proces. De browser praat rechtstreeks met
Supabase en de beveiliging zit in RLS. De endpoints uit de eerste versie worden
dus hooks in `src/lib/dossier.ts`:

| eerste versie | wordt |
|---|---|
| `POST /api/medewerkers/:id/documenten` | `useDocumentToevoegen` — hashen, dubbel afvangen, uploaden, regel toevoegen |
| `GET /api/medewerkers/:id/documenten` | `useDocumenten` |
| `GET /api/documenten/:id/download` | `documentOpenen` / `DocumentLink` |
| `PATCH /api/documenten/:id` | `useDocumentWijzigen` — soort en notitie corrigeren |
| `DELETE /api/documenten/:id` | `useDocumentVervallen` — zet `vervallen_op`, gooit niets weg |
| `GET /api/hr/dossierstatus` | een view of functie achter `useDossierstatus` |

Het eerste vier bestaat al; `useDocumentWeggooien` gooit nu nog écht weg en
wordt vervangen.

**Autorisatie.** Ligt vast en verandert niet: `is_app_user()` is de beheerder,
`huidige_medewerker()` is de medewerker. Een medewerker ziet zijn eigen dossier
en niets van een ander. Er komt geen rol tussen.

---

## 8. Bewaartermijnen en AVG

**De ID-kopie blijft veertien dagen.** Dat is besloten op 23 augustus 2026 en
draait: `ruim-id-kopieen-op` gooit hem dagelijks weg zodra hij veertien dagen bij
het loonbureau ligt. De fiscale bewaarplicht ligt daarmee bij het loonbureau, en
bij Boskma ligt geen verzameling paspoortkopieën.

Gevolg voor deze module: **de ID-kopie is geen dossiercategorie en telt niet mee
in de compleetheidsmatrix.** Geen ID-kopie is daar geen achterstand maar het
gewenste eindresultaat.

Voor wat wél blijft liggen:

| Categorie | Termijn (te bevestigen bij het loonbureau) |
|---|---|
| Loonheffingsverklaring | 5 jaar na einde dienstverband — fiscale bewaarplicht |
| Contract en overig dossier | 2 jaar na uitdiensttreding |

Die termijn hoort niet als datum in de tabel: hij rekent vanaf
`sollicitaties.uit_dienst_op`, en dat is bij het uploaden nog niet bekend. Hij
komt als functie of view, op één plek, bij de signalering in stap 6.

*Dit is geen juridisch advies. Laat de termijnen bevestigen door het loonbureau
of een jurist voordat je er automatische verwijdering op bouwt.*

---

## 9. UI

- **Dossieroverzicht** — de compleetheidsmatrix uit hoofdstuk 2, maar dan live.
  Dit is het scherm dat het probleem oplost: in één blik zien wie wat mist.
  Bestaat nog niet.
- **Per medewerker** — het dossierscherm bestaat (`components/Dossier.tsx`), met
  verslagen en documenten. Wat erbij moet: ontbrekende verplichte categorieën die
  visueel opvallen, en vervallen documenten die inklapbaar blijven staan.
- **Mobiel uploaden** — een getekend contract met de telefoon fotograferen en
  direct in het juiste dossier zetten. Waarschijnlijk de belangrijkste functie
  voor daadwerkelijk gebruik; als het alleen op desktop kan, blijft de
  achterstand bestaan.

---

## 10. Volgorde van bouwen

1. **Migratie**: `dossier_documenten` uitbreiden — categorieën, herkomst van het
   bestand, vervallen in plaats van weggooien, `restrict` op de medewerker
2. **Upload en download** bijwerken: hashen, dubbel afvangen, mimetype en
   grootte vastleggen, en de weggooiknop vervangen door vervallen
3. **Dossieroverzicht** met de compleetheidsmatrix
4. **Handmatige import** van de 18 bestanden uit hoofdstuk 3
5. **Mobiel uploaden**
6. **Signalering**: aflopende contracten, ontbrekende documenten, bewaartermijnen

Stap 4 gebeurt vanuit de Cowork-sessie waar de iCloud-map gekoppeld is. De
bestanden zijn nu nog iCloud-placeholders; ze moeten eerst lokaal gedownload
worden. Pas dan is ook te controleren of Joost's contract per ongeluk in Justin's
map staat.

---

## 11. Openstaande vragen

- **Blijft Eitje het roostersysteem?** Zo lang dat zo is heeft `sollicitaties`
  geen koppelveld naar Eitje nodig. Niet nu bouwen.
- **Wat doet `kermis_persoon.medewerker_id`?** Die kolom is een `integer` en
  `sollicitaties.id` is een `uuid` — de koppeling wijst nergens naar. Opruimen of
  goed leggen, maar niet in deze module.
- **Mag het invulformulier nog in `Documenten` schrijven?** Zie hoofdstuk 6.
