-- Bestaande medewerkers overnemen uit de oude app
--
-- De medewerkers stonden in boskma_state.data->'employees', de sollicitanten in
-- sollicitaties. Twee gescheiden werelden. Deze migratie brengt ze samen in één
-- lijst, achter dezelfde beveiliging.
--
-- Niets wordt gewist: de oude app blijft zijn eigen kopie houden zolang hij
-- draait. Deze migratie kopieert alleen, en slaat over wie er al staat.

-- 1. Velden die Sander zelf invult ---------------------------------------------
-- Uit docs/modules/personeel/personeelsmodule.md. Nu al toevoegen zodat de
-- overgenomen medewerkers hun functie en uurloon kunnen meenemen.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS contracttype             text,
  ADD COLUMN IF NOT EXISTS contractduur             text,
  ADD COLUMN IF NOT EXISTS functie                  text,
  ADD COLUMN IF NOT EXISTS ingangsdatum             date,
  ADD COLUMN IF NOT EXISTS einddatum                date,
  ADD COLUMN IF NOT EXISTS uurloon                  numeric(6,2),
  ADD COLUMN IF NOT EXISTS proefperiode             boolean,
  ADD COLUMN IF NOT EXISTS contract_door_loonbureau boolean,
  -- herkomst: welke rij kwam uit de oude app, en wat stond er precies in
  ADD COLUMN IF NOT EXISTS oude_app_id              integer,
  ADD COLUMN IF NOT EXISTS oude_app_data            jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS sollicitaties_oude_app_id_idx
  ON public.sollicitaties (oude_app_id) WHERE oude_app_id IS NOT NULL;

-- 1b. E-mail en telefoon mogen leeg zijn --------------------------------------
-- Het sollicitatieformulier vraagt ze verplicht, dus daar verandert niets. Maar
-- van een medewerker die al jaren in dienst is, is niet altijd een mailadres
-- vastgelegd. Liever leeg dan een verzonnen waarde.

ALTER TABLE public.sollicitaties ALTER COLUMN email          DROP NOT NULL;
ALTER TABLE public.sollicitaties ALTER COLUMN telefoonnummer DROP NOT NULL;

-- 2. Een vreemde mag alleen een sollicitatie indienen --------------------------
-- Het formulier op werkenbij blijft werken, maar niemand kan zich via die weg
-- als medewerker de lijst in schrijven.

DROP POLICY IF EXISTS sollicitatie_indienen ON public.sollicitaties;
CREATE POLICY sollicitatie_indienen ON public.sollicitaties
  FOR INSERT TO anon
  WITH CHECK (onboarding_data IS NULL AND fase = 'sollicitant');

-- 3. De overzetting ------------------------------------------------------------

DO $$
DECLARE
  bron   jsonb;
  mw     jsonb;
  adres  jsonb;
  volnaam text;
  voor   text;
  achter text;
  nieuw  int := 0;
  bestond int := 0;
  totaal int := 0;
BEGIN
  SELECT data -> 'employees' INTO bron FROM public.boskma_state WHERE id = 1;

  IF bron IS NULL OR jsonb_typeof(bron) <> 'array' THEN
    RAISE NOTICE 'geen medewerkers gevonden in de oude app, niets te doen';
    RETURN;
  END IF;

  FOR mw IN SELECT * FROM jsonb_array_elements(bron) LOOP
    totaal := totaal + 1;

    IF EXISTS (SELECT 1 FROM public.sollicitaties
                WHERE oude_app_id = (mw ->> 'id')::int) THEN
      bestond := bestond + 1;
      CONTINUE;
    END IF;

    volnaam := trim(coalesce(mw ->> 'name', ''));
    IF volnaam = '' THEN
      RAISE NOTICE 'medewerker zonder naam overgeslagen';
      CONTINUE;
    END IF;
    voor   := split_part(volnaam, ' ', 1);
    achter := nullif(trim(substr(volnaam, length(voor) + 1)), '');

    -- adres kan een tekst of een object zijn; allebei opvangen
    adres := CASE WHEN jsonb_typeof(mw -> 'address') = 'object'
                  THEN mw -> 'address' ELSE '{}'::jsonb END;

    INSERT INTO public.sollicitaties (
      voornaam, achternaam, geboortedatum, telefoonnummer, email,
      status, fase, aangemeld_op, aangenomen_op, uit_dienst_op,
      functie, uurloon, ingangsdatum, einddatum,
      onboarding_data, onboarding_ingevuld_op,
      oude_app_id, oude_app_data
    ) VALUES (
      voor,
      coalesce(achter, ''),
      nullif(mw ->> 'birthDate', '')::date,
      nullif(mw ->> 'phone', ''),
      nullif(mw ->> 'email', ''),
      'aangenomen',
      'medewerker',
      coalesce(nullif(mw ->> 'contractStart', '')::timestamptz, now()),
      coalesce(nullif(mw ->> 'contractStart', '')::timestamptz, now()),
      CASE WHEN lower(coalesce(mw ->> 'status', '')) IN ('uit dienst', 'uitdienst', 'inactief')
           THEN now() ELSE NULL END,
      nullif(mw ->> 'functie', ''),
      nullif(mw ->> 'hourly', '')::numeric,
      nullif(coalesce(mw ->> 'currentContractStart', mw ->> 'contractStart'), '')::date,
      nullif(mw ->> 'contractEnd', '')::date,
      -- dezelfde vorm als wat het invulformulier oplevert
      jsonb_strip_nulls(jsonb_build_object(
        'straat',              coalesce(adres ->> 'straat', nullif(mw ->> 'address', '')),
        'huisnummer',          adres ->> 'huisnummer',
        'postcode',            coalesce(adres ->> 'postcode', nullif(mw ->> 'postcode', '')),
        'woonplaats',          coalesce(adres ->> 'woonplaats', nullif(mw ->> 'woonplaats', '')),
        'bsn',                 nullif(mw ->> 'bsn', ''),
        'iban',                nullif(mw ->> 'iban', ''),
        'geboorteplaats',      nullif(mw ->> 'geboorteplaats', ''),
        'geslacht',            nullif(mw ->> 'geslacht', ''),
        'noodcontact_naam',    nullif(mw ->> 'noodcontactNaam', ''),
        'noodcontact_tel',     nullif(mw ->> 'noodcontactTel', ''),
        'loonheffingskorting', mw -> 'loonheffingskorting',
        'tshirt_maat',         nullif(mw ->> 'tshirtMaat', '')
      )),
      CASE WHEN nullif(mw ->> 'bsn', '') IS NOT NULL THEN now() ELSE NULL END,
      (mw ->> 'id')::int,
      mw                        -- alles bewaren, zodat er niets verloren gaat
    );

    nieuw := nieuw + 1;
  END LOOP;

  RAISE NOTICE 'medewerkers in de oude app: %, overgenomen: %, stond er al: %',
    totaal, nieuw, bestond;
END $$;
