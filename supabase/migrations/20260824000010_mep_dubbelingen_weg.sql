-- De dubbele MEP-taken alsnog weg
--
-- De vorige migratie zette ze alleen uit omdat er oude dagelijsten naar
-- verwezen. Sander wil ze weg. Dat kan veilig: mep_dag_taken bewaart de naam in
-- een eigen kolom en de verwijzing staat op ON DELETE SET NULL, dus een oude
-- lijst blijft leesbaar — alleen het draadje naar de vaste lijst valt weg.

DO $$
DECLARE
  weg      int;
  losraakt int;
BEGIN
  SELECT count(*) INTO losraakt
    FROM public.mep_dag_taken
   WHERE sjabloon_id IN (1, 6, 14);

  DELETE FROM public.mep_sjablonen WHERE id IN (1, 6, 14);
  GET DIAGNOSTICS weg = ROW_COUNT;

  RAISE NOTICE 'dubbelingen verwijderd: %', weg;
  RAISE NOTICE 'oude dagelijsten die hun verwijzing kwijtraken (naam blijft staan): %', losraakt;
  RAISE NOTICE 'MEP-taken over: %, waarvan actief: %',
    (SELECT count(*) FROM public.mep_sjablonen),
    (SELECT count(*) FROM public.mep_sjablonen WHERE actief);
END $$;
