-- Wat een medewerker extra mag
--
-- Zie docs/Modules/rechten.md. Besloten op 24 augustus 2026.
--
-- Tot nu toe waren er twee soorten mensen: Sander (is_app_user) en medewerkers.
-- Voor de recepten is daar een tussenvorm nodig — "jij en wie je aanwijst".
--
-- Losse vinkjes, geen rollen: iemand die de recepten bijhoudt hoeft daarom nog
-- niet bij het personeel te kunnen. Een tabel en geen kolommen, zodat er later
-- een recht bij kan zonder migratie van de medewerkersgegevens.

CREATE TABLE IF NOT EXISTS public.medewerker_rechten (
  medewerker_id uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  recht         text NOT NULL CHECK (recht IN ('recepten', 'mep', 'haccp')),
  gegeven_op    timestamptz NOT NULL DEFAULT now(),
  gegeven_door  text,
  PRIMARY KEY (medewerker_id, recht)
);

ALTER TABLE public.medewerker_rechten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medewerker_rechten FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.medewerker_rechten;
CREATE POLICY app_gebruiker ON public.medewerker_rechten
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

-- Je mag zien wat je zelf mag; uitdelen kan alleen Sander.
DROP POLICY IF EXISTS medewerker_eigen ON public.medewerker_rechten;
CREATE POLICY medewerker_eigen ON public.medewerker_rechten
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker());

-- De enige plek waar "mag deze persoon dit" wordt beantwoord. Schermen mogen
-- knoppen verbergen, maar de grens ligt hier.
CREATE OR REPLACE FUNCTION public.heeft_recht(p_recht text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_app_user()
      OR EXISTS (
           SELECT 1 FROM public.medewerker_rechten r
            WHERE r.medewerker_id = public.huidige_medewerker()
              AND r.recht = p_recht
         );
$$;

REVOKE ALL ON FUNCTION public.heeft_recht(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.heeft_recht(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.heeft_recht(text) TO authenticated;
