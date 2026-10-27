-- Een eigen volgorde voor dinsdag, woensdag en donderdag
--
-- De indeling rekent `belang × 100 + hoe goed iemand past`, en vult van boven
-- naar beneden. Met één getal per werkplek geldt dezelfde rangschikking op elke
-- dag, en dat klopt niet: op zaterdag gaat een tweede snackbakker vóór plankjes
-- en service, op een rustige woensdag wil je dat omgekeerd.
--
-- Vandaar een tweede getal in plaats van een tweede tabel. Twee tabellen zou
-- betekenen dat er twee lijsten werkplekken bestaan die uit elkaar kunnen
-- lopen; nu staat er één plek met twee gewichten.
--
-- Leeg betekent: hetzelfde als in het weekend. Zo hoef je alleen in te vullen
-- wat afwijkt, en zie je aan een ingevuld getal dat er iets bijzonders aan de
-- hand is met die plek.

ALTER TABLE public.werkplekken
  ADD COLUMN IF NOT EXISTS belang_doordeweeks smallint
  CHECK (belang_doordeweeks IS NULL OR belang_doordeweeks BETWEEN 1 AND 10);

COMMENT ON COLUMN public.werkplekken.belang_doordeweeks IS
  'Belang op dinsdag, woensdag en donderdag. Leeg betekent: gelijk aan belang.';

NOTIFY pgrst, 'reload schema';
