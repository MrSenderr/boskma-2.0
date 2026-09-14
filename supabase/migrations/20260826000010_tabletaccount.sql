-- Eén account voor de tablet in de zaak
--
-- Zie docs/Modules/tablets.md.
--
-- De tablet ligt in de zaak en iedereen gebruikt hem. Daar hoort geen persoonlijk
-- account bij: dan staat er iemands naam onder alles, en logt de app uit zodra
-- die persoon zijn wachtwoord wijzigt.
--
-- Dit account dient één doel: ingelogd blijven. Wat er wordt vastgelegd komt op
-- naam van wie er bij het aftikken gekozen wordt — dat hangt aan het adres
-- (/tablet, /keuken, /zaak), niet aan dit account.
--
-- is_apparaat houdt het uit de personeelslijst. Meer doet die vlag niet meer;
-- de tabletmodus zelf hangt er niet meer aan.

INSERT INTO public.sollicitaties (voornaam, achternaam, email, fase, status, is_apparaat, aangemeld_op, aangenomen_op)
SELECT 'Tablet', 'in de zaak', 'sander+tablet@boskmafoodservice.nl', 'medewerker', 'aangenomen', true, now(), now()
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sollicitaties
    WHERE lower(email) = 'sander+tablet@boskmafoodservice.nl'
 );

DO $$
BEGIN
  RAISE NOTICE 'tabletaccount klaar: %',
    (SELECT email FROM public.sollicitaties WHERE is_apparaat LIMIT 1);
  RAISE NOTICE 'staat niet in de personeelslijst, want is_apparaat is aan';
END $$;
