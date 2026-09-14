-- Maak geboortedatum optioneel zodat handmatig toegevoegde sollicitanten
-- ook zonder geboortedatum kunnen worden opgeslagen.
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

ALTER TABLE sollicitaties
  ALTER COLUMN geboortedatum DROP NOT NULL;
