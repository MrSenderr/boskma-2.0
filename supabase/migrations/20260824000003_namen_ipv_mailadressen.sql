-- Metingen op naam zetten in plaats van op mailadres
--
-- Het rondescherm zette het mailadres van de ingelogde gebruiker in door_naam.
-- Dat is inmiddels de echte naam, maar wat er al stond blijft staan — en in de
-- uitdraai voor een controle leest "daan@..." een stuk minder prettig dan "Daan".
--
-- Alleen waarden die onmiskenbaar een mailadres zijn, en alleen als er een
-- persoon bij te vinden is. Wat niet te herleiden valt blijft staan zoals het
-- staat: een verzonnen naam onder een meting is erger dan een mailadres.

DO $$
DECLARE
  medewerkers int;
  eigenaar    int;
BEGIN
  UPDATE public.haccp_temps t
     SET door_naam = btrim(concat_ws(' ', s.voornaam, s.achternaam))
    FROM public.sollicitaties s
   WHERE t.door_naam LIKE '%@%'
     AND lower(t.door_naam) = lower(s.email)
     AND btrim(concat_ws(' ', s.voornaam, s.achternaam)) <> '';
  GET DIAGNOSTICS medewerkers = ROW_COUNT;

  -- De eigenaar staat niet als medewerker in de lijst, dus die kan niet
  -- opgezocht worden.
  UPDATE public.haccp_temps
     SET door_naam = 'Sander Boskma'
   WHERE lower(door_naam) = 'sander@boskmafoodservice.nl';
  GET DIAGNOSTICS eigenaar = ROW_COUNT;

  RAISE NOTICE 'metingen op naam gezet: % van medewerkers, % van de eigenaar', medewerkers, eigenaar;

  RAISE NOTICE 'nog met een mailadres: %',
    (SELECT count(*) FROM public.haccp_temps WHERE door_naam LIKE '%@%');
END $$;
