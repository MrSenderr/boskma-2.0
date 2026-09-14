-- Nakijken wat er in de MEP-lijst staat
--
-- De vorige migratie voerde de lijst van het papieren formulier alleen in als de
-- tabel leeg was. Hij was niet leeg — er stond nog iets uit de tabletapp. Dit
-- laat zien wat, zodat er niet blind overheen wordt geschreven.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, naam, groep, actief, volgorde FROM public.mep_sjablonen ORDER BY volgorde, id
  LOOP
    RAISE NOTICE '  % | % | groep=% | actief=%', r.id, r.naam, coalesce(r.groep,'-'), r.actief;
  END LOOP;
END $$;
