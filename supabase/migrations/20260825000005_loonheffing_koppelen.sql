-- De loonheffingsverklaringen alsnog aan de medewerkers koppelen
--
-- De bestanden staan er, met de naam in de bestandsnaam. Maar bij het overnemen
-- van de medewerkers uit de oude app is het veld loonheffing_pdf niet
-- meegekomen, dus wist de app niet dat ze bestonden — en gingen ze niet mee naar
-- het loonbureau.
--
-- Gekoppeld op naam: de bestandsnaam eindigt op -voornaam-achternaam.pdf. Bij
-- meerdere treffers wint de nieuwste. Wie al een pad heeft blijft ongemoeid, ook
-- als dat pad nergens naar wijst — dat is een ander probleem en daar moet
-- niemand overheen schrijven.

DO $$
DECLARE
  r         record;
  gevonden  text;
  gekoppeld int := 0;
  niets     int := 0;
BEGIN
  FOR r IN
    SELECT id, voornaam, achternaam,
           lower(regexp_replace(btrim(concat_ws('-', voornaam, achternaam)), '\s+', '-', 'g')) AS sleutel
      FROM public.sollicitaties
     WHERE fase = 'medewerker'
       AND uit_dienst_op IS NULL
       AND coalesce(onboarding_data ->> 'loonheffing_pdf', '') = ''
       AND coalesce(voornaam, '') <> ''
       AND coalesce(achternaam, '') <> ''
  LOOP
    SELECT o.name INTO gevonden
      FROM storage.objects o
     WHERE o.bucket_id = 'Documenten'
       AND o.name LIKE 'loonheffing/%'
       AND lower(o.name) LIKE '%-' || r.sleutel || '.pdf'
     ORDER BY o.created_at DESC
     LIMIT 1;

    IF gevonden IS NULL THEN
      niets := niets + 1;
      RAISE NOTICE 'geen verklaring gevonden voor % %', r.voornaam, r.achternaam;
    ELSE
      UPDATE public.sollicitaties
         SET onboarding_data = coalesce(onboarding_data, '{}'::jsonb)
                               || jsonb_build_object('loonheffing_pdf', gevonden)
       WHERE id = r.id;
      gekoppeld := gekoppeld + 1;
      RAISE NOTICE 'gekoppeld: % % -> %', r.voornaam, r.achternaam, right(gevonden, 45);
    END IF;
  END LOOP;

  RAISE NOTICE '--- gekoppeld: %, zonder verklaring: %', gekoppeld, niets;
END $$;
