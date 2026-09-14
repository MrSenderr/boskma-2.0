-- De 21 werkkaarten uit de pdf
--
-- Overgenomen uit "zonnetje_werkkaarten_2", versie juli 2026. Alleen invoeren
-- als er nog niets staat, zodat het opnieuw draaien van de migraties niets
-- dubbel zet en handmatige wijzigingen van Sander blijven staan.

DO $$
DECLARE
  broodjes bigint; burgers bigint; salades bigint; wraps bigint; kapsalon bigint;
  k bigint;

BEGIN
  IF EXISTS (SELECT 1 FROM public.werkkaarten) THEN
    RAISE NOTICE 'er staan al werkkaarten; niets gedaan';
    RETURN;
  END IF;

  INSERT INTO public.werkkaart_categorieen (naam, volgorde, weergave, gedeelde_bereiding)
  VALUES ('Belegde broodjes', 10, 'lijst', NULL)
  RETURNING id INTO broodjes;

  INSERT INTO public.werkkaart_categorieen (naam, volgorde, weergave, gedeelde_bereiding)
  VALUES ('Burgers', 20, 'stapel',
E'In de oven, minstens 7 minuten:\n'
'• Hamburger\n'
'• Gekaramelliseerde uien\n'
'• Cheeseburger: plus 1 plak cheddar\n'
'• Smokey: plus 1 plak cheddar en 2 plakken bacon\n'
'• Eggburger: plus een eitje apart op de plaat')
  RETURNING id INTO burgers;

  INSERT INTO public.werkkaart_categorieen (naam, volgorde, weergave)
  VALUES ('Salades', 30, 'lijst') RETURNING id INTO salades;

  INSERT INTO public.werkkaart_categorieen (naam, volgorde, weergave)
  VALUES ('Wraps', 40, 'lijst') RETURNING id INTO wraps;

  INSERT INTO public.werkkaart_categorieen (naam, volgorde, weergave)
  VALUES ('Kapsalon', 50, 'lijst') RETURNING id INTO kapsalon;

  RAISE NOTICE 'categorieen aangemaakt';
END $$;
