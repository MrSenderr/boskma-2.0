-- Getekend contract naar het loonbureau
--
-- Stelt het loonbureau het contract op (contract_door_loonbureau), dan komt het
-- getekend terug in het dossier en moet het weer naar het loonbureau. Dat doet
-- de edge function stuur-getekend-contract direct na het uploaden.
--
-- Hier staat alleen vast óf en wanneer dat gelukt is. Wat er nog moet gebeuren
-- wordt in de app afgeleid uit deze kolommen plus de kaart van de medewerker;
-- er is geen aparte takenlijst die uit de pas kan lopen.
--
-- Alles mag leeg zijn. Wat er al staat is niet via deze weg verstuurd, en
-- achteraf een datum verzinnen is erger dan het niet weten.

ALTER TABLE public.dossier_documenten
  -- Wanneer het naar het loonbureau is gestuurd. In testmodus blijft dit leeg:
  -- dan is het loonbureau nog niet op de hoogte.
  ADD COLUMN IF NOT EXISTS naar_loonbureau_op   timestamptz,
  -- Naar welk adres, zodat later na te gaan is waar het heen ging.
  ADD COLUMN IF NOT EXISTS naar_loonbureau_adres text,
  -- De laatste foutmelding als versturen mislukte; leeg zodra het wel lukt.
  ADD COLUMN IF NOT EXISTS naar_loonbureau_fout  text;
