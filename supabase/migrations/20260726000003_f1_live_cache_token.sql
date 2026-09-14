-- Token van OpenF1 meebewaren in de buffer.
-- Edge functions starten vaak in een verse omgeving; zonder dit vraagt elke
-- koude start een nieuw token aan, wat onnodig verzoeken kost.

ALTER TABLE f1_live_cache ADD COLUMN IF NOT EXISTS token     text;
ALTER TABLE f1_live_cache ADD COLUMN IF NOT EXISTS token_tot timestamptz;
