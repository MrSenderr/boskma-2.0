-- Taken aftikken
--
-- Eén regel per taak per dag, met wie hem afvinkte. Zie
-- docs/modules/haccp/haccpmodule.md.
--
-- Bewust niet één regel per lijst met een lijstje erin: bij de sluitlijst werken
-- meerdere mensen tegelijk aan verschillende hoeken, en dan moet per taak
-- vaststaan wie hem deed.

CREATE TABLE IF NOT EXISTS public.haccp_taak_gedaan (
  id             bigserial PRIMARY KEY,
  taak_id        integer NOT NULL REFERENCES public.haccp_taken(id) ON DELETE CASCADE,
  datum          date NOT NULL DEFAULT CURRENT_DATE,
  gedaan_op      timestamptz NOT NULL DEFAULT now(),
  door_gebruiker uuid REFERENCES auth.users(id),
  door_naam      text,
  UNIQUE (taak_id, datum)
);

CREATE INDEX IF NOT EXISTS haccp_taak_gedaan_datum_idx
  ON public.haccp_taak_gedaan (datum DESC);

ALTER TABLE public.haccp_taak_gedaan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_gebruiker ON public.haccp_taak_gedaan;
CREATE POLICY app_gebruiker ON public.haccp_taak_gedaan
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker_leest ON public.haccp_taak_gedaan;
CREATE POLICY medewerker_leest ON public.haccp_taak_gedaan
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

REVOKE ALL ON public.haccp_taak_gedaan FROM anon;

-- Aan- en uitvinken gaat via deze functie, niet via losse rechten op de tabel.
-- Zo kan er alleen vandaag iets veranderen: gisteren aftikken of een oude regel
-- weghalen kan niemand.
CREATE OR REPLACE FUNCTION public.taak_zetten(taak integer, gedaan boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wie   uuid := auth.uid();
  naam  text;
BEGIN
  IF public.huidige_medewerker() IS NULL AND NOT public.is_app_user() THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;

  SELECT n.naam INTO naam FROM public.wie_ben_ik() n;

  IF gedaan THEN
    INSERT INTO public.haccp_taak_gedaan (taak_id, datum, door_gebruiker, door_naam)
    VALUES (taak, CURRENT_DATE, wie, naam)
    ON CONFLICT (taak_id, datum) DO NOTHING;
  ELSE
    -- Alleen van vandaag, en alleen je eigen vinkje. Wat er gisteren is
    -- afgetekend blijft staan; dat is het hele punt van een logboek.
    DELETE FROM public.haccp_taak_gedaan
     WHERE taak_id = taak
       AND datum = CURRENT_DATE
       AND (door_gebruiker = wie OR public.is_app_user());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.taak_zetten(integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.taak_zetten(integer, boolean) TO authenticated;
