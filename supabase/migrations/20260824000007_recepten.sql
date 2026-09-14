-- Recepten
--
-- Zie docs/Modules/recepten.md. Besloten op 24 augustus 2026.
--
-- Bewust géén meerekenen met hoeveelheden. Staat er op de MEP "2 bakken", dan is
-- dat een aantekening en geen som. Dat scheelt een berg gedoe met eenheden, en
-- het voorkomt dat de app fout rekent waar de kok het goed had.
--
-- Ingrediënten zijn één tekstveld met een regel per ingrediënt, geen aparte
-- tabel. Sander schrijft ze zelf en dat moet vlot typen; een lijstje regels
-- leest net zo goed als een raster met velden.

CREATE TABLE IF NOT EXISTS public.recepten (
  id            bigserial PRIMARY KEY,
  naam          text NOT NULL,
  omschrijving  text,
  basis         text,            -- waar dit recept voor is: "1 bak", "20 porties"
  ingredienten  text,            -- één per regel
  bereiding     text,
  actief        boolean NOT NULL DEFAULT true,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door text
);

CREATE TABLE IF NOT EXISTS public.recept_fotos (
  id         bigserial PRIMARY KEY,
  recept_id  bigint NOT NULL REFERENCES public.recepten(id) ON DELETE CASCADE,
  pad        text NOT NULL,
  bijschrift text,
  volgorde   int NOT NULL DEFAULT 0,
  gezet_op   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recept_fotos_recept_idx
  ON public.recept_fotos (recept_id, volgorde);

-- Een MEP-taak kan naar een recept wijzen: "Pindasaus maken" → het recept.
ALTER TABLE public.mep_sjablonen
  ADD COLUMN IF NOT EXISTS recept_id bigint REFERENCES public.recepten(id) ON DELETE SET NULL;

-- Lezen mag iedereen die is ingelogd; schrijven alleen wie het recht heeft.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recepten', 'recept_fotos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    EXECUTE format('DROP POLICY IF EXISTS iedereen_leest ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY iedereen_leest ON public.%I FOR SELECT TO authenticated '
      'USING (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS mag_schrijven ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mag_schrijven ON public.%I FOR ALL TO authenticated '
      'USING (public.heeft_recht(''recepten'')) WITH CHECK (public.heeft_recht(''recepten''))', t);
  END LOOP;
END $$;

-- Foto's staan in de bak Documenten onder recepten/. Kijken mag iedereen die is
-- ingelogd; erin zetten alleen wie recepten mag bijhouden.
DROP POLICY IF EXISTS receptfotos_lezen ON storage.objects;
CREATE POLICY receptfotos_lezen ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'recepten'
    AND (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)
  );

DROP POLICY IF EXISTS receptfotos_schrijven ON storage.objects;
CREATE POLICY receptfotos_schrijven ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'recepten'
    AND public.heeft_recht('recepten')
  )
  WITH CHECK (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'recepten'
    AND public.heeft_recht('recepten')
  );

-- Even nakijken of de MEP-lijst goed is aangekomen bij de vorige migratie.
DO $$
BEGIN
  RAISE NOTICE 'MEP-taken in de lijst: %', (SELECT count(*) FROM public.mep_sjablonen);
END $$;
