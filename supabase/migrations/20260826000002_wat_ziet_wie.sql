-- Wat een medewerker in zijn menu ziet, uitgebreid
--
-- Zie docs/Modules/rechten.md. De tabel bestond al sinds 24 augustus maar werd
-- niet gebruikt; sindsdien zijn er onderdelen bijgekomen.
--
-- Nog eens met nadruk, want er is nu een eis bijgekomen die het bevestigt: dit
-- gaat over ÓVERZICHT, niet over veiligheid. Staat "recepten" uit, dan is het
-- menu-item weg — maar de knop 'Recept' bij een MEP-taak werkt gewoon. Wie het
-- adres intikt komt er ook. De echte grenzen staan in de RLS-regels van de
-- tabellen zelf.

ALTER TABLE public.medewerker_verborgen DROP CONSTRAINT IF EXISTS medewerker_verborgen_onderdeel_check;
ALTER TABLE public.medewerker_verborgen
  ADD CONSTRAINT medewerker_verborgen_onderdeel_check
  CHECK (onderdeel IN (
    'temperaturen', 'taken', 'mep', 'werkkaarten', 'recepten', 'werkwijzen',
    'levering', 'frituurvet', 'melden'
  ));

DO $$
BEGIN
  RAISE NOTICE 'rijen in medewerker_verborgen: %', (SELECT count(*) FROM public.medewerker_verborgen);
END $$;
