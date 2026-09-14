-- HACCP: apparaten volledig zelf in te richten
--
-- Zie docs/modules/haccp/haccpmodule.md. Uitgangspunt: geen enkel apparaat
-- staat in de code. Sander voegt ze toe, wijzigt ze en zet ze op non-actief.
--
-- De tabel haccp_apparaten bestond al met naam, type, actief, min_temp,
-- max_temp en volgorde. Wat er nog bij moet is het meetmoment.

ALTER TABLE public.haccp_apparaten
  -- 'opening', 'sluiting' of 'beide'. Standaard bij opening.
  ADD COLUMN IF NOT EXISTS meetmoment text NOT NULL DEFAULT 'opening',
  -- eigen signaalgrens, strenger dan de wettelijke: dan zie je een wegzakkende
  -- koeling dagen eerder. Leeg = niet gebruiken.
  ADD COLUMN IF NOT EXISTS signaal_min numeric(5,1),
  ADD COLUMN IF NOT EXISTS signaal_max numeric(5,1),
  ADD COLUMN IF NOT EXISTS opmerking text;

ALTER TABLE public.haccp_apparaten
  DROP CONSTRAINT IF EXISTS haccp_apparaten_meetmoment_check;
ALTER TABLE public.haccp_apparaten
  ADD CONSTRAINT haccp_apparaten_meetmoment_check
  CHECK (meetmoment IN ('opening', 'sluiting', 'beide'));

-- Een apparaat dat weggaat wordt op non-actief gezet, niet verwijderd: anders
-- verdwijnen de metingen van vorig jaar uit het logboek. Verwijderen blijft
-- mogelijk zolang er nog niets mee gemeten is.
CREATE OR REPLACE FUNCTION public.apparaat_heeft_metingen(apparaat integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.haccp_temps WHERE apparaat_id = apparaat);
$$;

GRANT EXECUTE ON FUNCTION public.apparaat_heeft_metingen(integer) TO authenticated;
