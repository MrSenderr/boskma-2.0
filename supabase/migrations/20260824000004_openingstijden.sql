-- Wanneer de zaak open is
--
-- Zie docs/Modules/openingstijden.md. Besloten op 24 augustus 2026.
--
-- Tot nu toe rekende de app elke dag mee. Gevolg: elke maandag staat er in de
-- weekafsluiting "0 van 6 gemeten" in het rood, en in de uitdraai voor een
-- controle een gat. Dat is geen afwijking maar een gesloten deur, en dat
-- verschil moet de app kennen.
--
-- Dagnummers volgen ISO: 1 = maandag, 7 = zondag. Dat is ook wat
-- EXTRACT(isodow FROM datum) teruggeeft, dus er hoeft nergens omgerekend.

CREATE TABLE IF NOT EXISTS public.openingsdagen (
  dag  smallint PRIMARY KEY CHECK (dag BETWEEN 1 AND 7),
  open boolean NOT NULL DEFAULT true,
  van  time,
  tot  time
);

-- Een dag die eenmalig afwijkt: tweede kerstdag dicht, of met de kermis eerder
-- open. Staat een datum hier, dan wint deze rij van het weekrooster.
CREATE TABLE IF NOT EXISTS public.afwijkende_dagen (
  datum date PRIMARY KEY,
  open  boolean NOT NULL,
  van   time,
  tot   time,
  reden text
);

-- Het rooster van nu: dinsdag tot en met zondag van 12 tot 20, maandag dicht.
INSERT INTO public.openingsdagen (dag, open, van, tot)
VALUES (1, false, NULL,    NULL),
       (2, true,  '12:00', '20:00'),
       (3, true,  '12:00', '20:00'),
       (4, true,  '12:00', '20:00'),
       (5, true,  '12:00', '20:00'),
       (6, true,  '12:00', '20:00'),
       (7, true,  '12:00', '20:00')
ON CONFLICT (dag) DO NOTHING;

ALTER TABLE public.openingsdagen    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afwijkende_dagen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openingsdagen    FROM anon;
REVOKE ALL ON public.afwijkende_dagen FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.openingsdagen;
CREATE POLICY app_gebruiker ON public.openingsdagen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.afwijkende_dagen;
CREATE POLICY app_gebruiker ON public.afwijkende_dagen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

-- Een medewerker moet weten of de zaak open is: zijn startscherm hangt ervan af.
-- Lezen mag, wijzigen niet.
DROP POLICY IF EXISTS medewerker_leest ON public.openingsdagen;
CREATE POLICY medewerker_leest ON public.openingsdagen
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_leest ON public.afwijkende_dagen;
CREATE POLICY medewerker_leest ON public.afwijkende_dagen
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);
