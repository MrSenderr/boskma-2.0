-- Tablet: anon mag open bestelregels lezen (voor "al X op lijst" badges)
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

DO $$ BEGIN
  CREATE POLICY "anon_read_open_regels" ON bestellen_regels
    FOR SELECT TO anon USING (status = 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
