-- Tablet bestellen-module: anon-toegang op bestellen_producten en bestellen_regels
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- Lees actieve producten (tablet browst catalogus)
DO $$ BEGIN
  ALTER TABLE bestellen_producten ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_producten" ON bestellen_producten
    FOR SELECT TO anon USING (actief = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tablet mag ook nieuwe 'vrije' producten aanmaken (aangemaakt_in=bestelapp)
DO $$ BEGIN
  CREATE POLICY "anon_insert_producten" ON bestellen_producten
    FOR INSERT TO anon WITH CHECK (aangemaakt_in = 'bestelapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tablet mag bestelregels aanmaken (status=open)
DO $$ BEGIN
  ALTER TABLE bestellen_regels ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_regels" ON bestellen_regels
    FOR INSERT TO anon WITH CHECK (status = 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
