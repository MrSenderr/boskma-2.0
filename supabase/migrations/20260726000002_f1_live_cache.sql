-- Gedeelde buffer voor live F1-data.
-- OpenF1 staat 60 verzoeken per minuut toe. Zonder buffer doet elk scherm zijn
-- eigen aanvragen en loop je daar snel tegenaan. Nu verversen we centraal en
-- lezen alle schermen dezelfde momentopname.

CREATE TABLE IF NOT EXISTS f1_live_cache (
  id         int PRIMARY KEY DEFAULT 1,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  bijgewerkt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_live_cache_enkel_rij CHECK (id = 1)
);

INSERT INTO f1_live_cache (id, data, bijgewerkt)
VALUES (1, '{}'::jsonb, now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE f1_live_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_f1_live_cache" ON f1_live_cache
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
