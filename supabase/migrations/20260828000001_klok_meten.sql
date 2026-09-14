-- De klok van de database meten
--
-- De inlogfunctie krijgt "JWT issued at future" van PostgREST, met de eigen
-- serversleutel. Dat kan alleen als de klok van de database achterloopt: dan
-- lijkt elk token uitgegeven in de toekomst.

DO $$
BEGIN
  RAISE NOTICE 'database nu (UTC): %', (now() AT TIME ZONE 'UTC');
  RAISE NOTICE 'tijdzone: %', current_setting('TimeZone');
END $$;
