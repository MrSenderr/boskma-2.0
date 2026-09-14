-- Instellingen, met testmodus als eerste
--
-- Testmodus staat standaard AAN: zolang hij aan staat gaat elke uitgaande mail
-- naar het testadres in plaats van naar de medewerker of het loonbureau.
--
-- Bewust in de database en niet in een omgevingsvariabele: Sander moet hem zelf
-- kunnen omzetten vanuit de app, zonder dat er iets opnieuw uitgerold hoeft te
-- worden. De Edge Functions lezen hem met de service role.

CREATE TABLE IF NOT EXISTS public.instellingen (
  sleutel        text PRIMARY KEY,
  waarde         jsonb NOT NULL,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door text
);

ALTER TABLE public.instellingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_gebruiker ON public.instellingen;
CREATE POLICY app_gebruiker ON public.instellingen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

REVOKE ALL ON public.instellingen FROM anon;

INSERT INTO public.instellingen (sleutel, waarde)
VALUES ('testmodus', '{"aan": true, "adres": "testmail@boskmafoodservice.nl"}'::jsonb)
ON CONFLICT (sleutel) DO NOTHING;
