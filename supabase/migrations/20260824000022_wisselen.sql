-- Wisselen met iemand van buiten
--
-- Marktkooplui komen met kleingeld en willen er briefgeld voor terug, of
-- andersom. Dat is geen omzet en geen correctie: het totaal blijft gelijk,
-- alleen de verhouding munten/briefgeld verschuift.
--
-- Zonder een eigen soort zou het als 'correctie' geboekt moeten worden, en dan
-- lijkt het in de geschiedenis alsof er iets mis was terwijl er niets mis is.

ALTER TABLE public.kluis_mutaties DROP CONSTRAINT IF EXISTS kluis_mutaties_soort_check;
ALTER TABLE public.kluis_mutaties
  ADD CONSTRAINT kluis_mutaties_soort_check
  CHECK (soort IN ('uit_kassa', 'naar_bank', 'naar_kassa', 'correctie', 'wisseling'));
