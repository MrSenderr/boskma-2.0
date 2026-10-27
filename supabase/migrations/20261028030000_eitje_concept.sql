-- Wat de app in eitje heeft gezet
--
-- Zonder dit kun je niet twee keer op de knop drukken. Een voorstel wijzigt:
-- iemand meldt zich ziek, je schuift een dienst, je draait hem opnieuw. Komt
-- er dan een tweede keer een rooster bij in plaats van eroverheen, dan staat
-- het dubbel in eitje en moet jij het daar met de hand uit elkaar halen.
--
-- Hier staat per dienst het nummer dat eitje eraan gaf. Bij een volgende ronde
-- haalt de app eerst díe diensten weg en zet daarna het nieuwe rooster neer.
-- Alleen wat we zelf hebben aangemaakt dus — een dienst die jij in eitje met de
-- hand hebt gezet, staat hier niet in en wordt nooit aangeraakt.

CREATE TABLE IF NOT EXISTS public.eitje_concept (
  -- Het nummer van de planningsdienst in eitje.
  bron_id        text PRIMARY KEY,
  datum          date NOT NULL,
  begint         time NOT NULL,
  eindigt        time NOT NULL,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE SET NULL,
  eitje_user_id  integer,
  geschreven_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eitje_concept_datum_idx ON public.eitje_concept (datum);

ALTER TABLE public.eitje_concept ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eitje_concept FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.eitje_concept;
CREATE POLICY app_gebruiker ON public.eitje_concept
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

NOTIFY pgrst, 'reload schema';
