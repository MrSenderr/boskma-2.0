-- De API-laag opnieuw laten kijken naar de functies
--
-- wie_ben_ik kreeg er een kolom bij (is_apparaat), maar PostgREST houdt de vorm
-- van functies in het geheugen. Zolang die cache niet ververst is, geeft de API
-- de oude vorm terug — zonder is_apparaat — en denkt de app dat een tablet een
-- gewone medewerker is.
--
-- Dit is precies waarom de tabletmodus niet aansloeg: de database klopte, de app
-- klopte, en de laag ertussen gaf een verouderd antwoord.

NOTIFY pgrst, 'reload schema';

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '--- wat wie_ben_ik teruggeeft ---';
  FOR r IN
    SELECT p.ordinal_position AS nr, p.parameter_name AS naam
      FROM information_schema.parameters p
      JOIN information_schema.routines f ON f.specific_name = p.specific_name
     WHERE f.routine_schema = 'public' AND f.routine_name = 'wie_ben_ik'
       AND p.parameter_mode = 'OUT'
     ORDER BY p.ordinal_position
  LOOP
    RAISE NOTICE '  % %', r.nr, r.naam;
  END LOOP;
END $$;
