-- Twee versies van taak_zetten
--
-- Bij het toevoegen van de parameter 'door' is er een nieuwe functie ontstaan in
-- plaats van dat de oude verving: CREATE OR REPLACE kijkt naar de handtekening,
-- en die veranderde. Sindsdien bestaan taak_zetten(int, boolean) en
-- taak_zetten(int, boolean, text) naast elkaar.
--
-- Gevolg: een aanroep met twee argumenten past op allebei — de derde heeft een
-- standaardwaarde — en dan weigert PostgREST te kiezen. Aftikken op een
-- werklijst deed daardoor niets, zonder zichtbare fout.

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT oid::regprocedure AS handtekening
      FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname = 'taak_zetten'
  LOOP
    RAISE NOTICE 'gevonden: %', f.handtekening;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.taak_zetten(integer, boolean);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND proname = 'taak_zetten';
  RAISE NOTICE 'taak_zetten-versies over: %', n;
END $$;
