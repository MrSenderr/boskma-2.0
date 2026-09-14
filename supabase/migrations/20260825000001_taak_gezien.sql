-- Afgevinkte taken opmerken
--
-- Je geeft iemand een taak en hij vinkt hem af, maar dat kwam nergens terug —
-- alleen onderaan de pagina van die persoon. Bij vijf medewerkers is dat vijf
-- pagina's langs.
--
-- Met deze kolom kan een afgevinkte taak op het startscherm blijven staan tot
-- Sander hem heeft gezien, net als de gewijzigde gegevens en de reacties op
-- gespreksverslagen.

ALTER TABLE public.persoonlijke_taken
  ADD COLUMN IF NOT EXISTS gezien_op timestamptz;

CREATE INDEX IF NOT EXISTS persoonlijke_taken_gezien_idx
  ON public.persoonlijke_taken (gezien_op, gedaan_op DESC)
  WHERE gedaan_op IS NOT NULL;
