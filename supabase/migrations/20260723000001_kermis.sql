-- Kermis personeelsplanner
-- Dagen, personen en inzetplanning voor de kermis van 15 t/m 18 augustus 2026
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- ─── kermis_dag: de 4 kermisdagen ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kermis_dag (
  id            bigserial PRIMARY KEY,
  datum         date NOT NULL UNIQUE,
  start_tijd    time NOT NULL DEFAULT '14:00',
  eind_tijd     time NOT NULL DEFAULT '02:00',
  kantel_tijd   time NOT NULL DEFAULT '18:00',
  doel_middag   integer NOT NULL DEFAULT 6,
  doel_avond    integer NOT NULL DEFAULT 10,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

-- ─── kermis_persoon: personeel dat ingedeeld kan worden ──────────────────────
CREATE TABLE IF NOT EXISTS kermis_persoon (
  id            bigserial PRIMARY KEY,
  naam          text NOT NULL,
  telefoon      text,
  actief        boolean NOT NULL DEFAULT true,
  volgorde      integer NOT NULL DEFAULT 0,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

-- ─── kermis_inzet: beschikbaarheid + planning per persoon per dag ────────────
CREATE TABLE IF NOT EXISTS kermis_inzet (
  id              bigserial PRIMARY KEY,
  dag_id          bigint NOT NULL REFERENCES kermis_dag(id) ON DELETE CASCADE,
  persoon_id      bigint NOT NULL REFERENCES kermis_persoon(id) ON DELETE CASCADE,
  beschikbaar     text NOT NULL DEFAULT 'onbekend',
    -- onbekend | ja | nee | misschien
  ingepland       boolean NOT NULL DEFAULT false,
  start_tijd      time,
  eind_tijd       time,
  notitie         text,
  aangemaakt_op   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dag_id, persoon_id)
);

CREATE INDEX IF NOT EXISTS kermis_inzet_dag_idx ON kermis_inzet(dag_id);
CREATE INDEX IF NOT EXISTS kermis_inzet_persoon_idx ON kermis_inzet(persoon_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE kermis_dag     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kermis_persoon ENABLE ROW LEVEL SECURITY;
ALTER TABLE kermis_inzet   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_kermis_dag" ON kermis_dag
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_kermis_persoon" ON kermis_persoon
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_kermis_inzet" ON kermis_inzet
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Seed: de 4 kermisdagen ───────────────────────────────────────────────────
INSERT INTO kermis_dag (datum, start_tijd, eind_tijd, kantel_tijd, doel_middag, doel_avond) VALUES
  ('2026-08-15', '14:00', '02:00', '18:00', 6, 10),
  ('2026-08-16', '14:00', '02:00', '18:00', 6, 10),
  ('2026-08-17', '14:00', '02:00', '18:00', 6, 10),
  ('2026-08-18', '14:00', '02:00', '18:00', 6, 10)
ON CONFLICT (datum) DO NOTHING;
