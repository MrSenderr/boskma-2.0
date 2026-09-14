-- MEP sjablonen: recept koppeling
-- Voeg recept_id en recept_data (snapshot) toe aan mep_sjablonen
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

ALTER TABLE mep_sjablonen
  ADD COLUMN IF NOT EXISTS recept_id   integer,
  ADD COLUMN IF NOT EXISTS recept_data jsonb;
