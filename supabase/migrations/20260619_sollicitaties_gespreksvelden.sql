-- Voeg gespreksnotities, voorkeur_tijden en voorkeur_notitie toe aan sollicitaties
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

ALTER TABLE sollicitaties
  ADD COLUMN IF NOT EXISTS gespreksnotities jsonb,
  ADD COLUMN IF NOT EXISTS voorkeur_tijden   jsonb,
  ADD COLUMN IF NOT EXISTS voorkeur_notitie  text;
