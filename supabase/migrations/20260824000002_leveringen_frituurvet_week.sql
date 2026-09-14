-- HACCP: leveringen, frituurvet en de weekafsluiting
--
-- Zie docs/Modules/haccp/haccpmodule.md. Besloten op 24 augustus 2026.

-- 1. Leveringen ---------------------------------------------------------------
-- De tabel bestond al voor de tabletapp. Wat er niet meer bij past:
--   * employee_id was een tabletnummer; nu hangt het aan de ingelogde persoon
--   * product was verplicht; er wordt vastgelegd wat er binnenkwam en hoe koud,
--     niet wat er precies in de doos zat

ALTER TABLE public.haccp_leveringen ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.haccp_leveringen ALTER COLUMN product     DROP NOT NULL;

ALTER TABLE public.haccp_leveringen
  ADD COLUMN IF NOT EXISTS medewerker_id uuid REFERENCES public.sollicitaties(id),
  ADD COLUMN IF NOT EXISTS door_naam text;

CREATE INDEX IF NOT EXISTS haccp_leveringen_datum_idx
  ON public.haccp_leveringen (datum DESC, id DESC);

-- Aannemen mag iedereen die ingelogd is; terugkijken ook. Wijzigen en weggooien
-- niet: een levering die je hebt afgetekend blijft staan.
DROP POLICY IF EXISTS medewerker_tekent_levering ON public.haccp_leveringen;
CREATE POLICY medewerker_tekent_levering ON public.haccp_leveringen
  FOR INSERT TO authenticated
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_leest_leveringen ON public.haccp_leveringen;
CREATE POLICY medewerker_leest_leveringen ON public.haccp_leveringen
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

-- 2. Frituurvet ---------------------------------------------------------------
-- Geen verversdatum per pan, maar het doorschuiven zelf. Verse olie gaat in de
-- laatste pan, en met één handeling schuift alles een plek op; de eerste pan
-- gaat naar de afgewerktvetbak. Uit de momenten valt af te leiden wat er in elke
-- pan zit en hoe lang de olie in totaal heeft meegedraaid — dat laatste is het
-- getal waar bij een controle naar gekeken wordt.

CREATE TABLE IF NOT EXISTS public.haccp_frituurvet (
  id            bigserial PRIMARY KEY,
  gedaan_op     timestamptz NOT NULL DEFAULT now(),
  datum         date NOT NULL DEFAULT CURRENT_DATE,
  medewerker_id uuid REFERENCES public.sollicitaties(id),
  door_naam     text
);

CREATE INDEX IF NOT EXISTS haccp_frituurvet_datum_idx
  ON public.haccp_frituurvet (gedaan_op DESC);

ALTER TABLE public.haccp_frituurvet ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.haccp_frituurvet FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.haccp_frituurvet;
CREATE POLICY app_gebruiker ON public.haccp_frituurvet
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker_schuift_door ON public.haccp_frituurvet;
CREATE POLICY medewerker_schuift_door ON public.haccp_frituurvet
  FOR INSERT TO authenticated
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_leest_frituurvet ON public.haccp_frituurvet;
CREATE POLICY medewerker_leest_frituurvet ON public.haccp_frituurvet
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

-- 3. Weekafsluiting -----------------------------------------------------------
-- De app zet het overzicht klaar, Sander tikt het af. Alleen hij: dit ís de
-- handtekening van de leiding, dus die moet van hem komen.

CREATE TABLE IF NOT EXISTS public.haccp_weekakkoord (
  id         bigserial PRIMARY KEY,
  jaar       smallint NOT NULL,
  iso_week   smallint NOT NULL,
  akkoord_op timestamptz NOT NULL DEFAULT now(),
  door       text,
  opmerking  text,
  UNIQUE (jaar, iso_week)
);

ALTER TABLE public.haccp_weekakkoord ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.haccp_weekakkoord FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.haccp_weekakkoord;
CREATE POLICY app_gebruiker ON public.haccp_weekakkoord
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());
