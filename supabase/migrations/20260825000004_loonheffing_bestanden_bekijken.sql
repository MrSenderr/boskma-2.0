-- Welke verklaringen liggen er, en bij wie horen ze?
--
-- Er staan zestien bestanden onder loonheffing/ maar maar één medewerker heeft
-- een pad in zijn gegevens. De bestandsnaam bevat de naam, dus daar valt uit af
-- te leiden bij wie ze horen.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.name,
           coalesce((o.metadata ->> 'size')::numeric, 0)::int / 1024 AS kb,
           o.created_at::date AS gemaakt
      FROM storage.objects o
     WHERE o.bucket_id = 'Documenten' AND o.name LIKE 'loonheffing/%'
     ORDER BY o.created_at
  LOOP
    RAISE NOTICE '% | % kB | %', r.gemaakt, r.kb, right(r.name, 60);
  END LOOP;
END $$;
