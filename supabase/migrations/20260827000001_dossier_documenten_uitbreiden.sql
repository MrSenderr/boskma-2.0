-- Het personeelsdossier: een document met een herkomst en een geschiedenis
--
-- Zie docs/personeelsdossier.md. Besloten op 27 augustus 2026.
--
-- De tabel dossier_documenten bestaat sinds 23 augustus, maar weet van een
-- bestand alleen de naam en het pad. Daarmee kun je niet zien of iets dubbel is
-- geüpload, of het echt een PDF is, en of een oud contract vervangen is of
-- gewoon verdwenen.
--
-- Er komt geen tweede tabel bij. Dan zouden het dossierscherm en de
-- loonheffingskoppeling uit elkaar gaan lopen, en dat is precies het soort
-- verschil dat je pas merkt als je het nodig hebt.

-- 1. Een dossier verdwijnt niet stilzwijgend ----------------------------------
-- De koppeling stond op cascade: wie een medewerker verwijdert, verwijdert zijn
-- hele dossier zonder dat er iets van te zien is. Met restrict lukt dat pas als
-- het dossier leeg is, en dat is een handeling die iemand bewust moet doen.

DO $$
DECLARE naam text;
BEGIN
  FOR naam IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.dossier_documenten'::regclass
       AND contype  = 'f'
       AND confrelid = 'public.sollicitaties'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.dossier_documenten DROP CONSTRAINT %I', naam);
  END LOOP;
END $$;

ALTER TABLE public.dossier_documenten
  ADD CONSTRAINT dossier_documenten_medewerker_fkey
  FOREIGN KEY (medewerker_id) REFERENCES public.sollicitaties(id) ON DELETE RESTRICT;

-- 2. Welke soorten er zijn -----------------------------------------------------
-- Een tekstveld met een CHECK, zoals overal in deze database. Een enum kun je
-- niet uitbreiden zonder gedoe, en er komt vast nog een soort bij.
--
-- id_kopie staat er bewust niet bij: die wordt na veertien dagen weggegooid
-- (zie ruim-id-kopieen-op) en hoort dus niet in een dossier thuis.

-- Eerst kijken of alles wat er staat binnen de nieuwe lijst valt. Zo niet, dan
-- stopt het hier met een leesbare melding in plaats van met een regelnummer.
DO $$
DECLARE
  r      record;
  vreemd text;
BEGIN
  FOR r IN
    SELECT soort, count(*) AS aantal
      FROM public.dossier_documenten GROUP BY soort ORDER BY soort
  LOOP
    RAISE NOTICE 'staat er nu: % (% stuks)', r.soort, r.aantal;
  END LOOP;

  SELECT string_agg(DISTINCT soort, ', ') INTO vreemd
    FROM public.dossier_documenten
   WHERE soort NOT IN ('contract', 'contract_getekend', 'loonheffing',
                       'mutatieformulier', 'loonstrook', 'overig');

  IF vreemd IS NOT NULL THEN
    RAISE EXCEPTION
      'Er staan documenten met een soort die niet in de nieuwe lijst voorkomt: %. '
      'Zet die eerst om naar een van de zes soorten, dan kan deze migratie er weer overheen.',
      vreemd;
  END IF;
END $$;

ALTER TABLE public.dossier_documenten
  DROP CONSTRAINT IF EXISTS dossier_documenten_soort_check;

ALTER TABLE public.dossier_documenten
  ADD CONSTRAINT dossier_documenten_soort_check
  CHECK (soort IN ('contract', 'contract_getekend', 'loonheffing',
                   'mutatieformulier', 'loonstrook', 'overig'));

-- 3. Wat we van een bestand willen weten ---------------------------------------
-- Alles mag leeg zijn: wat er al staat is er zonder deze gegevens ingekomen, en
-- daar achteraf iets van verzinnen is erger dan het niet weten.

ALTER TABLE public.dossier_documenten
  ADD COLUMN IF NOT EXISTS mime_type      text,
  ADD COLUMN IF NOT EXISTS bytes          bigint,
  ADD COLUMN IF NOT EXISTS sha256         char(64),
  ADD COLUMN IF NOT EXISTS notitie        text,
  -- niet meer actueel; het bestand blijft staan en blijft opvraagbaar
  ADD COLUMN IF NOT EXISTS vervallen_op   timestamptz,
  -- gevuld als er een opvolger is, leeg als het gewoon weggehaald is
  ADD COLUMN IF NOT EXISTS vervangen_door bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dossier_documenten'::regclass
       AND conname  = 'dossier_documenten_vervangen_door_fkey'
  ) THEN
    ALTER TABLE public.dossier_documenten
      ADD CONSTRAINT dossier_documenten_vervangen_door_fkey
      FOREIGN KEY (vervangen_door) REFERENCES public.dossier_documenten(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Een document kan niet zijn eigen opvolger zijn.
ALTER TABLE public.dossier_documenten
  DROP CONSTRAINT IF EXISTS dossier_documenten_niet_zichzelf;
ALTER TABLE public.dossier_documenten
  ADD CONSTRAINT dossier_documenten_niet_zichzelf
  CHECK (vervangen_door IS NULL OR vervangen_door <> id);

-- 4. Twee keer hetzelfde bestand is één bestand --------------------------------
-- De app rekent de sha256 in de browser uit (crypto.subtle) en stuurt hem mee.
-- Wat er al staat heeft er geen, en die regels moeten elkaar niet in de weg
-- zitten — vandaar de voorwaarde onderaan de index.

CREATE UNIQUE INDEX IF NOT EXISTS dossier_documenten_zelfde_bestand_idx
  ON public.dossier_documenten (medewerker_id, sha256)
  WHERE sha256 IS NOT NULL;

-- Nooit twee regels die naar hetzelfde bestand wijzen: dan zou de een het
-- bestand van de ander kunnen laten vervallen.
DO $$
DECLARE dubbel text;
BEGIN
  SELECT string_agg(pad, E'\n  ') INTO dubbel
    FROM (SELECT pad FROM public.dossier_documenten
           GROUP BY pad HAVING count(*) > 1) AS d;

  IF dubbel IS NOT NULL THEN
    RAISE EXCEPTION
      'Deze paden staan meer dan een keer in de tabel: %. Ruim de dubbele regels eerst op.',
      dubbel;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dossier_documenten_pad_idx
  ON public.dossier_documenten (pad);

-- Waarop het dossierscherm sorteert.
CREATE INDEX IF NOT EXISTS dossier_documenten_soort_idx
  ON public.dossier_documenten (medewerker_id, soort, toegevoegd_op DESC);

-- 5. De API-laag opnieuw laten kijken ------------------------------------------
-- PostgREST houdt de vorm van een tabel in het geheugen. Zonder dit ziet de app
-- de nieuwe kolommen niet en krijg je bij het opslaan een fout over een veld dat
-- volgens de API niet bestaat. Ging eerder mis bij wie_ben_ik.

NOTIFY pgrst, 'reload schema';

-- 6. Nakijken ------------------------------------------------------------------

DO $$
DECLARE
  regels  int;
  zonder  int;
BEGIN
  SELECT count(*) INTO regels FROM public.dossier_documenten;
  SELECT count(*) INTO zonder FROM public.dossier_documenten WHERE sha256 IS NULL;
  RAISE NOTICE '--- % documenten in het dossier, % nog zonder vingerafdruk', regels, zonder;
  RAISE NOTICE '--- die krijgen er een zodra ze opnieuw langskomen; oude regels blijven werken';

  RAISE NOTICE '--- kolommen op dossier_documenten: %',
    (SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dossier_documenten');
END $$;
