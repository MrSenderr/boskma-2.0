-- De 21 gerechten op de werkkaarten
--
-- Overgenomen uit de pdf "zonnetje_werkkaarten_2", versie juli 2026. Alleen als
-- er nog geen kaarten staan, zodat opnieuw draaien niets dubbel zet en
-- wijzigingen van Sander blijven staan.
--
-- Bij de burgers loopt de stapel van onder naar boven: stap 1 ligt onderop.

DO $$
DECLARE
  broodjes bigint; burgers bigint; salades bigint; wraps bigint; kapsalon bigint;
  k bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.werkkaarten) THEN
    RAISE NOTICE 'er staan al werkkaarten; niets gedaan';
    RETURN;
  END IF;

  SELECT id INTO broodjes FROM public.werkkaart_categorieen WHERE naam = 'Belegde broodjes';
  SELECT id INTO burgers  FROM public.werkkaart_categorieen WHERE naam = 'Burgers';
  SELECT id INTO salades  FROM public.werkkaart_categorieen WHERE naam = 'Salades';
  SELECT id INTO wraps    FROM public.werkkaart_categorieen WHERE naam = 'Wraps';
  SELECT id INTO kapsalon FROM public.werkkaart_categorieen WHERE naam = 'Kapsalon';

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Eiersalade', 10, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, 'Eiersalade erop', false, NULL, NULL),
    (4, 'Komkommer in reepjes', false, NULL, NULL),
    (5, 'Bieslook erop', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Tartaar speciaal', 20, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, '1½ bol tartaar erop', false, NULL, NULL),
    (3, 'Zout en peper', false, NULL, NULL),
    (4, 'Eetlepel ui erop', false, NULL, NULL),
    (5, 'Gekookt ei in plakjes', false, NULL, NULL),
    (6, 'Mayo', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Carpaccio speciaal', 30, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, '1 portie carpaccio', false, NULL, NULL),
    (4, 'Zout en peper', false, NULL, NULL),
    (5, '1 lepel pesto', false, NULL, NULL),
    (6, 'Croutons en pijnboompitten', false, NULL, NULL),
    (7, 'Cherrytomaat in vieren', false, NULL, NULL),
    (8, 'Rode ui • Oude kaas', false, NULL, NULL),
    (9, 'Truffelmayo • Rucola', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Filet américain speciaal', 40, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, '70–80 g filet erop', false, NULL, NULL),
    (3, 'Peper en zout', false, NULL, NULL),
    (4, 'Gekookt ei in plakjes', false, NULL, NULL),
    (5, 'Rode ui', false, NULL, NULL),
    (6, 'Truffelmayo', false, NULL, NULL),
    (7, '2 plakjes komkommer in reepjes', false, NULL, NULL),
    (8, 'Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Gezond kaas', 50, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, '3 plakken kaas', false, NULL, NULL),
    (4, '5 plakjes komkommer', false, NULL, NULL),
    (5, '4 schijfjes tomaat', false, NULL, NULL),
    (6, 'Gekookt ei in plakjes', false, NULL, NULL),
    (7, '5 stukjes radijs', false, NULL, NULL),
    (8, 'Peper en zout • Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Gezond ham & kaas', 60, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, '2 plakken ham', false, NULL, NULL),
    (4, '3 plakken kaas', false, NULL, NULL),
    (5, '5 plakjes komkommer', false, NULL, NULL),
    (6, '4 schijfjes tomaat', false, NULL, NULL),
    (7, 'Gekookt ei in plakjes', false, NULL, NULL),
    (8, '5 stukjes radijs', false, NULL, NULL),
    (9, 'Peper en zout • Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Brie speciaal', 70, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, '4 plakken brie', false, NULL, NULL),
    (4, 'Kerriemayo', false, NULL, NULL),
    (5, '1 schijf ananas in stukken', false, NULL, NULL),
    (6, 'Cherrytomaten in vieren', false, NULL, NULL),
    (7, 'Walnoot • Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Warm vlees', 80, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, '5 plakken fricandeau op de plaat', false, NULL, NULL),
    (3, 'Gebakken uien op de plaat', false, NULL, NULL),
    (4, 'Pindasaus', false, NULL, NULL),
    (5, 'Crispy onions', false, NULL, NULL),
    (6, 'Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (broodjes, 'Hete kip', 90, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Sla en dressing erop', false, NULL, NULL),
    (3, '1 schep hete kip erop', false, NULL, NULL),
    (4, 'Chilimayo', false, NULL, NULL),
    (5, 'Crispy onions', false, NULL, NULL),
    (6, 'Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (burgers, 'Classic burger', 10, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Sla', false, NULL, 'groente'),
    (2, '2 tomaat', false, NULL, 'groente'),
    (3, 'Hamburger', false, NULL, 'vlees'),
    (4, 'Burgersaus', false, NULL, 'saus')
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (burgers, 'Cheeseburger', 20, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Sla', false, NULL, 'groente'),
    (2, '2 tomaat', false, NULL, 'groente'),
    (3, 'Hamburger', false, NULL, 'vlees'),
    (4, 'Cheddar', false, NULL, 'kaas'),
    (5, 'Burgersaus', false, NULL, 'saus')
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (burgers, 'Eggburger', 30, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Sla', false, NULL, 'groente'),
    (2, '2 tomaat', false, NULL, 'groente'),
    (3, 'Hamburger', false, NULL, 'vlees'),
    (4, 'Ei', false, NULL, 'kaas'),
    (5, 'Burgersaus', false, NULL, 'saus')
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (burgers, 'Smokey burger', 40, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Sla', false, NULL, 'groente'),
    (2, '2 tomaat', false, NULL, 'groente'),
    (3, 'Hamburger', false, NULL, 'vlees'),
    (4, 'Cheddar', false, NULL, 'kaas'),
    (5, 'Bacon', false, NULL, 'bacon'),
    (6, 'BBQ-saus', false, NULL, 'saus')
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (burgers, 'Royal Spicy filet burger', 50, false, '1. Kipburger in de frituur
2. 2 plakken bacon op de plaat
3. Broodje 3 min in de oven') RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, '1 plak cheddar', false, NULL, 'kaas'),
    (2, 'Sla', false, NULL, 'groente'),
    (3, '2 tomaat', false, NULL, 'groente'),
    (4, 'Rode ui', false, NULL, 'groente'),
    (5, 'Bacon', false, NULL, 'bacon'),
    (6, 'Kipburger', false, NULL, 'vlees'),
    (7, 'Jambala', false, NULL, 'saus')
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (salades, 'Salade brie', 10, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Pistolet in plakken snijden', false, NULL, NULL),
    (3, 'Kruidenboter klaarzetten', false, NULL, NULL),
    (4, 'Sla en dressing', false, NULL, NULL),
    (5, 'Cherrytomaat in vieren', false, NULL, NULL),
    (6, '2 plakken komkommer', false, NULL, NULL),
    (7, '1 ei in vieren', false, NULL, NULL),
    (8, '4 plakken brie', false, NULL, NULL),
    (9, 'Walnoot', false, NULL, NULL),
    (10, '1 lepel pesto op de brie', false, NULL, NULL),
    (11, 'Balsamico', false, NULL, NULL),
    (12, 'Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (salades, 'Salade carpaccio', 20, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Pistolet in plakken snijden', false, NULL, NULL),
    (3, 'Kruidenboter klaarzetten', false, NULL, NULL),
    (4, 'Sla en dressing', false, NULL, NULL),
    (5, '1 portie carpaccio', false, NULL, NULL),
    (6, 'Zout en peper', false, NULL, NULL),
    (7, '1 lepel pesto', false, NULL, NULL),
    (8, 'Croutons en pijnboompitten', false, NULL, NULL),
    (9, 'Cherrytomaat in vieren', false, NULL, NULL),
    (10, 'Rode ui • Oude kaas', false, NULL, NULL),
    (11, 'Truffelmayo • Rucola', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (salades, 'Salade krokante kip', 30, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Pistolet 7 min in de oven', true, 7, NULL),
    (2, 'Pistolet in plakken snijden', false, NULL, NULL),
    (3, 'Kruidenboter klaarzetten', false, NULL, NULL),
    (4, 'Sla en dressing', false, NULL, NULL),
    (5, 'Cherrytomaat in vieren', false, NULL, NULL),
    (6, '2 plakken komkommer', false, NULL, NULL),
    (7, '1 ei in vieren', false, NULL, NULL),
    (8, '2 plakken bacon op de plaat, dan stukjes', false, NULL, NULL),
    (9, '1 plak oude kaas', false, NULL, NULL),
    (10, '1 kipcorn in stukjes', false, NULL, NULL),
    (11, 'Bieslook', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (wraps, 'Wrap carpaccio', 10, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, '1 portie carpaccio', false, NULL, NULL),
    (2, 'Zout en peper', false, NULL, NULL),
    (3, '1 lepel pesto', false, NULL, NULL),
    (4, 'Croutons en pijnboompitten', false, NULL, NULL),
    (5, 'Cherrytomaat in vieren', false, NULL, NULL),
    (6, 'Rode ui', false, NULL, NULL),
    (7, 'Oude kaas', false, NULL, NULL),
    (8, 'Truffelmayo', false, NULL, NULL),
    (9, 'Rucola', false, NULL, NULL),
    (10, 'Door de helft snijden', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (wraps, 'Wrap kipcorn', 20, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Stuk aluminiumfolie', false, NULL, NULL),
    (2, 'Wrap met sla', false, NULL, NULL),
    (3, '2 tomaat • 2 komkommer', false, NULL, NULL),
    (4, 'Rode ui', false, NULL, NULL),
    (5, 'Jambala', false, NULL, NULL),
    (6, '1 kipcorn', false, NULL, NULL),
    (7, 'Oprollen', false, NULL, NULL),
    (8, 'Door de helft snijden', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (wraps, 'Wrap mexicano', 30, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Stuk aluminiumfolie', false, NULL, NULL),
    (2, 'Wrap met sla', false, NULL, NULL),
    (3, '2 tomaat • 2 komkommer', false, NULL, NULL),
    (4, 'Rode ui', false, NULL, NULL),
    (5, 'Jambala', false, NULL, NULL),
    (6, '1 mexicano', false, NULL, NULL),
    (7, 'Oprollen', false, NULL, NULL),
    (8, 'Door de helft snijden', false, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  INSERT INTO public.werkkaarten (categorie_id, naam, volgorde, gebruikt_gedeelde, eigen_bereiding)
  VALUES (kapsalon, 'Kapsalon', 10, true, NULL) RETURNING id INTO k;
  INSERT INTO public.werkkaart_stappen (kaart_id, volgorde, tekst, apparaat, minuten, kleur)
  SELECT k, v.volgorde::int, v.tekst::text, v.apparaat::boolean, v.minuten::int, v.kleur::text FROM (VALUES
    (1, 'Oven ventilator op 0', true, NULL, NULL),
    (2, 'Kebab op de plaat', false, NULL, NULL),
    (3, 'Patat in bakje', false, NULL, NULL),
    (4, 'Vlees op de patat', false, NULL, NULL),
    (5, 'Knoflooksaus erop', false, NULL, NULL),
    (6, 'Sla, rode ui en komkommer erop', false, NULL, NULL),
    (7, '2 plakken kaas erop', false, NULL, NULL),
    (8, 'In de oven tot kaas gesmolten', true, NULL, NULL)
  ) AS v(volgorde, tekst, apparaat, minuten, kleur);

  RAISE NOTICE 'werkkaarten: %, stappen: %',
    (SELECT count(*) FROM public.werkkaarten),
    (SELECT count(*) FROM public.werkkaart_stappen);
END $$;
