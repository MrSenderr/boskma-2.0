-- Temperatuurmetingen op naam van een ingelogde gebruiker
--
-- haccp_temps ging uit van employee_id: een nummer uit de oude app. De nieuwe
-- app logt in via Supabase Auth en heeft dus een gebruiker, geen nummer.
--
-- Alleen aanvullen, niets weghalen: de oude tabletapp schreef in dezelfde tabel
-- en die metingen blijven staan zoals ze staan.

ALTER TABLE public.haccp_temps
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.haccp_temps
  ADD COLUMN IF NOT EXISTS door_gebruiker uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS door_naam      text,
  -- Bij een afwijking is de meting niet af: er hoort bij wat je eraan gedaan
  -- hebt. Zonder dat heeft het logboek geen waarde bij een controle.
  ADD COLUMN IF NOT EXISTS actie          text,
  ADD COLUMN IF NOT EXISTS hermeting_op   timestamptz,
  ADD COLUMN IF NOT EXISTS meetmoment     text NOT NULL DEFAULT 'opening';

-- De tijd komt van de database, niet van het toestel. Een klok is te verzetten;
-- hiermee staat er altijd het werkelijke moment van registreren bij.
ALTER TABLE public.haccp_temps
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS haccp_temps_datum_idx ON public.haccp_temps (datum DESC);
