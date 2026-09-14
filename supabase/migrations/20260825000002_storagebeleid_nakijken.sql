-- Nakijken wie er in de bak Documenten mag schrijven
--
-- De loonheffingsverklaring gaat niet mee naar het loonbureau. Vermoeden: het
-- onboardingformulier zet het pad wel in onboarding_data, maar de upload zelf
-- gaat met de publieke sleutel — en die is bij het afsluiten van augustus
-- mogelijk buitengesloten. Dan staat er een pad naar een bestand dat er niet is.

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, cmd, roles::text AS voor,
           coalesce(qual, '') AS lezen, coalesce(with_check, '') AS schrijven
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
     ORDER BY policyname
  LOOP
    RAISE NOTICE '% | % | voor % | check: %',
      p.policyname, p.cmd, p.voor, left(p.schrijven, 90);
  END LOOP;

  RAISE NOTICE 'bestanden onder loonheffing/: %',
    (SELECT count(*) FROM storage.objects WHERE bucket_id = 'Documenten' AND name LIKE 'loonheffing/%');
  RAISE NOTICE 'bestanden onder id-kopie/: %',
    (SELECT count(*) FROM storage.objects WHERE bucket_id = 'Documenten' AND name LIKE 'id-kopie/%');
END $$;
