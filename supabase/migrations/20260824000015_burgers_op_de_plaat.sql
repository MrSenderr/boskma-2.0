-- Burgers gaan op de plaat, niet meer in de oven
--
-- Zie docs/Modules/werkkaarten.md. Gewijzigd op 24 augustus 2026.
--
-- Alleen het broodje gaat nog de oven in, drie minuten. Daar hoort een timer
-- bij, en een bereidingsblok was tot nu toe platte tekst zonder timer. Vandaar
-- twee velden erbij: hoeveel minuten, en waar die timer over gaat.
--
-- Eén timer per blok is genoeg voor wat er nu op de kaarten staat. Blijkt er
-- later een blok met twee tijden te zijn, dan worden het losse stappen.

ALTER TABLE public.werkkaart_categorieen
  ADD COLUMN IF NOT EXISTS bereiding_minuten int,
  ADD COLUMN IF NOT EXISTS bereiding_label   text;

ALTER TABLE public.werkkaarten
  ADD COLUMN IF NOT EXISTS bereiding_minuten int,
  ADD COLUMN IF NOT EXISTS bereiding_label   text;

UPDATE public.werkkaart_categorieen
   SET gedeelde_bereiding =
E'Op de plaat, niet in de oven:\n'
'• Hamburger op de plaat en meteen iets platter drukken met de burgerpers\n'
'• Gekaramelliseerde uien ook op de plaat\n'
'• Cheeseburger: 1 plak cheddar op de burger, op de plaat\n'
'• Smokey: 1 plak cheddar op de burger, plus 2 plakken bacon apart op de plaat\n'
'• Eggburger: een eitje apart op de plaat\n'
'\n'
'Alleen het broodje gaat de oven in.',
       bereiding_minuten = 3,
       bereiding_label   = 'Broodje in de oven'
 WHERE naam = 'Burgers';

-- De Royal Spicy volgt die bereiding niet — daar gaat een kipburger in de
-- frituur — maar het broodje wel, dus die krijgt zijn eigen timer.
UPDATE public.werkkaarten
   SET eigen_bereiding =
E'1. Kipburger in de frituur\n'
'2. 2 plakken bacon op de plaat',
       bereiding_minuten = 3,
       bereiding_label   = 'Broodje in de oven'
 WHERE naam = 'Royal Spicy filet burger';

DO $$
BEGIN
  RAISE NOTICE 'burgerbereiding bijgewerkt: %',
    (SELECT left(gedeelde_bereiding, 40) FROM public.werkkaart_categorieen WHERE naam = 'Burgers');
END $$;
