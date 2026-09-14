-- Wie tikt er hoeveel af
--
-- Zie docs/Modules/haccp/haccpmodule.md.
--
-- Rekent in de database en niet in de app: over een jaar gaat het om
-- tienduizenden vinkjes, en die hoeven niet allemaal over de lijn om er een
-- gemiddelde van te maken.
--
-- Het hoofdgetal is het gemiddelde per dag dat iemand werkte, niet het totaal.
-- De sluitlijst heeft 82 taken en de openlijst 21, dus wie 's avonds werkt zou
-- anders altijd bovenaan staan — en wie meer diensten draait ook. Dan meet je
-- het rooster in plaats van het werk.
--
-- "Dagen" is het aantal dagen waarop iemand iets aftikte. Een rooster hebben we
-- niet in de app; dit is de beste benadering van een gewerkte dag.

CREATE OR REPLACE FUNCTION public.taak_statistiek(vanaf date, tot date)
RETURNS TABLE (naam text, taken bigint, dagen bigint, per_dag numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    coalesce(nullif(btrim(g.door_naam), ''), 'onbekend') AS naam,
    count(*)                                             AS taken,
    count(DISTINCT g.datum)                              AS dagen,
    round(count(*)::numeric / greatest(count(DISTINCT g.datum), 1), 1) AS per_dag
    FROM public.haccp_taak_gedaan g
   WHERE public.is_app_user()
     AND g.datum BETWEEN vanaf AND tot
   GROUP BY 1
   ORDER BY per_dag DESC, taken DESC;
$$;

REVOKE ALL ON FUNCTION public.taak_statistiek(date, date) FROM public;
REVOKE EXECUTE ON FUNCTION public.taak_statistiek(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.taak_statistiek(date, date) TO authenticated;

-- De API houdt de vorm van functies in het geheugen; na een nieuwe functie moet
-- die opnieuw kijken. Dit is precies wat vanmiddag de tabletmodus brak.
NOTIFY pgrst, 'reload schema';
