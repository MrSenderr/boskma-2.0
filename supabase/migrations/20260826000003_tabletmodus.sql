-- Tablets in de zaak en de keuken
--
-- Zie docs/Modules/tablets.md. Besloten op 26 augustus 2026.
--
-- Een tablet hangt aan de muur en blijft ingelogd. Het probleem daarmee: als hij
-- ingelogd staat als Daan, dan staat er straks "Daan" onder een temperatuurronde
-- die Merle deed. Voor de MEP is dat vervelend, voor HACCP een probleem — dat
-- dossier moet herleidbaar zijn.
--
-- Daarom: de tablet krijgt een eigen account, en bij het aftikken kies je in één
-- tik wie je bent. Wat er wordt vastgelegd komt op naam van de gekozen persoon,
-- niet van het apparaat.

-- 1. Een account dat een apparaat is, geen mens ------------------------------
-- Zo'n record kan inloggen zoals een medewerker, maar hoort niet in de
-- personeelslijst en heeft geen loonbureau-gegevens nodig.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS is_apparaat boolean NOT NULL DEFAULT false;

-- Een apparaat mag inloggen zonder dat het naar het loonbureau is geweest: het
-- krijgt geen loon.
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
     AND (s.loonbureau_verstuurd_op IS NOT NULL OR s.is_apparaat)
     AND s.uit_dienst_op IS NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.huidige_medewerker() FROM public;
REVOKE EXECUTE ON FUNCTION public.huidige_medewerker() FROM anon;
GRANT EXECUTE ON FUNCTION public.huidige_medewerker() TO authenticated;

-- wie_ben_ik zegt er nu bij of je een apparaat bent; daar hangt in de app de
-- naamkeuze aan.
DROP FUNCTION IF EXISTS public.wie_ben_ik();
CREATE FUNCTION public.wie_ben_ik()
RETURNS TABLE (rol text, naam text, medewerker_id uuid, is_apparaat boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE WHEN public.is_app_user() THEN 'beheerder' ELSE 'medewerker' END,
    (SELECT btrim(concat_ws(' ', s.voornaam, s.achternaam))
       FROM public.sollicitaties s
      WHERE s.id = public.huidige_medewerker()),
    public.huidige_medewerker(),
    coalesce((SELECT s.is_apparaat FROM public.sollicitaties s
               WHERE s.id = public.huidige_medewerker()), false);
$$;

REVOKE ALL ON FUNCTION public.wie_ben_ik() FROM public;
REVOKE EXECUTE ON FUNCTION public.wie_ben_ik() FROM anon;
GRANT EXECUTE ON FUNCTION public.wie_ben_ik() TO authenticated;

-- 2. De namenlijst voor de keuze --------------------------------------------
-- Een tablet mag alleen zijn eigen rij uit sollicitaties lezen, dus de namen
-- moeten langs een functie. Die geeft niets meer dan een naam en een nummer —
-- geen adres, geen BSN, geen loon.

CREATE OR REPLACE FUNCTION public.wie_werkt_er()
RETURNS TABLE (id uuid, naam text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, btrim(concat_ws(' ', s.voornaam, s.achternaam))
    FROM public.sollicitaties s
   WHERE s.fase = 'medewerker'
     AND s.uit_dienst_op IS NULL
     AND NOT s.is_apparaat
     AND btrim(concat_ws(' ', s.voornaam, s.achternaam)) <> ''
   ORDER BY s.voornaam, s.achternaam;
$$;

REVOKE ALL ON FUNCTION public.wie_werkt_er() FROM public;
REVOKE EXECUTE ON FUNCTION public.wie_werkt_er() FROM anon;
GRANT EXECUTE ON FUNCTION public.wie_werkt_er() TO authenticated;

-- 3. Aftikken op naam van iemand anders --------------------------------------
-- taak_zetten schreef de naam van de ingelogde gebruiker weg. Op een tablet is
-- dat het apparaat, en dan klopt het logboek niet.

CREATE OR REPLACE FUNCTION public.taak_zetten(taak integer, gedaan boolean, door text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wie  uuid := auth.uid();
  naam text;
BEGIN
  IF public.huidige_medewerker() IS NULL AND NOT public.is_app_user() THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;

  -- Meegegeven naam wint: op een tablet is dat degene die het werkelijk deed.
  naam := nullif(btrim(coalesce(door, '')), '');
  IF naam IS NULL THEN
    SELECT n.naam INTO naam FROM public.wie_ben_ik() n;
  END IF;

  IF gedaan THEN
    INSERT INTO public.haccp_taak_gedaan (taak_id, datum, door_gebruiker, door_naam)
    VALUES (taak, CURRENT_DATE, wie, naam)
    ON CONFLICT (taak_id, datum) DO NOTHING;
  ELSE
    -- Alleen van vandaag. Wat er gisteren is afgetekend blijft staan; dat is het
    -- hele punt van een logboek. Op een tablet mag je ook het vinkje van een
    -- collega weghalen — je staat samen achter hetzelfde scherm.
    DELETE FROM public.haccp_taak_gedaan
     WHERE taak_id = taak
       AND datum = CURRENT_DATE
       AND (door_gebruiker = wie OR public.is_app_user());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.taak_zetten(integer, boolean, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.taak_zetten(integer, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.taak_zetten(integer, boolean, text) TO authenticated;
