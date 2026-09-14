-- Schermrotatie: laat een scherm meerdere bronnen na elkaar tonen.
-- Elke regel is één stap in de cyclus met een eigen weergaveduur.
-- Een URL mag een afbeelding zijn of een pagina (bijv. /f1.html).
-- Geen regels voor een scherm = oud gedrag (vaste afbeelding / tijdslot).

CREATE TABLE IF NOT EXISTS screen_rotatie (
  id            BIGSERIAL PRIMARY KEY,
  screen_id     INT NOT NULL,
  url           TEXT NOT NULL,
  label         TEXT,                      -- vrije naam, bijv. 'Menukaart' of 'Formule 1'
  seconden      INT NOT NULL DEFAULT 20,
  volgorde      INT NOT NULL DEFAULT 0,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS screen_rotatie_screen_idx ON screen_rotatie (screen_id, volgorde);

ALTER TABLE screen_rotatie ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_screen_rotatie" ON screen_rotatie
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
