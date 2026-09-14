-- Komen de opgeslagen paden overeen met bestaande bestanden?
--
-- De bestanden staan er (16 stuks) en het pad staat in onboarding_data. De vraag
-- is of ze bij elkaar horen.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s.voornaam, s.achternaam,
           s.onboarding_data ->> 'loonheffing_pdf' AS pad,
           EXISTS (
             SELECT 1 FROM storage.objects o
              WHERE o.bucket_id = 'Documenten'
                AND o.name = s.onboarding_data ->> 'loonheffing_pdf'
           ) AS bestaat
      FROM public.sollicitaties s
     WHERE s.fase = 'medewerker'
       AND s.onboarding_data ? 'loonheffing_pdf'
     ORDER BY s.achternaam
  LOOP
    RAISE NOTICE '% % | % | %', r.voornaam, r.achternaam,
      CASE WHEN r.bestaat THEN 'bestand gevonden' ELSE 'BESTAND ONTBREEKT' END,
      left(coalesce(r.pad, '(leeg)'), 70);
  END LOOP;

  RAISE NOTICE '--- medewerkers zonder loonheffing_pdf in hun gegevens: %',
    (SELECT count(*) FROM public.sollicitaties
      WHERE fase = 'medewerker' AND onboarding_data IS NOT NULL
        AND NOT (onboarding_data ? 'loonheffing_pdf'));
END $$;
