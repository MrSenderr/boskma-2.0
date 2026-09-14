-- HACCP wekelijkse taken: week-tracking
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- Voorkeurs-dag op taken (0=zo, 1=ma, 2=di, 3=wo, 4=do, 5=vr, 6=za)
ALTER TABLE haccp_taken ADD COLUMN IF NOT EXISTS voorkeurs_dag smallint;

-- Tabel voor week-status van wekelijkse taken
CREATE TABLE IF NOT EXISTS haccp_week_status (
  id               bigserial PRIMARY KEY,
  taak_id          bigint NOT NULL REFERENCES haccp_taken(id) ON DELETE CASCADE,
  iso_week         smallint NOT NULL,
  jaar             smallint NOT NULL,
  gedaan           boolean NOT NULL DEFAULT false,
  gedaan_op        timestamptz,
  gedaan_door_naam text,
  aangemaakt_op    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(taak_id, iso_week, jaar)
);

CREATE INDEX IF NOT EXISTS haccp_week_status_week_idx ON haccp_week_status(jaar, iso_week);

ALTER TABLE haccp_week_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_haccp_week_status" ON haccp_week_status
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
