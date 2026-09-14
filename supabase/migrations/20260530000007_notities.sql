-- Notitiemodule — extern geheugen voor de beheerder
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

CREATE TABLE IF NOT EXISTS notities (
  id            bigserial   PRIMARY KEY,
  titel         text        NOT NULL DEFAULT '',
  inhoud        text        NOT NULL DEFAULT '',
  categorie     text        NOT NULL DEFAULT 'Overig',
  koppel_type   text,        -- 'medewerker' | 'leverancier' | 'apparaat' | NULL
  koppel_id     integer,
  koppel_naam   text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notities_bijgewerkt_idx ON notities(bijgewerkt_op DESC);

ALTER TABLE notities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_notities" ON notities
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
