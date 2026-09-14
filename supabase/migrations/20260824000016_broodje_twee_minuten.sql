-- Het broodje mag korter: twee minuten
--
-- Stond op drie, overgenomen van de papieren kaart. Twee is volgens Sander ruim
-- voldoende. Geldt voor de burgers en voor de Royal Spicy, want dat is hetzelfde
-- broodje in dezelfde oven.

UPDATE public.werkkaart_categorieen
   SET bereiding_minuten = 2
 WHERE naam = 'Burgers';

UPDATE public.werkkaarten
   SET bereiding_minuten = 2
 WHERE naam = 'Royal Spicy filet burger';

DO $$
BEGIN
  RAISE NOTICE 'burgers: % min, royal spicy: % min',
    (SELECT bereiding_minuten FROM public.werkkaart_categorieen WHERE naam = 'Burgers'),
    (SELECT bereiding_minuten FROM public.werkkaarten WHERE naam = 'Royal Spicy filet burger');
END $$;
