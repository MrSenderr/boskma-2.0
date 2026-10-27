-- Wat er per dag nodig is, en met wie dat vastligt
--
-- De app wist tot nu toe alleen hoe de avondspits verdeeld moet worden:
-- zes werkplekken, zeven paar handen, vrijdag tot en met zondag. Niet hoeveel
-- mensen er op een dinsdagmiddag moeten staan, en niet hoe laat ze beginnen.
--
-- Die twee tabellen vullen dat gat. Ze zijn afgeleid uit vijf weken van Sanders
-- eigen planning, niet verzonnen: alles eindigt om 20:00, en er zijn maar twee
-- soorten diensten — een dagdienst die tussen 10:00 en 12:00 begint, en een
-- avonddienst van 17:00 tot 20:00. De vroegste dagdienst is de voorbereiding,
-- en dat is een eigen rol: niet iedereen kan de mep doen.
--
-- Doordeweeks blijven de minder belangrijke werkplekken vanzelf leeg. Dat hoeft
-- hier niet vastgelegd: de spitsindeling rangschikt al op `belang`, dus met
-- vier man worden de vier zwaarste plekken bezet en de rest niet. Een tweede
-- set werkplekken zou twee waarheden maken over dezelfde zaak.

-- 1. Het weeksjabloon ----------------------------------------------------------
-- Dag 1 is maandag, zoals ISO het telt en zoals `maandagVan` in de app rekent.

CREATE TABLE IF NOT EXISTS public.weeksjabloon (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dag            smallint NOT NULL CHECK (dag BETWEEN 1 AND 7),
  -- voorbereiding gaat vóór de deur open; dag loopt door tot sluit; avond is
  -- de spits. Geen CHECK op een vaste lijst zou betekenen dat een typefout een
  -- vierde soort maakt die nergens wordt herkend.
  soort          text NOT NULL CHECK (soort IN ('voorbereiding', 'dag', 'avond')),
  begint         time NOT NULL,
  eindigt        time NOT NULL,
  -- Nul mag: zo zet je een dienst tijdelijk uit zonder de regel kwijt te raken.
  aantal         smallint NOT NULL DEFAULT 1 CHECK (aantal >= 0),
  opmerking      text,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weeksjabloon_tijden CHECK (eindigt > begint),
  CONSTRAINT weeksjabloon_uniek UNIQUE (dag, begint, soort)
);

CREATE INDEX IF NOT EXISTS weeksjabloon_dag_idx ON public.weeksjabloon (dag, begint);

-- 2. Afgesproken vaste diensten ------------------------------------------------
--
-- Dit is iets anders dan de vaste dagen. Daar staat een wéns — "graag woensdag"
-- — ingevuld door de medewerker. Hier staat een afspraak: Brian werkt elke
-- woensdag de dagdienst. Die staat vast vóórdat er iets te verdelen valt, en
-- is dus de sterkste van de drie bronnen die het voorstel gebruikt (afspraak,
-- dan beschikbaarheid uit eitje, dan wens).
--
-- De tijden staan hier zelf in plaats van een verwijzing naar het sjabloon.
-- Verandert het sjabloon, dan hoort een gemaakte afspraak niet stilletjes mee
-- te verschuiven of te verdwijnen.

CREATE TABLE IF NOT EXISTS public.vaste_diensten (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medewerker_id  uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  dag            smallint NOT NULL CHECK (dag BETWEEN 1 AND 7),
  soort          text NOT NULL CHECK (soort IN ('voorbereiding', 'dag', 'avond')),
  begint         time NOT NULL,
  eindigt        time NOT NULL,
  opmerking      text,
  aangemaakt_op  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vaste_diensten_tijden CHECK (eindigt > begint),
  -- Twee keer dezelfde afspraak op dezelfde dag is altijd een vergissing.
  CONSTRAINT vaste_diensten_uniek UNIQUE (medewerker_id, dag, begint)
);

CREATE INDEX IF NOT EXISTS vaste_diensten_dag_idx ON public.vaste_diensten (dag);

-- 3. Wie mag wat ---------------------------------------------------------------
-- Het sjabloon is bedrijfsvoering: beheer stelt het in, en een medewerker heeft
-- er niets te zoeken. Zijn eigen vaste dienst mag hij wel zien.

ALTER TABLE public.weeksjabloon    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaste_diensten  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weeksjabloon   FROM anon;
REVOKE ALL ON public.vaste_diensten FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.weeksjabloon;
CREATE POLICY app_gebruiker ON public.weeksjabloon
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.vaste_diensten;
CREATE POLICY app_gebruiker ON public.vaste_diensten
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS eigen_vaste_dienst ON public.vaste_diensten;
CREATE POLICY eigen_vaste_dienst ON public.vaste_diensten
  FOR SELECT TO authenticated
  USING (medewerker_id IS NOT NULL AND medewerker_id = public.huidige_medewerker());

NOTIFY pgrst, 'reload schema';
