-- Wie de kas telt mag de kluisgrens lezen
--
-- De instellingen zijn alleen voor Sander. Gevolg: een medewerker met het recht
-- 'kas' zag de standaardwaarde van tweeduizend euro in plaats van de grens die
-- werkelijk is ingesteld — dus geen seintje, of juist een seintje dat nergens op
-- slaat.
--
-- Alleen déze sleutel, alleen lezen. De rest van de instellingen blijft dicht.

DROP POLICY IF EXISTS kas_leest_grens ON public.instellingen;
CREATE POLICY kas_leest_grens ON public.instellingen
  FOR SELECT TO authenticated
  USING (sleutel = 'kluis_grens' AND public.heeft_recht('kas'));
