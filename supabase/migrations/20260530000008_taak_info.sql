-- Taakinformatie: uitleg-tekst + foto's per HACCP-taak en MEP-sjabloon
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

ALTER TABLE haccp_taken
  ADD COLUMN IF NOT EXISTS info_tekst text,
  ADD COLUMN IF NOT EXISTS info_fotos jsonb NOT NULL DEFAULT '[]';

ALTER TABLE mep_sjablonen
  ADD COLUMN IF NOT EXISTS info_tekst text,
  ADD COLUMN IF NOT EXISTS info_fotos jsonb NOT NULL DEFAULT '[]';

-- Storage bucket voor taakfoto's (publiek leesbaar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('taak-fotos', 'taak-fotos', true)
ON CONFLICT DO NOTHING;

-- RLS policies voor anon (tablet + boskma-app gebruiken beide de anon-sleutel)
DO $$ BEGIN
  CREATE POLICY "anon_select_taak_fotos" ON storage.objects
    FOR SELECT TO anon USING (bucket_id = 'taak-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_taak_fotos" ON storage.objects
    FOR INSERT TO anon WITH CHECK (bucket_id = 'taak-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_delete_taak_fotos" ON storage.objects
    FOR DELETE TO anon USING (bucket_id = 'taak-fotos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
