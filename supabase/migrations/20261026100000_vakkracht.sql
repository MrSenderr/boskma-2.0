-- Vakkracht of niet, en vanaf wanneer.
--
-- Vanaf achttien jaar kent de horeca-cao twee bodems. Een vakkracht heeft
-- recht op het basisloon van zijn functiegroep; wie dat niet is valt onder de
-- lagere staffel voor niet-vakkrachten. Bij achttien scheelt dat € 9,74 tegen
-- € 11,99 per uur, bij negentien € 11,24 tegen € 13,49, bij twintig € 12,74
-- tegen € 14,99. Vanaf eenentwintig lopen ze weer gelijk en doet het er niet
-- meer toe.
--
-- Je bent vakkracht met een erkend vakdiploma voor je functie, of met 1.976
-- uur ervaring in dezelfde functie opgebouwd ná je achttiende verjaardag --
-- ook uren bij een vorige werkgever tellen mee, mits aantoonbaar met
-- loonstroken. Een BBL-leerling is nooit vakkracht.
--
-- Waarom dit een veld is dat Sander zet en geen som die de app maakt: de app
-- ziet alleen de uren die bij Boskma zijn geschreven, en die beginnen pas in
-- 2026. Uitrekenen zou betekenen dat de app "nog geen vakkracht" zegt over
-- iemand die het allang is, en dat is precies de fout die geld kost.
--
-- Leeg betekent onbekend, en dat is iets anders dan 'nee'. Bij onbekend hoort
-- het scherm de vraag te stellen; bij 'nee' is de vraag beantwoord.

alter table sollicitaties
  add column if not exists vakkracht text
    check (vakkracht in ('nee', 'diploma', 'ervaring')),
  -- Vanaf welke dag het geldt. Doet ertoe omdat een contract dat vorig jaar
  -- inging onder de toen geldende bodem valt, niet onder die van vandaag.
  add column if not exists vakkracht_sinds date;

comment on column sollicitaties.vakkracht is
  'Vakkracht volgens de horeca-cao: nee, via diploma, of via 1.976 uur ervaring na het achttiende jaar. Leeg = nog niet vastgesteld.';
comment on column sollicitaties.vakkracht_sinds is
  'Vanaf welke dag iemand vakkracht is. Leeg bij vakkracht = nee.';

notify pgrst, 'reload schema';
