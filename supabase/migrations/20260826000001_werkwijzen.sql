-- Werkwijzen: uitleg met stappen en foto's
--
-- Zie docs/Modules/werkwijzen.md. Besloten op 26 augustus 2026.
--
-- Naast recepten, niet erin. Een recept gaat over iets maken met ingrediënten;
-- een werkwijze gaat over hoe je iets doet — sla drogen, filters schoonmaken.
-- Dat laatste heeft geen ingrediënten en dan is "recept" het verkeerde woord.
--
-- Genummerde stappen met per stap een foto, want dat is hoe je het volgt terwijl
-- je ermee bezig bent.

CREATE TABLE IF NOT EXISTS public.werkwijzen (
  id              bigserial PRIMARY KEY,
  naam            text NOT NULL,
  omschrijving    text,
  actief          boolean NOT NULL DEFAULT true,
  aangemaakt_op   timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op   timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door text
);

CREATE TABLE IF NOT EXISTS public.werkwijze_stappen (
  id           bigserial PRIMARY KEY,
  werkwijze_id bigint NOT NULL REFERENCES public.werkwijzen(id) ON DELETE CASCADE,
  volgorde     int NOT NULL DEFAULT 0,
  tekst        text NOT NULL,
  foto_pad     text
);

CREATE INDEX IF NOT EXISTS werkwijze_stappen_idx
  ON public.werkwijze_stappen (werkwijze_id, volgorde);

-- Koppelen aan het werk: een MEP-taak en een taak op een werklijst. Dat zijn de
-- twee plekken waar iemand tijdens het werk denkt: hoe ging dat ook alweer?
ALTER TABLE public.mep_sjablonen
  ADD COLUMN IF NOT EXISTS werkwijze_id bigint REFERENCES public.werkwijzen(id) ON DELETE SET NULL;

ALTER TABLE public.haccp_taken
  ADD COLUMN IF NOT EXISTS werkwijze_id bigint REFERENCES public.werkwijzen(id) ON DELETE SET NULL;

-- Lezen mag iedereen die is ingelogd; schrijven wie recepten mag bijhouden.
-- Hetzelfde soort werk, dus geen apart vinkje.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['werkwijzen', 'werkwijze_stappen'] LOOP
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

-- Foto's staan in de bak Documenten onder werkwijzen/.
DROP POLICY IF EXISTS werkwijzefotos_lezen ON storage.objects;
CREATE POLICY werkwijzefotos_lezen ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'werkwijzen'
    AND (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)
  );

DROP POLICY IF EXISTS werkwijzefotos_schrijven ON storage.objects;
CREATE POLICY werkwijzefotos_schrijven ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'werkwijzen'
    AND public.heeft_recht('recepten')
  )
  WITH CHECK (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'werkwijzen'
    AND public.heeft_recht('recepten')
  );
