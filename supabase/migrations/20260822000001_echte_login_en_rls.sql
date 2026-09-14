-- Echte login en sluitende RLS
--
-- Aanleiding: de anon-sleutel staat in de publiek geserveerde dist/index.html.
-- Daarmee waren boskma_state (BSN, IBAN, uurloon) en sollicitaties
-- (onboarding_data met BSN en IBAN) voor iedereen op te halen.
--
-- Na deze migratie geldt:
--   * de beheerapp logt in via Supabase Auth en stuurt een gebruikers-token mee;
--   * beheertabellen zijn alleen leesbaar/schrijfbaar voor een ingelogde
--     gebruiker die op de lijst in is_app_user() staat;
--   * de Pi-schermen en de publieke F1-pagina houden anon-toegang, want die
--     kunnen niet inloggen. Daar staat geen persoonsgegeven in.

-- 1. Wie mag de beheerapp gebruiken -------------------------------------------
-- Eén plek om te bepalen wie toegang heeft. Een gebruiker toevoegen is straks
-- deze functie aanpassen; publieke aanmelding in Supabase geeft dus géén
-- toegang tot de gegevens.

CREATE OR REPLACE FUNCTION public.is_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (auth.jwt() ->> 'email') IN (
      'sander@boskmafoodservice.nl'
      -- iemand toegang geven: hier een regel bij, en een account aanmaken
      -- onder Authentication → Users. Tessa (tessa@storyofjuly.nl) had
      -- schermenbeheer; die modus zit nog in de app en gaat weer werken zodra
      -- haar adres hier terugstaat.
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_user() FROM public;
GRANT EXECUTE ON FUNCTION public.is_app_user() TO authenticated;

-- 2. Beheertabellen: alleen voor ingelogde app-gebruikers ---------------------
-- Alle bestaande policies gaan eraf, zodat er geen oude "anon mag alles" blijft
-- staan die we over het hoofd zien. Edge Functions draaien met de service role
-- en gaan sowieso langs RLS heen; die blijven dus gewoon werken.

DO $$
DECLARE
  doel text;
  pol  record;
  tabellen text[] := ARRAY[
    'boskma_state',
    'medewerker_gegevens',
    'employee_pins',
    'haccp_apparaten','haccp_taken','haccp_temps','haccp_checklists',
    'haccp_leveringen','haccp_week_status',
    'mep_sjablonen','mep_dag_taken','notities','taak_info',
    'inkoop_artikelen','inkoop_artikel_alias','inkoop_regels',
    'inkoop_documenten','inkoop_leveranciers',
    'kermis_persoon','kermis_inzet','kermis_dag',
    'dagboek_dagen','dagboek_events',
    'bestellen_producten','bestellen_categorieen','bestellen_locaties',
    'bestellen_orders','bestellen_regels','bestellen_gebruikers'
  ];
BEGIN
  FOREACH doel IN ARRAY tabellen LOOP
    IF to_regclass('public.' || quote_ident(doel)) IS NULL THEN
      RAISE NOTICE 'tabel % bestaat niet, overgeslagen', doel;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = doel
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, doel);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', doel);
    EXECUTE format(
      'CREATE POLICY app_gebruiker ON public.%I FOR ALL TO authenticated '
      'USING (public.is_app_user()) WITH CHECK (public.is_app_user())', doel);

    -- anon heeft hier niets meer te zoeken
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', doel);
  END LOOP;
END $$;

-- 2b. Sollicitaties: binnenkomen mag, teruglezen niet ------------------------
-- werkenbij.snackerietzonnetje.nl dient hier met de publieke sleutel een
-- sollicitatie in (POST, return=minimal). Dat moet blijven werken. Lezen,
-- wijzigen en verwijderen kan alleen nog vanuit de beheerapp — en dat is precies
-- waar het om ging, want in onboarding_data staan BSN en IBAN.

DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('public.sollicitaties') IS NULL THEN
    RAISE NOTICE 'tabel sollicitaties bestaat niet, overgeslagen';
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sollicitaties'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sollicitaties', pol.policyname);
  END LOOP;

  ALTER TABLE public.sollicitaties ENABLE ROW LEVEL SECURITY;

  CREATE POLICY app_gebruiker ON public.sollicitaties
    FOR ALL TO authenticated
    USING (public.is_app_user()) WITH CHECK (public.is_app_user());

  -- alleen indienen; het onboarding-formulier wordt later door een Edge
  -- Function ingevuld en mag hier dus niet meekomen
  CREATE POLICY sollicitatie_indienen ON public.sollicitaties
    FOR INSERT TO anon
    WITH CHECK (onboarding_data IS NULL);

  REVOKE ALL ON public.sollicitaties FROM anon;
  GRANT INSERT ON public.sollicitaties TO anon;
END $$;

-- 3. Schermen en publieke pagina's: anon blijft nodig -------------------------
-- De Pi's en de F1-pagina kunnen niet inloggen. Hier staan geen
-- persoonsgegevens in, alleen afbeeldingen, roosters en cache. De beheerapp is
-- na deze migratie 'authenticated' en heeft er dus óók een policy voor nodig.

DO $$
DECLARE
  doel text;
  pol  record;
  tabellen text[] := ARRAY[
    'screens','screen_schedules','screen_commands','screen_images',
    'screen_rotatie','f1_live_cache','page_views'
  ];
BEGIN
  FOREACH doel IN ARRAY tabellen LOOP
    IF to_regclass('public.' || quote_ident(doel)) IS NULL THEN
      RAISE NOTICE 'tabel % bestaat niet, overgeslagen', doel;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = doel
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, doel);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', doel);
    EXECUTE format(
      'CREATE POLICY scherm_toegang ON public.%I FOR ALL TO anon, authenticated '
      'USING (true) WITH CHECK (true)', doel);
  END LOOP;
END $$;

-- 4. Opslag: de ingelogde app moet bij haar eigen buckets ---------------------
-- Dit is een extra policy naast wat er al staat; bestaande anon-toegang voor de
-- schermafbeeldingen blijft dus ongemoeid.

DROP POLICY IF EXISTS app_gebruiker_objecten ON storage.objects;
CREATE POLICY app_gebruiker_objecten ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('Documenten','taak-fotos','screen-images') AND public.is_app_user())
  WITH CHECK (bucket_id IN ('Documenten','taak-fotos','screen-images') AND public.is_app_user());
