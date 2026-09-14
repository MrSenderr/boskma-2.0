-- De tabletaccounts weer weghalen
--
-- De tabletmodus hangt sinds vandaag aan het adres (/keuken en /zaak), niet meer
-- aan het ingelogde account. Deze twee records stonden alleen maar in de weg.
--
-- Er is met de keukentablet al gewerkt: er staan werklijstvinkjes op zijn naam.
-- Die blijven staan — dat is het logboek. Alleen de technische verwijzing naar
-- het inlogaccount wordt losgemaakt; de naam staat in een eigen kolom en blijft
-- dus leesbaar.

DO $$
DECLARE
  ids uuid[];
  fk  record;
  weg int;
BEGIN
  SELECT array_agg(id) INTO ids
    FROM auth.users
   WHERE lower(email) IN (
     'sander+keukentablet@boskmafoodservice.nl',
     'sander+zaaktablet@boskmafoodservice.nl'
   );

  IF ids IS NULL THEN
    RAISE NOTICE 'geen tabletaccounts gevonden; niets te doen';
    RETURN;
  END IF;

  -- Elke kolom die naar auth.users wijst losmaken, welke tabel het ook is.
  FOR fk IN
    SELECT c.conrelid::regclass AS tabel, a.attname AS kolom
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'auth.users'::regclass
       AND array_length(c.conkey, 1) = 1
       AND NOT a.attnotnull
  LOOP
    EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY($1)', fk.tabel, fk.kolom, fk.kolom)
      USING ids;
    GET DIAGNOSTICS weg = ROW_COUNT;
    IF weg > 0 THEN
      RAISE NOTICE 'losgemaakt in %.%: % rijen', fk.tabel, fk.kolom, weg;
    END IF;
  END LOOP;

  DELETE FROM auth.users WHERE id = ANY (ids);
  GET DIAGNOSTICS weg = ROW_COUNT;
  RAISE NOTICE 'inlogaccounts verwijderd: %', weg;

  DELETE FROM public.sollicitaties
   WHERE is_apparaat
     AND lower(email) IN (
       'sander+keukentablet@boskmafoodservice.nl',
       'sander+zaaktablet@boskmafoodservice.nl'
     );
  GET DIAGNOSTICS weg = ROW_COUNT;
  RAISE NOTICE 'personeelsrijen verwijderd: %', weg;

  RAISE NOTICE 'apparaatrijen over: %', (SELECT count(*) FROM public.sollicitaties WHERE is_apparaat);
END $$;
