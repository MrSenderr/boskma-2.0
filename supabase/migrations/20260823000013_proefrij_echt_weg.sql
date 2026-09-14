-- Proefsollicitatie opruimen, nu zonder aanname over aangemeld_op
--
-- De vorige poging leunde op aangemeld_op > now() - 1 uur. Staat die kolom leeg
-- bij een rij die via het formulier binnenkomt, dan is die voorwaarde NULL en
-- wordt er niets verwijderd. Nu op de rij zelf: die naam, en geen enkel
-- contactgegeven — een echte sollicitant heeft die altijd.

DO $$
DECLARE weg int;
BEGIN
  DELETE FROM public.sollicitaties
   WHERE voornaam = 'Test'
     AND achternaam = 'Probe'
     AND fase = 'sollicitant'
     AND coalesce(email, '') = ''
     AND coalesce(telefoonnummer, '') = ''
     AND onboarding_data IS NULL;
  GET DIAGNOSTICS weg = ROW_COUNT;
  RAISE NOTICE 'proefrijen verwijderd: %', weg;
END $$;
