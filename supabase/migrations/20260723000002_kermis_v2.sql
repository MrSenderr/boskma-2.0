-- Kermis planner v2 — schema volgens nieuw ontwerp
-- (soort eigen/extern, deels-beschikbaar met van/tot, vastgezet-vlag)
-- Tabellen zijn nog leeg, dus drop & recreate is veilig.

DROP TABLE IF EXISTS kermis_inzet;
DROP TABLE IF EXISTS kermis_persoon;
DROP TABLE IF EXISTS kermis_dag;

-- Eén rij per kermisdag. Bloktijden lopen door na middernacht:
-- eind_tijd '02:00' hoort bij de dag erna.
CREATE TABLE kermis_dag (
    id          serial PRIMARY KEY,
    datum       date NOT NULL UNIQUE,
    start_tijd  time NOT NULL DEFAULT '14:00',
    eind_tijd   time NOT NULL DEFAULT '02:00',
    kantel_tijd time NOT NULL DEFAULT '18:00',   -- moment waarop de bezetting omhoog gaat
    doel_middag smallint NOT NULL DEFAULT 6,     -- gelijktijdig aanwezig vóór het kantelmoment
    doel_avond  smallint NOT NULL DEFAULT 10,    -- gelijktijdig aanwezig ná het kantelmoment
    notitie     text
);

-- Iedereen die mee kan draaien: eigen personeel én ingevlogen hulp.
CREATE TABLE kermis_persoon (
    id            serial PRIMARY KEY,
    naam          text NOT NULL,
    telefoon      text,
    soort         text NOT NULL DEFAULT 'extern'
                  CHECK (soort IN ('eigen', 'extern')),
    medewerker_id integer,                     -- optionele koppeling naar bestaand dossier
    opmerking     text,
    actief        boolean NOT NULL DEFAULT true,
    aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kermis_persoon_actief_idx
    ON kermis_persoon (actief, soort, naam);

-- Beschikbaarheid én planning in één rij per persoon per dag.
CREATE TABLE kermis_inzet (
    persoon_id  integer NOT NULL REFERENCES kermis_persoon (id) ON DELETE CASCADE,
    dag_id      integer NOT NULL REFERENCES kermis_dag (id) ON DELETE CASCADE,
    beschikbaar text NOT NULL DEFAULT 'onbekend'
                CHECK (beschikbaar IN ('onbekend', 'ja', 'deels', 'nee')),
    van         time,                          -- alleen gevuld bij 'deels'
    tot         time,
    ingepland   boolean NOT NULL DEFAULT false,
    vastgezet   boolean NOT NULL DEFAULT false, -- generator laat deze met rust
    gewijzigd_op timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (persoon_id, dag_id)
);

CREATE INDEX kermis_inzet_dag_idx ON kermis_inzet (dag_id, ingepland);

-- ─── Row Level Security ──────────────────────────────────────────────────────
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

-- ─── Kermis Wervershoof 2026 ─────────────────────────────────────────────────
INSERT INTO kermis_dag (datum, start_tijd, eind_tijd, kantel_tijd, doel_middag, doel_avond) VALUES
    ('2026-08-15', '14:00', '02:00', '18:00', 6, 10),
    ('2026-08-16', '14:00', '02:00', '18:00', 6, 10),
    ('2026-08-17', '14:00', '02:00', '18:00', 6, 10),
    ('2026-08-18', '14:00', '02:00', '18:00', 6, 10)
ON CONFLICT (datum) DO NOTHING;
