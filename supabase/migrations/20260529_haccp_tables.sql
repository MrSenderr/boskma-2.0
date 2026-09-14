-- HACCP tablet app tables — Snackerie Zonnetje
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- 1. Apparaten (temperature-measured devices, managed from beheerapp)
CREATE TABLE IF NOT EXISTS haccp_apparaten (
  id SERIAL PRIMARY KEY,
  naam TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'overig', -- koelkast | vriezer | friteuse | warmhoudunit | overig
  actief BOOLEAN NOT NULL DEFAULT TRUE,
  min_temp NUMERIC(5,1),
  max_temp NUMERIC(5,1),
  volgorde INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Taken (checklist tasks, managed from beheerapp)
CREATE TABLE IF NOT EXISTS haccp_taken (
  id SERIAL PRIMARY KEY,
  naam TEXT NOT NULL,
  type TEXT NOT NULL, -- opening | sluiting | mise_en_place | schoonmaak_dagelijks | schoonmaak_wekelijks
  actief BOOLEAN NOT NULL DEFAULT TRUE,
  volgorde INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Temperatuurmetingen
CREATE TABLE IF NOT EXISTS haccp_temps (
  id BIGSERIAL PRIMARY KEY,
  apparaat_id INT,
  apparaat_naam TEXT NOT NULL,
  employee_id INT NOT NULL,
  employee_naam TEXT,
  temperatuur NUMERIC(5,1) NOT NULL,
  afwijking BOOLEAN DEFAULT FALSE,
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  tijd TIME NOT NULL DEFAULT CURRENT_TIME,
  opmerking TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Checklists (opening/sluiting/mise/schoonmaak completions)
CREATE TABLE IF NOT EXISTS haccp_checklists (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- opening | sluiting | mise_en_place | schoonmaak_dagelijks | schoonmaak_wekelijks
  employee_id INT NOT NULL,
  employee_naam TEXT,
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]', -- [{taak_id, naam, gedaan, opmerking}]
  afgerond BOOLEAN DEFAULT FALSE,
  afgerond_op TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leveringen temperatuurlog
CREATE TABLE IF NOT EXISTS haccp_leveringen (
  id BIGSERIAL PRIMARY KEY,
  employee_id INT NOT NULL,
  employee_naam TEXT,
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  leverancier TEXT NOT NULL,
  product TEXT NOT NULL,
  temperatuur NUMERIC(5,1) NOT NULL,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  opmerking TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Employee PINs (tablet login)
CREATE TABLE IF NOT EXISTS employee_pins (
  employee_id INT PRIMARY KEY,
  pin TEXT,               -- 4-digit plain PIN (low-risk kiosk context)
  tablet_toegang BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS: allow anon full access (kiosk context, all via anon key) ────────────
ALTER TABLE haccp_apparaten   ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_taken        ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_temps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_checklists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_leveringen   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pins      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON haccp_apparaten   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON haccp_taken        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON haccp_temps        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON haccp_checklists   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON haccp_leveringen   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON employee_pins      FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Default apparaten ────────────────────────────────────────────────────────
INSERT INTO haccp_apparaten (naam, type, actief, min_temp, max_temp, volgorde) VALUES
  ('Koelkast',        'koelkast',     TRUE,   0.0,   7.0,  1),
  ('Vriezer',         'vriezer',      TRUE, -25.0, -18.0,  2),
  ('Friteuse 1',      'friteuse',     TRUE, 170.0, 190.0,  3),
  ('Friteuse 2',      'friteuse',     TRUE, 170.0, 190.0,  4),
  ('Warmhoudunit',    'warmhoudunit', TRUE,  63.0,  80.0,  5)
ON CONFLICT DO NOTHING;

-- ─── Default taken ────────────────────────────────────────────────────────────
INSERT INTO haccp_taken (naam, type, actief, volgorde) VALUES
  -- Opening
  ('Temperaturen meten en noteren',           'opening', TRUE,  1),
  ('Koelkast en vriezer controleren',         'opening', TRUE,  2),
  ('Frituurvet controleren op kleur en geur', 'opening', TRUE,  3),
  ('Werkoppervlakken reinigen',               'opening', TRUE,  4),
  ('Handzeep en papier bijvullen',            'opening', TRUE,  5),
  ('Kassa opstarten en aanslaan',             'opening', TRUE,  6),
  ('Bestellingen nakijken',                   'opening', TRUE,  7),
  ('Muziek/TV aanzetten',                     'opening', TRUE,  8),
  ('Terras/stoelen neerzetten (indien van toepassing)', 'opening', TRUE, 9),
  ('Deuren ontgrendelen',                     'opening', TRUE, 10),
  -- Sluiting
  ('Frituurvet affilteren en afdekken',       'sluiting', TRUE,  1),
  ('Alle apparaten uitschakelen',             'sluiting', TRUE,  2),
  ('Werkoppervlakken afnemen en desinfecteren','sluiting', TRUE,  3),
  ('Vloer vegen en dweilen',                  'sluiting', TRUE,  4),
  ('Afval afvoeren en zakken vervangen',      'sluiting', TRUE,  5),
  ('Koelkast en vriezer sluiten',             'sluiting', TRUE,  6),
  ('Kassa afsluiten en geld tellen',          'sluiting', TRUE,  7),
  ('Bestellijst controleren',                 'sluiting', TRUE,  8),
  ('Alarm instellen',                         'sluiting', TRUE,  9),
  ('Deuren en ramen vergrendelen',            'sluiting', TRUE, 10),
  -- Mise en place
  ('Sauzen aanvullen (mayonaise, ketchup, curry)', 'mise_en_place', TRUE, 1),
  ('Pindasaus klaarmaken',                    'mise_en_place', TRUE, 2),
  ('Salade snijden',                          'mise_en_place', TRUE, 3),
  ('Uien snipperen',                          'mise_en_place', TRUE, 4),
  ('Broodjes/zakjes klaarleggen',             'mise_en_place', TRUE, 5),
  ('Garnering klaarzetten (peterselie, paprika)', 'mise_en_place', TRUE, 6),
  ('Frituurbakken vullen en voorverwarmen',   'mise_en_place', TRUE, 7),
  ('Beleg vleeswaren portioneren',            'mise_en_place', TRUE, 8),
  -- Schoonmaak dagelijks
  ('Frituur en afdruipbak reinigen',          'schoonmaak_dagelijks', TRUE, 1),
  ('Werkbladen en snijplanken desinfecteren', 'schoonmaak_dagelijks', TRUE, 2),
  ('Kassa en touchscreen afnemen',            'schoonmaak_dagelijks', TRUE, 3),
  ('Vloer vegen en dweilen (keuken)',         'schoonmaak_dagelijks', TRUE, 4),
  ('Afvalbakken legen en reinigen',           'schoonmaak_dagelijks', TRUE, 5),
  ('Koelkast buitenkant afnemen',             'schoonmaak_dagelijks', TRUE, 6),
  ('Tafels en stoelen terras afnemen',        'schoonmaak_dagelijks', TRUE, 7),
  ('Ramen en deuren veegschoon maken',        'schoonmaak_dagelijks', TRUE, 8),
  -- Schoonmaak wekelijks
  ('Koelkast van binnen reinigen',            'schoonmaak_wekelijks', TRUE, 1),
  ('Vriezer ontdooien en reinigen',           'schoonmaak_wekelijks', TRUE, 2),
  ('Frituurketel volledig reinigen',          'schoonmaak_wekelijks', TRUE, 3),
  ('Afzuigkap en filter reinigen',            'schoonmaak_wekelijks', TRUE, 4),
  ('Muren en tegels afspuiten',               'schoonmaak_wekelijks', TRUE, 5),
  ('Magazijn opruimen en controleren',        'schoonmaak_wekelijks', TRUE, 6)
ON CONFLICT DO NOTHING;
