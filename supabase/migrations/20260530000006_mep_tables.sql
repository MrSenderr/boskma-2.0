-- MEP (Mise en Place) module
-- Taakbibliotheek + geplande taken per dag
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- ─── mep_sjablonen: taakbibliotheek ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mep_sjablonen (
  id                     bigserial PRIMARY KEY,
  naam                   text NOT NULL,
  herhaling              text NOT NULL DEFAULT 'dagelijks',
    -- dagelijks | weekdagen | wekelijks | tweewekelijks | eenmalig
  weekdagen              integer[] NOT NULL DEFAULT '{}',
    -- dag-nummers (0=zo, 1=ma, 2=di, 3=wo, 4=do, 5=vr, 6=za)
    -- alleen relevant bij herhaling = wekelijks of tweewekelijks
  tweewekelijks_pariteit smallint  NOT NULL DEFAULT 0,
    -- 0 of 1 — welke ISO-weekpariteit (even/oneven) de taak verschijnt
  volgorde               integer   NOT NULL DEFAULT 0,
  actief                 boolean   NOT NULL DEFAULT true,
  aangemaakt_op          timestamptz NOT NULL DEFAULT now()
);

-- ─── mep_dag_taken: geplande/afgevinkte taken per dag ────────────────────────
CREATE TABLE IF NOT EXISTS mep_dag_taken (
  id               bigserial PRIMARY KEY,
  datum            date    NOT NULL,
  sjabloon_id      bigint  REFERENCES mep_sjablonen(id) ON DELETE SET NULL,
  naam             text    NOT NULL,
  notitie          text,
  gedaan           boolean NOT NULL DEFAULT false,
  gedaan_door_naam text,
  gedaan_door_id   integer,
  gedaan_op        timestamptz,
  aangemaakt_op    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mep_dag_taken_datum_idx ON mep_dag_taken(datum);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE mep_sjablonen ENABLE ROW LEVEL SECURITY;
ALTER TABLE mep_dag_taken  ENABLE ROW LEVEL SECURITY;

-- Beide tabellen: anon (tablet + boskma-app) krijgt volledige toegang.
-- Beheerapp en tablet gebruiken beide de anon-sleutel.
DO $$ BEGIN
  CREATE POLICY "anon_all_mep_sjablonen" ON mep_sjablonen
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_mep_dag_taken" ON mep_dag_taken
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
