-- Personeelsmodule: sollicitant en medewerker in één lijst
--
-- Zie docs/modules/personeel/personeelsmodule.md.
--
-- Alleen nieuwe kolommen, niets gewijzigd of verwijderd: de oude app patcht
-- losse velden en blijft dus gewoon werken.

ALTER TABLE public.sollicitaties
  -- 'sollicitant' of 'medewerker'. Aannemen zet dit om.
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT 'sollicitant',
  ADD COLUMN IF NOT EXISTS aangenomen_op           timestamptz,
  ADD COLUMN IF NOT EXISTS loonbureau_verstuurd_op timestamptz,
  ADD COLUMN IF NOT EXISTS loonbureau_bevestigd_op timestamptz,
  ADD COLUMN IF NOT EXISTS uit_dienst_op           timestamptz;

ALTER TABLE public.sollicitaties
  DROP CONSTRAINT IF EXISTS sollicitaties_fase_check;
ALTER TABLE public.sollicitaties
  ADD CONSTRAINT sollicitaties_fase_check
  CHECK (fase IN ('sollicitant', 'medewerker'));

-- De status van een medewerker wordt niet apart bijgehouden maar afgeleid uit
-- de tijdstippen hierboven plus de bestaande onboarding-velden. Zo kan er geen
-- toestand ontstaan die niet klopt met de feiten.

-- Bestaande rijen: wie al was aangenomen, is een medewerker.
UPDATE public.sollicitaties
   SET fase = 'medewerker',
       aangenomen_op = COALESCE(aangenomen_op, onboarding_verstuurd_op, aangemeld_op)
 WHERE status = 'aangenomen'
   AND fase = 'sollicitant';

CREATE INDEX IF NOT EXISTS sollicitaties_fase_idx ON public.sollicitaties (fase);
