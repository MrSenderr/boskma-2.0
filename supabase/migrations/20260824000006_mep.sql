-- Mise en place: de voorbereidingslijst
--
-- Zie docs/Modules/mep.md. Besloten op 24 augustus 2026, naar het papieren
-- formulier "Mise en place - keuken".
--
-- De tabellen uit de tabletapp bestonden al en worden hergebruikt, zodat er geen
-- tweede stel naast komt te staan. Wat er niet meer bij past:
--
--   * mep_sjablonen.herhaling / weekdagen / tweewekelijks_pariteit gingen ervan
--     uit dat de app zelf een dagelijst genereert. Zo werkt het niet: wie sluit
--     vinkt 's avonds aan wat er de volgende opendag moet gebeuren. Die kolommen
--     blijven staan maar worden niet gebruikt.
--   * gedaan_door_id was een tabletnummer; dat wordt nu de medewerker.

-- 1. De vaste lijst ------------------------------------------------------------

ALTER TABLE public.mep_sjablonen
  ADD COLUMN IF NOT EXISTS groep       text,
  ADD COLUMN IF NOT EXISTS toelichting text;

-- 2. Wat er op een dag moet gebeuren -------------------------------------------
-- datum is de dag waarvóór het werk is, niet de dag dat het is aangevinkt.

ALTER TABLE public.mep_dag_taken
  ADD COLUMN IF NOT EXISTS hoeveelheid   text,
  ADD COLUMN IF NOT EXISTS aangezet_op   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS aangezet_door text,
  ADD COLUMN IF NOT EXISTS gedaan_door   uuid REFERENCES public.sollicitaties(id);

-- Eén keer dezelfde taak op dezelfde dag is genoeg.
CREATE UNIQUE INDEX IF NOT EXISTS mep_dag_taken_uniek
  ON public.mep_dag_taken (datum, sjabloon_id)
  WHERE sjabloon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mep_dag_taken_open_idx
  ON public.mep_dag_taken (datum, gedaan);

-- 3. De algemene opmerkingen onderaan het formulier ----------------------------

CREATE TABLE IF NOT EXISTS public.mep_dag_notitie (
  datum         date PRIMARY KEY,
  tekst         text,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  door          text
);

-- 4. Wie mag wat ---------------------------------------------------------------

ALTER TABLE public.mep_dag_notitie ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mep_dag_notitie FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.mep_dag_notitie;
CREATE POLICY app_gebruiker ON public.mep_dag_notitie
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker ON public.mep_dag_notitie;
CREATE POLICY medewerker ON public.mep_dag_notitie
  FOR ALL TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL)
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

-- De vaste lijst: iedereen leest hem, aanpassen mag alleen wie dat recht heeft.
DROP POLICY IF EXISTS medewerker_leest ON public.mep_sjablonen;
CREATE POLICY medewerker_leest ON public.mep_sjablonen
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS mag_beheren ON public.mep_sjablonen;
CREATE POLICY mag_beheren ON public.mep_sjablonen
  FOR ALL TO authenticated
  USING (public.heeft_recht('mep')) WITH CHECK (public.heeft_recht('mep'));

-- De dagelijst: aanzetten en aftikken hoort bij het werk, dus dat mag iedereen
-- die is ingelogd. Weggooien niet — daarvoor is er geen DELETE-regel voor
-- medewerkers.
DROP POLICY IF EXISTS medewerker_leest ON public.mep_dag_taken;
CREATE POLICY medewerker_leest ON public.mep_dag_taken
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_zet_aan ON public.mep_dag_taken;
CREATE POLICY medewerker_zet_aan ON public.mep_dag_taken
  FOR INSERT TO authenticated
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_tikt_af ON public.mep_dag_taken;
CREATE POLICY medewerker_tikt_af ON public.mep_dag_taken
  FOR UPDATE TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL)
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

-- Een taak die je vanavond per ongeluk aanzet moet je vanavond ook weer af
-- kunnen halen. Alleen zolang er niemand aan begonnen is.
DROP POLICY IF EXISTS medewerker_haalt_weg ON public.mep_dag_taken;
CREATE POLICY medewerker_haalt_weg ON public.mep_dag_taken
  FOR DELETE TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL AND gedaan = false);

-- 5. De lijst van het papieren formulier --------------------------------------
-- Achttien taken, in de volgorde waarin ze op papier stonden, met groepen erbij
-- zoals afgesproken. Alleen invoeren als de tabel nog leeg is.

INSERT INTO public.mep_sjablonen (naam, groep, volgorde, actief)
SELECT naam, groep, volgorde, true
  FROM (VALUES
    ('Sla drogen',             'Snijwerk', 10),
    ('Sla snijden',            'Snijwerk', 20),
    ('Komkommer snijden',      'Snijwerk', 30),
    ('Tomaat snijden',         'Snijwerk', 40),
    ('Radijs snijden',         'Snijwerk', 50),
    ('Bieslook snijden',       'Snijwerk', 60),
    ('Rode ui snijden',        'Snijwerk', 70),
    ('Pijnboompitten roosteren','Warm',    80),
    ('Uien karameliseren',     'Warm',     90),
    ('Pindasaus maken',        'Sauzen',  100),
    ('Pindasaus portioneren',  'Sauzen',  110),
    ('Ras maken',              'Sauzen',  120),
    ('Slaatjes maken',         'Snacks',  130),
    ('Berenhappen maken',      'Snacks',  140),
    ('Kipnuggets maken',       'Snacks',  150),
    ('Snacks portioneren',     'Snacks',  160),
    ('IJs maken',              'Overig',  170)
  ) AS t(naam, groep, volgorde)
 WHERE NOT EXISTS (SELECT 1 FROM public.mep_sjablonen);
