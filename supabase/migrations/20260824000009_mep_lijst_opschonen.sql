-- De MEP-lijst gelijktrekken met het papieren formulier
--
-- In mep_sjablonen stond nog een lijst uit de tabletapp: 20 rijen met drie
-- dubbelingen en een paar typefouten, en zonder groepen.
--
--   dubbel:   'Berehappen maken' naast 'Berenhappen maken'
--             'Pindas saus maken' naast 'Pindasaus maken'
--             'Sla snijden' twee keer
--   typefout: 'Bieslook' (zonder snijden), 'Rode ui' (idem),
--             'Uien karamelliseren', 'Pindas saus portioneren'
--
-- Namen worden rechtgezet en groepen ingevuld. Een dubbele rij gaat weg, maar
-- alleen als er geen enkele dagelijst naar verwijst — anders raakt er
-- geschiedenis zoek en zetten we hem alleen uit.

-- 1. Namen en groepen ---------------------------------------------------------

UPDATE public.mep_sjablonen SET naam = 'Bieslook snijden'       WHERE id = 10;
UPDATE public.mep_sjablonen SET naam = 'Rode ui snijden'        WHERE id = 11;
UPDATE public.mep_sjablonen SET naam = 'Uien karameliseren'     WHERE id = 13;
UPDATE public.mep_sjablonen SET naam = 'Pindasaus portioneren'  WHERE id = 15;

UPDATE public.mep_sjablonen AS m
   SET groep = v.groep, volgorde = v.volgorde
  FROM (VALUES
    ('Sla drogen',              'Snijwerk', 10),
    ('Sla snijden',             'Snijwerk', 20),
    ('Komkommer snijden',       'Snijwerk', 30),
    ('Tomaat snijden',          'Snijwerk', 40),
    ('Radijs snijden',          'Snijwerk', 50),
    ('Bieslook snijden',        'Snijwerk', 60),
    ('Rode ui snijden',         'Snijwerk', 70),
    ('Pijnboompitten roosteren','Warm',     80),
    ('Uien karameliseren',      'Warm',     90),
    ('Pindasaus maken',         'Sauzen',  100),
    ('Pindasaus portioneren',   'Sauzen',  110),
    ('Ras maken',               'Sauzen',  120),
    ('Slaatjes maken',          'Snacks',  130),
    ('Berenhappen maken',       'Snacks',  140),
    ('Kipnuggets maken',        'Snacks',  150),
    ('Snacks portioneren',      'Snacks',  160),
    ('IJs maken',               'Overig',  170)
  ) AS v(naam, groep, volgorde)
 WHERE m.naam = v.naam;

-- 2. De dubbelingen -----------------------------------------------------------

DO $$
DECLARE
  dubbel   int[] := ARRAY[1, 6, 14];   -- Berehappen, tweede 'Sla snijden', Pindas saus
  sjab_id  int;
  gebruikt int;
  weg      int := 0;
  uit      int := 0;
BEGIN
  FOREACH sjab_id IN ARRAY dubbel LOOP
    SELECT count(*) INTO gebruikt
      FROM public.mep_dag_taken d
     WHERE d.sjabloon_id = sjab_id;

    IF gebruikt = 0 THEN
      DELETE FROM public.mep_sjablonen s WHERE s.id = sjab_id;
      weg := weg + 1;
    ELSE
      UPDATE public.mep_sjablonen s SET actief = false WHERE s.id = sjab_id;
      uit := uit + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'dubbelingen verwijderd: %, alleen uitgezet omdat er een dagelijst naar verwees: %', weg, uit;
  RAISE NOTICE 'MEP-taken over: %', (SELECT count(*) FROM public.mep_sjablonen);
  RAISE NOTICE 'zonder groep: %', (SELECT count(*) FROM public.mep_sjablonen WHERE groep IS NULL);
END $$;
