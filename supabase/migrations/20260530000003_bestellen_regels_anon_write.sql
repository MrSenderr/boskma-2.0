-- Tablet: anon mag open bestelregels updaten en verwijderen
-- (nodig voor PATCH hoeveelheid en DELETE bij qty=0)
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

DO $$ BEGIN
  CREATE POLICY "anon_update_open_regels" ON bestellen_regels
    FOR UPDATE TO anon USING (status = 'open') WITH CHECK (status = 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_delete_open_regels" ON bestellen_regels
    FOR DELETE TO anon USING (status = 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
