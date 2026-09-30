-- Rooster en gewerkte uren
--
-- Het rooster wordt gemaakt in eitje, niet hier. Daar verandert niets aan: die
-- app is van de medewerkers en ze kijken er toch al in. Wat er ontbrak is het
-- geheugen — eitje toont een week, maar niet wie er dit kwartaal drie keer meer
-- werkte dan gepland stond. Daarom halen we de exports hierheen en bewaren we
-- ze, twee tabellen met dezelfde vorm zodat gepland en gewerkt naast elkaar
-- gelegd kunnen worden.
--
-- De sleutel is `bron_id`: het "support ID" uit de export, het record_id van
-- eitje. Dezelfde week twee keer importeren overschrijft dus, en stapelt niet.
-- Zonder die kolom zou een correctie in het rooster hier een dubbele shift
-- worden en klopt elke telling daarna niet meer.

-- 1. Logboek van wat er is ingelezen ------------------------------------------
-- Zodat bij een vreemde uitkomst te zien is welk bestand hem veroorzaakte.

CREATE TABLE IF NOT EXISTS public.rooster_imports (
  id               bigserial PRIMARY KEY,
  soort            text NOT NULL CHECK (soort IN ('planning', 'gewerkt')),
  bestandsnaam     text,
  -- het Excel-nummer uit het tabblad "log" van de export (bijv. 74332)
  export_nummer    text,
  geexporteerd_op  text,
  periode_van      date,
  periode_tot      date,
  aantal_regels    int NOT NULL DEFAULT 0,
  aantal_nieuw     int NOT NULL DEFAULT 0,
  aantal_gewijzigd int NOT NULL DEFAULT 0,
  door             text,
  op               timestamptz NOT NULL DEFAULT now()
);

-- 2. Wat er gepland stond ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.geplande_shifts (
  bron_id        text PRIMARY KEY,
  datum          date NOT NULL,
  -- De naam zoals hij in de export stond blijft staan, ook als de koppeling
  -- lukt. Een medewerker kan later uit de lijst verdwijnen; het rooster van
  -- vorig jaar moet leesbaar blijven. Leeg betekent: open dienst, wel een plek
  -- op het rooster maar nog niemand erop.
  voornaam       text,
  achternaam     text,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE SET NULL,
  team           text,
  begint         time,
  eindigt        time,
  -- Uit de kolom "uren" (hh:mm). In minuten, want optellen in tekst gaat mis.
  minuten        int NOT NULL DEFAULT 0,
  import_id      bigint REFERENCES public.rooster_imports(id) ON DELETE SET NULL,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geplande_shifts_datum_idx
  ON public.geplande_shifts (datum);
CREATE INDEX IF NOT EXISTS geplande_shifts_medewerker_idx
  ON public.geplande_shifts (medewerker_id, datum);

-- 3. Wat er gewerkt is ---------------------------------------------------------
-- Zelfde vorm, met wat de urenregistratie extra weet. `soort` is nu altijd
-- "gewerkte uren"; eitje kent ook verlof en ziek, en die komen mee zodra ze in
-- de export staan. Daarom geen CHECK op die kolom: een onbekende soort hoort
-- ingelezen te worden en zichtbaar te zijn, niet geweigerd.

CREATE TABLE IF NOT EXISTS public.gewerkte_uren (
  bron_id        text PRIMARY KEY,
  datum          date NOT NULL,
  voornaam       text,
  achternaam     text,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE SET NULL,
  soort          text,
  begint         time,
  eindigt        time,
  minuten        int NOT NULL DEFAULT 0,
  pauze_minuten  int NOT NULL DEFAULT 0,
  maaltijden     text,
  import_id      bigint REFERENCES public.rooster_imports(id) ON DELETE SET NULL,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gewerkte_uren_datum_idx
  ON public.gewerkte_uren (datum);
CREATE INDEX IF NOT EXISTS gewerkte_uren_medewerker_idx
  ON public.gewerkte_uren (medewerker_id, datum);

-- 4. Namen die niet vanzelf koppelen ------------------------------------------
--
-- De urenexport geeft alleen een voornaam, en waar wel een achternaam staat
-- komt die niet altijd overeen: "Ilona Swagerman" in eitje is
-- "Swagerman-Honselaar" in het personeelsbestand. De app matcht daarom ruim
-- (voornaam, en achternaam als voorvoegsel), en wat dan nog overblijft wordt
-- hier één keer met de hand vastgelegd.
--
-- Een rij betekent: hierover is besloten. `medewerker_id` gevuld is een
-- koppeling, `negeren` is "dit is niemand van ons" — denk aan een uitzendkracht
-- of een oud-medewerker die niet in de personeelslijst staat. Zonder dat
-- onderscheid blijft zo'n naam elke import opnieuw om aandacht vragen.

CREATE TABLE IF NOT EXISTS public.rooster_namen (
  -- genormaliseerd: kleine letters, zonder accenten, één spatie
  naam           text PRIMARY KEY,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  negeren        boolean NOT NULL DEFAULT false,
  gezet_op       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rooster_namen_keuze CHECK (negeren OR medewerker_id IS NOT NULL)
);

-- 5. Wie mag wat ---------------------------------------------------------------
-- Beheer mag alles. Een medewerker ziet zijn eigen regels en verder niets: wie
-- hoeveel werkt is niet andermans zaak, en het maakt later een eigen
-- rooster-scherm mogelijk zonder dat hier nog iets aan hoeft te veranderen.

ALTER TABLE public.rooster_imports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geplande_shifts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gewerkte_uren    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooster_namen    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rooster_imports FROM anon;
REVOKE ALL ON public.geplande_shifts FROM anon;
REVOKE ALL ON public.gewerkte_uren   FROM anon;
REVOKE ALL ON public.rooster_namen   FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.rooster_imports;
CREATE POLICY app_gebruiker ON public.rooster_imports
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.geplande_shifts;
CREATE POLICY app_gebruiker ON public.geplande_shifts
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.gewerkte_uren;
CREATE POLICY app_gebruiker ON public.gewerkte_uren
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.rooster_namen;
CREATE POLICY app_gebruiker ON public.rooster_namen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS eigen_shifts ON public.geplande_shifts;
CREATE POLICY eigen_shifts ON public.geplande_shifts
  FOR SELECT TO authenticated
  USING (medewerker_id IS NOT NULL AND medewerker_id = public.huidige_medewerker());

DROP POLICY IF EXISTS eigen_uren ON public.gewerkte_uren;
CREATE POLICY eigen_uren ON public.gewerkte_uren
  FOR SELECT TO authenticated
  USING (medewerker_id IS NOT NULL AND medewerker_id = public.huidige_medewerker());

-- PostgREST onthoudt de vorm van de database; zonder dit blijven de nieuwe
-- tabellen onzichtbaar voor de app.
NOTIFY pgrst, 'reload schema';
