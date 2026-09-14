-- Nakijken waarom een tablet zich niet als tablet gedraagt

DO $$
DECLARE r record;
BEGIN
  RAISE NOTICE '--- apparaatrijen ---';
  FOR r IN
    SELECT email, fase, is_apparaat, loonbureau_verstuurd_op IS NOT NULL AS naar_lb, uit_dienst_op
      FROM public.sollicitaties WHERE is_apparaat ORDER BY email
  LOOP
    RAISE NOTICE '  % | fase=% | apparaat=% | naar loonbureau=% | uit dienst=%',
      r.email, r.fase, r.is_apparaat, r.naar_lb, coalesce(r.uit_dienst_op::text, '-');
  END LOOP;

  RAISE NOTICE '--- kolommen die wie_ben_ik teruggeeft ---';
  FOR r IN
    SELECT p.ordinal_position AS nr, p.parameter_name AS naam, p.data_type AS soort
      FROM information_schema.parameters p
      JOIN information_schema.routines f
        ON f.specific_name = p.specific_name
     WHERE f.routine_schema = 'public' AND f.routine_name = 'wie_ben_ik'
       AND p.parameter_mode = 'OUT'
     ORDER BY p.ordinal_position
  LOOP
    RAISE NOTICE '  % % (%)', r.nr, r.naam, r.soort;
  END LOOP;

  RAISE NOTICE '--- staat er een auth-account voor de tablets? ---';
  FOR r IN
    SELECT s.email, (u.id IS NOT NULL) AS heeft_account
      FROM public.sollicitaties s
      LEFT JOIN auth.users u ON lower(u.email) = lower(s.email)
     WHERE s.is_apparaat ORDER BY s.email
  LOOP
    RAISE NOTICE '  % | account=%', r.email, r.heeft_account;
  END LOOP;
END $$;
