-- Verjaardagen en persoonlijke taken op het Vandaag-scherm
--
-- Besloten op 23 augustus 2026:
--   * collega's zien van elkaar de naam en de dag, niet het geboortejaar
--   * een persoonlijke taak is een losse klus met een datum, toegewezen aan één
--     persoon, los van de vaste werklijsten

-- 1. Verjaardagen zonder geboortejaar -----------------------------------------
-- Een medewerker mag de rij van een collega niet lezen. Deze functie geeft
-- daarom precies wat er nodig is en niets meer: geen jaar, geen id, geen adres.

CREATE OR REPLACE FUNCTION public.verjaardagen()
RETURNS TABLE (naam text, dag integer, maand integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT trim(concat_ws(' ', s.voornaam, s.achternaam)),
         extract(day   from s.geboortedatum)::int,
         extract(month from s.geboortedatum)::int
    FROM public.sollicitaties s
   WHERE s.fase = 'medewerker'
     AND s.uit_dienst_op IS NULL
     AND s.geboortedatum IS NOT NULL
     -- alleen voor wie zelf in de app hoort
     AND (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.verjaardagen() FROM public;
GRANT EXECUTE ON FUNCTION public.verjaardagen() TO authenticated;

-- 2. Persoonlijke taken --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.persoonlijke_taken (
  id             bigserial PRIMARY KEY,
  medewerker_id  uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  tekst          text NOT NULL,
  toelichting    text,
  datum          date NOT NULL DEFAULT CURRENT_DATE,
  gedaan_op      timestamptz,
  aangemaakt_op  timestamptz NOT NULL DEFAULT now(),
  aangemaakt_door text
);

CREATE INDEX IF NOT EXISTS persoonlijke_taken_medewerker_idx
  ON public.persoonlijke_taken (medewerker_id, datum);

ALTER TABLE public.persoonlijke_taken ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_gebruiker ON public.persoonlijke_taken;
CREATE POLICY app_gebruiker ON public.persoonlijke_taken
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

-- Een medewerker ziet alleen zijn eigen taken, en kan ze niet aanmaken,
-- wijzigen of weggooien. Afvinken gaat via de functie hieronder, die precies
-- één veld aanraakt.
DROP POLICY IF EXISTS medewerker_eigen_taken ON public.persoonlijke_taken;
CREATE POLICY medewerker_eigen_taken ON public.persoonlijke_taken
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker());

REVOKE ALL ON public.persoonlijke_taken FROM anon;

-- 3. Afvinken ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.taak_afvinken(taak bigint, gedaan boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.persoonlijke_taken
     SET gedaan_op = CASE WHEN gedaan THEN now() ELSE NULL END
   WHERE id = taak
     AND (medewerker_id = public.huidige_medewerker() OR public.is_app_user());
END;
$$;

REVOKE ALL ON FUNCTION public.taak_afvinken(bigint, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.taak_afvinken(bigint, boolean) TO authenticated;
