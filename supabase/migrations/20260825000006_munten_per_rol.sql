-- Munten gaan pas per hele rol naar de kluis
--
-- Zie docs/Modules/kas.md. Gewijzigd op 25 augustus 2026.
--
-- De regel was: alles boven het gewenste aantal gaat eruit. Gevolg: vier
-- dubbeltjes te veel wandelden naar de kluis. Dat doe je in het echt niet — je
-- laat ze liggen tot je er een rol van hebt.
--
-- Vandaar een rolgrootte per munt. Uit het overschot gaan alleen hele rollen; de
-- rest blijft in de lade. Voor biljetten geldt dit niet: die moeten naar de bank
-- en leveren geen gedoe met rollen op.
--
-- De aantallen zijn de gangbare Europese muntrollen.

ALTER TABLE public.kas_coupures
  ADD COLUMN IF NOT EXISTS rol int CHECK (rol IS NULL OR rol > 0);

UPDATE public.kas_coupures SET rol = 50 WHERE waarde_cent = 5;
UPDATE public.kas_coupures SET rol = 40 WHERE waarde_cent IN (10, 20, 50);
UPDATE public.kas_coupures SET rol = 25 WHERE waarde_cent IN (100, 200);
UPDATE public.kas_coupures SET rol = NULL WHERE soort = 'biljet';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT waarde_cent, soort, gewenst, rol FROM public.kas_coupures ORDER BY volgorde LOOP
    RAISE NOTICE '  % ct (%) gewenst % rol %', r.waarde_cent, r.soort, r.gewenst, coalesce(r.rol::text, '-');
  END LOOP;
END $$;
