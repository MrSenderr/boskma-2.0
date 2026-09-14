-- Twee tabletaccounts klaarzetten
--
-- Zie docs/Modules/tablets.md.
--
-- Een tablet logt in als een gewone medewerker, maar met is_apparaat aan. Daarmee
-- werkt alle bestaande toegangscontrole zoals hij is, en blijft de
-- personeelslijst schoon.
--
-- De adressen zijn plusadressen van Sander, zodat de inlogcode gewoon bij hem
-- binnenkomt. Er is geen aparte mailbox voor nodig.

INSERT INTO public.sollicitaties (voornaam, achternaam, email, fase, status, is_apparaat, aangemeld_op, aangenomen_op)
SELECT v.voornaam, v.achternaam, v.email, 'medewerker', 'aangenomen', true, now(), now()
  FROM (VALUES
    ('Keuken', 'tablet', 'sander+keukentablet@boskmafoodservice.nl'),
    ('Zaak',   'tablet', 'sander+zaaktablet@boskmafoodservice.nl')
  ) AS v(voornaam, achternaam, email)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sollicitaties s WHERE lower(s.email) = lower(v.email)
 );

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT voornaam, achternaam, email FROM public.sollicitaties WHERE is_apparaat ORDER BY email LOOP
    RAISE NOTICE '  % % — %', r.voornaam, r.achternaam, r.email;
  END LOOP;
END $$;
