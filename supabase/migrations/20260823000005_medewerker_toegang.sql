-- Inloggen per persoon: wie is er ingelogd, en wat mag die zien
--
-- Zie docs/modules/personeel/personeelsmodule.md — "Wat een medewerker zelf kan".
--
-- De toegangsregel staat in één functie: een medewerker kan pas inloggen zodra
-- zijn dossier naar het loonbureau is, en niet meer zodra hij uit dienst is.
-- Verandert die regel, dan verandert hij op één plek.

CREATE OR REPLACE FUNCTION public.huidige_medewerker()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
    FROM public.sollicitaties s
   WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
     AND s.fase = 'medewerker'
     AND s.loonbureau_verstuurd_op IS NOT NULL
     AND s.uit_dienst_op IS NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.huidige_medewerker() FROM public;
GRANT EXECUTE ON FUNCTION public.huidige_medewerker() TO authenticated;

-- 1. Zijn eigen kaart, en alleen die ------------------------------------------
-- Beleid wordt bij elkaar opgeteld: Sander houdt zijn volledige toegang via
-- app_gebruiker, hier komt alleen het recht van de medewerker op zijn eigen rij
-- bij. Wijzigen kan hij hiermee niet — dat gaat straks via aparte functies met
-- precies de velden die hij mag aanraken.

DROP POLICY IF EXISTS medewerker_eigen_rij ON public.sollicitaties;
CREATE POLICY medewerker_eigen_rij ON public.sollicitaties
  FOR SELECT TO authenticated
  USING (id = public.huidige_medewerker());

-- 2. Wat hij nodig heeft om te kunnen aftekenen -------------------------------

DROP POLICY IF EXISTS medewerker_leest_apparaten ON public.haccp_apparaten;
CREATE POLICY medewerker_leest_apparaten ON public.haccp_apparaten
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_leest_taken ON public.haccp_taken;
CREATE POLICY medewerker_leest_taken ON public.haccp_taken
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

-- 3. Registreren mag, weggooien niet ------------------------------------------
-- Een medewerker mag metingen toevoegen en de zijne teruglezen. Wijzigen en
-- verwijderen kan hij niet: een logboek waar dingen uit kunnen verdwijnen is
-- geen logboek.

DROP POLICY IF EXISTS medewerker_meet ON public.haccp_temps;
CREATE POLICY medewerker_meet ON public.haccp_temps
  FOR INSERT TO authenticated
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

DROP POLICY IF EXISTS medewerker_leest_metingen ON public.haccp_temps;
CREATE POLICY medewerker_leest_metingen ON public.haccp_temps
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

-- 4. Weten wie je bent zonder de hele tabel te mogen lezen --------------------
-- De app moet na het inloggen kunnen vaststellen of iemand beheerder is of
-- medewerker, en hoe hij heet. Deze functie geeft precies dat, en niets meer.

CREATE OR REPLACE FUNCTION public.wie_ben_ik()
RETURNS TABLE (rol text, naam text, medewerker_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE WHEN public.is_app_user() THEN 'beheerder' ELSE 'medewerker' END,
    COALESCE(
      (SELECT trim(concat_ws(' ', s.voornaam, s.achternaam))
         FROM public.sollicitaties s
        WHERE s.id = public.huidige_medewerker()),
      auth.jwt() ->> 'email'
    ),
    public.huidige_medewerker();
$$;

REVOKE ALL ON FUNCTION public.wie_ben_ik() FROM public;
GRANT EXECUTE ON FUNCTION public.wie_ben_ik() TO authenticated;
