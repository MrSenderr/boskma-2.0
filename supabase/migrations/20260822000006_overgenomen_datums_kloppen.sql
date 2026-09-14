-- Datums van overgenomen medewerkers waarheidsgetrouw maken
--
-- Bij de overzetting kregen 'aangenomen op' en 'gegevens ingevuld op' de datum
-- van de overzetting zelf. Daardoor beweerde de tijdlijn dat tien medewerkers
-- vandaag hun formulier hadden ingevuld. Dat is niet gebeurd.
--
-- We zetten ze op de ingangsdatum van hun contract. Dat is niet het exacte
-- moment, maar het is wél waar en het leest niet als iets dat vandaag gebeurde.
-- Alleen rijen uit de oude app, en alleen waar de datum van vandaag is.

UPDATE public.sollicitaties
   SET aangenomen_op = COALESCE(ingangsdatum::timestamptz, aangemeld_op)
 WHERE oude_app_id IS NOT NULL
   AND aangenomen_op::date = CURRENT_DATE;

UPDATE public.sollicitaties
   SET onboarding_ingevuld_op = COALESCE(ingangsdatum::timestamptz, aangemeld_op)
 WHERE oude_app_id IS NOT NULL
   AND onboarding_ingevuld_op::date = CURRENT_DATE;
