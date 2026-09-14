-- De kastelling
--
-- Zie docs/Modules/kas.md. Besloten op 24 augustus 2026.
--
-- Alle bedragen staan in CENTEN, als hele getallen. Rekenen met 0,05 en 0,10 als
-- kommagetallen levert na genoeg optellingen 0,30000000000000004 op, en bij een
-- kastelling is dat het verschil tussen "klopt" en "klopt niet".

-- 1. Wat er in de lade hoort te blijven -----------------------------------------
-- Per coupure een gewenst aantal. Het kasbedrag is de optelsom daarvan en wordt
-- dus niet apart ingesteld — zo kan het nooit uit elkaar lopen met het
-- wisselgeld dat je werkelijk wilt hebben.

CREATE TABLE IF NOT EXISTS public.kas_coupures (
  waarde_cent int PRIMARY KEY,
  soort       text NOT NULL CHECK (soort IN ('munt', 'biljet')),
  gewenst     int NOT NULL DEFAULT 0 CHECK (gewenst >= 0),
  volgorde    int NOT NULL DEFAULT 0
);

-- Startwaarden voor een snackbar; Sander loopt ze na en past ze aan.
INSERT INTO public.kas_coupures (waarde_cent, soort, gewenst, volgorde) VALUES
  (   5, 'munt',   40, 10),
  (  10, 'munt',   40, 20),
  (  20, 'munt',   40, 30),
  (  50, 'munt',   30, 40),
  ( 100, 'munt',   25, 50),
  ( 200, 'munt',   15, 60),
  ( 500, 'biljet',  6, 70),
  (1000, 'biljet',  5, 80),
  (2000, 'biljet',  3, 90),
  (5000, 'biljet',  0, 100)
ON CONFLICT (waarde_cent) DO NOTHING;

-- 2. De telling zelf -----------------------------------------------------------
-- Een afgeronde telling staat vast. Corrigeren doe je met een nieuwe telling of
-- een notitie, niet door de oude te overschrijven — net als bij het logboek.

CREATE TABLE IF NOT EXISTS public.kas_tellingen (
  id                bigserial PRIMARY KEY,
  datum             date NOT NULL DEFAULT CURRENT_DATE,
  gemaakt_op        timestamptz NOT NULL DEFAULT now(),
  medewerker_id     uuid REFERENCES public.sollicitaties(id),
  door_naam         text,
  geteld_cent       int NOT NULL,
  blijft_cent       int NOT NULL,
  eruit_munt_cent   int NOT NULL DEFAULT 0,
  eruit_biljet_cent int NOT NULL DEFAULT 0,
  opmerking         text
);

CREATE INDEX IF NOT EXISTS kas_tellingen_datum_idx
  ON public.kas_tellingen (datum DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.kas_telling_regels (
  id          bigserial PRIMARY KEY,
  telling_id  bigint NOT NULL REFERENCES public.kas_tellingen(id) ON DELETE CASCADE,
  waarde_cent int NOT NULL,
  geteld      int NOT NULL DEFAULT 0,
  blijft      int NOT NULL DEFAULT 0,
  eruit       int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS kas_telling_regels_idx
  ON public.kas_telling_regels (telling_id, waarde_cent);

-- 3. De kluis ------------------------------------------------------------------
-- Twee voorraden, geen één. Briefgeld loopt op tot een bankstorting; munten
-- blijven liggen als wisselgeldvoorraad en kunnen terug naar de lade als je de
-- volgende dag klein geld tekort komt.
--
-- Bedragen zijn getekend: positief is erbij, negatief is eraf. Het saldo is
-- daarmee gewoon de optelsom, en er kan niets zoekraken in een aparte kolom.

CREATE TABLE IF NOT EXISTS public.kluis_mutaties (
  id          bigserial PRIMARY KEY,
  soort       text NOT NULL CHECK (soort IN ('uit_kassa', 'naar_bank', 'naar_kassa', 'correctie')),
  munt_cent   int NOT NULL DEFAULT 0,
  biljet_cent int NOT NULL DEFAULT 0,
  telling_id  bigint REFERENCES public.kas_tellingen(id) ON DELETE SET NULL,
  datum       date NOT NULL DEFAULT CURRENT_DATE,
  opmerking   text,
  door_naam   text,
  gemaakt_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kluis_mutaties_datum_idx
  ON public.kluis_mutaties (datum DESC, id DESC);

-- 4. Wie mag dit ---------------------------------------------------------------
-- Een eigen vinkje, want dit gaat over geld.

ALTER TABLE public.medewerker_rechten DROP CONSTRAINT IF EXISTS medewerker_rechten_recht_check;
ALTER TABLE public.medewerker_rechten
  ADD CONSTRAINT medewerker_rechten_recht_check
  CHECK (recht IN ('recepten', 'mep', 'haccp', 'kas'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kas_coupures', 'kas_tellingen', 'kas_telling_regels', 'kluis_mutaties'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    EXECUTE format('DROP POLICY IF EXISTS app_gebruiker ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY app_gebruiker ON public.%I FOR ALL TO authenticated '
      'USING (public.is_app_user()) WITH CHECK (public.is_app_user())', t);

    EXECUTE format('DROP POLICY IF EXISTS mag_kassen ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mag_kassen ON public.%I FOR ALL TO authenticated '
      'USING (public.heeft_recht(''kas'')) WITH CHECK (public.heeft_recht(''kas''))', t);
  END LOOP;
END $$;

-- 5. Waar het seintje over gaat -------------------------------------------------
-- Over het briefgeld: dat is wat naar de bank moet en waar een verzekering een
-- grens aan stelt. Munten blijven toch liggen.

INSERT INTO public.instellingen (sleutel, waarde)
VALUES ('kluis_grens', '{"biljet_cent": 200000}'::jsonb)
ON CONFLICT (sleutel) DO NOTHING;
