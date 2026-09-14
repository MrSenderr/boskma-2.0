-- Elke burger zijn eigen bereiding
--
-- Zie docs/Modules/werkkaarten.md. Gewijzigd op 24 augustus 2026.
--
-- De gedeelde bereiding somde alle varianten op. Wie een classic maakte las dus
-- ook wat er bij een cheeseburger en een smokey moet — precies het soort
-- verwarring waardoor er in de drukte een verkeerde burger de deur uit gaat.
--
-- Nu: het gedeelte dat voor élke burger geldt blijft op één plek staan, en per
-- burger komt alleen zijn eigen toevoeging erbij. Op het scherm worden die twee
-- als één blok getoond, dus je leest alleen wat voor jouw burger geldt — en een
-- wijziging aan de uien hoeft nog steeds maar op één plek.

UPDATE public.werkkaart_categorieen
   SET gedeelde_bereiding =
E'• Hamburger op de plaat en meteen iets platter drukken met de burgerpers\n'
'• Gekaramelliseerde uien ook op de plaat'
 WHERE naam = 'Burgers';

UPDATE public.werkkaarten SET eigen_bereiding = NULL
 WHERE naam = 'Classic burger';

UPDATE public.werkkaarten SET eigen_bereiding = '• 1 plak cheddar op de burger, op de plaat'
 WHERE naam = 'Cheeseburger';

UPDATE public.werkkaarten SET eigen_bereiding = '• Een eitje apart op de plaat'
 WHERE naam = 'Eggburger';

UPDATE public.werkkaarten
   SET eigen_bereiding =
E'• 1 plak cheddar op de burger, op de plaat\n'
'• 2 plakken bacon apart op de plaat'
 WHERE naam = 'Smokey burger';

-- De Royal Spicy volgt de gedeelde bereiding niet en houdt zijn eigen verhaal.
UPDATE public.werkkaarten
   SET eigen_bereiding =
E'• Kipburger in de frituur\n'
'• 2 plakken bacon op de plaat'
 WHERE naam = 'Royal Spicy filet burger';

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT w.naam, w.gebruikt_gedeelde, coalesce(w.eigen_bereiding, '—') AS eigen
      FROM public.werkkaarten w
      JOIN public.werkkaart_categorieen c ON c.id = w.categorie_id
     WHERE c.naam = 'Burgers' ORDER BY w.volgorde
  LOOP
    RAISE NOTICE '  % (gedeeld=%): %', r.naam, r.gebruikt_gedeelde, replace(r.eigen, chr(10), ' / ');
  END LOOP;
END $$;
