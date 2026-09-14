-- Adressen van overgenomen medewerkers uit elkaar halen
--
-- De oude app bewaarde het adres als één regel: "Dwarsland 30, 1619 GG Andijk".
-- Bij de overzetting is die hele regel in het veld 'straat' beland, waardoor
-- huisnummer, postcode en woonplaats leeg bleven — en de medewerker in zijn
-- eigen scherm een onzinnig ingevuld formulier zag.
--
-- Alleen rijen waar het onmiskenbaar misgegaan is: straat bevat een komma én de
-- andere drie velden zijn leeg. Wat niet netjes te splitsen valt blijft staan
-- zoals het staat; het origineel staat sowieso nog in oude_app_data.

DO $$
DECLARE
  r          record;
  heel       text;
  deel_straat text;
  deel_rest  text;
  m          text[];
  nieuw_straat text;
  nieuw_nr   text;
  nieuw_pc   text;
  nieuw_plaats text;
  gelukt     int := 0;
  overgeslagen int := 0;
BEGIN
  FOR r IN
    SELECT id, onboarding_data ->> 'straat' AS straat
      FROM public.sollicitaties
     WHERE onboarding_data ->> 'straat' LIKE '%,%'
       AND coalesce(onboarding_data ->> 'huisnummer', '') = ''
       AND coalesce(onboarding_data ->> 'postcode', '') = ''
       AND coalesce(onboarding_data ->> 'woonplaats', '') = ''
  LOOP
    heel := trim(r.straat);
    deel_straat := trim(split_part(heel, ',', 1));
    deel_rest   := trim(substr(heel, position(',' in heel) + 1));

    -- "Dwarsland 30" of "Dorpsstraat 82 A"
    m := regexp_match(deel_straat, '^(.*?)[\s]+([0-9]+[\s]*[a-zA-Z]?)$');
    IF m IS NULL THEN
      overgeslagen := overgeslagen + 1;
      CONTINUE;
    END IF;
    nieuw_straat := trim(m[1]);
    nieuw_nr     := trim(m[2]);

    -- "1619 GG Andijk"
    m := regexp_match(deel_rest, '^([0-9]{4}[\s]*[A-Za-z]{2})[\s]+(.+)$');
    IF m IS NULL THEN
      overgeslagen := overgeslagen + 1;
      CONTINUE;
    END IF;
    nieuw_pc     := upper(regexp_replace(trim(m[1]), '\s+', ' ', 'g'));
    nieuw_plaats := trim(m[2]);

    UPDATE public.sollicitaties
       SET onboarding_data = onboarding_data || jsonb_build_object(
             'straat',     nieuw_straat,
             'huisnummer', nieuw_nr,
             'postcode',   nieuw_pc,
             'woonplaats', nieuw_plaats
           )
     WHERE id = r.id;

    gelukt := gelukt + 1;
  END LOOP;

  RAISE NOTICE 'adressen gesplitst: %, overgeslagen omdat de vorm afweek: %',
    gelukt, overgeslagen;
END $$;
