-- Module Inkoop
-- Facturen en orderbevestigingen van de groothandel, uitgelezen en nagerekend.
-- Doel: zien wat er ingekocht wordt en hoe de prijzen bewegen.

-- ─── Leveranciers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inkoop_leveranciers (
  id            serial PRIMARY KEY,
  naam          text NOT NULL UNIQUE,
  debiteurnr    text,
  actief        boolean NOT NULL DEFAULT true,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

-- ─── Documenten ──────────────────────────────────────────────────────────────
-- Een document is uniek op leverancier + soort + nummer. Bewust niet op de
-- bestandshash: dezelfde factuur opnieuw ophalen uit het portaal levert andere
-- bytes op, en zou dan dubbel meetellen in alle cijfers.
CREATE TABLE IF NOT EXISTS inkoop_documenten (
  id             serial PRIMARY KEY,
  leverancier_id integer NOT NULL REFERENCES inkoop_leveranciers(id),
  soort          text NOT NULL CHECK (soort IN ('factuur','orderbevestiging')),
  nummer         text NOT NULL,
  datum          date,
  afleverdatum   date,                  -- alleen bij orderbevestiging
  referentie     text,
  bestandsnaam   text,
  bestand_hash   text,                  -- extra signaal, geen slot
  opslagpad      text,                  -- pad naar de originele PDF
  status         text NOT NULL DEFAULT 'verwerkt'
                 CHECK (status IN ('verwerkt','controleren')),
  melding        text,                  -- waarom het document nagekeken moet worden
  som_regels     numeric(10,2),
  btw            numeric(10,2),
  totaal_incl    numeric(10,2),
  verschil       numeric(10,2),         -- afwijking op de eigen controlesom
  ontvangen      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leverancier_id, soort, nummer)
);
CREATE INDEX IF NOT EXISTS inkoop_documenten_datum_idx ON inkoop_documenten(datum);

-- ─── Regels ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inkoop_regels (
  id           serial PRIMARY KEY,
  document_id  integer NOT NULL REFERENCES inkoop_documenten(id) ON DELETE CASCADE,
  regelnr      integer,
  afleverdatum date,                    -- uit het leveringsblok; leeg bij emballage vooraan
  leveringsnr  text,
  referentie   text,
  artikelnr    text NOT NULL,
  omschrijving text,
  merk         text,
  inhoud       text,                    -- zoals gedrukt, bijv. '2x5 kilo'
  aantal       numeric(10,3) NOT NULL,
  eenheid      text,
  prijs        numeric(10,4),           -- leeg bij gratis regels
  bedrag       numeric(10,2) NOT NULL,  -- kan afwijken van aantal x prijs bij kiloartikelen
  btw_pct      smallint,
  soort        text NOT NULL DEFAULT 'Levering'
               CHECK (soort IN ('Levering','Emballage','Retour/credit','Gratis'))
);
CREATE INDEX IF NOT EXISTS inkoop_regels_doc_idx ON inkoop_regels(document_id);
CREATE INDEX IF NOT EXISTS inkoop_regels_art_idx ON inkoop_regels(artikelnr);
CREATE INDEX IF NOT EXISTS inkoop_regels_afl_idx ON inkoop_regels(afleverdatum);

-- ─── Artikelen ───────────────────────────────────────────────────────────────
-- De bestellijst van de leverancier. Levert de productgroep voor het dashboard.
-- Wat je koopt maar hier niet in staat, koop je buiten je eigen lijst om.
CREATE TABLE IF NOT EXISTS inkoop_artikelen (
  leverancier_id integer NOT NULL REFERENCES inkoop_leveranciers(id),
  artikelnr      text NOT NULL,
  omschrijving   text,
  groep          text,
  inhoud         text,
  bestelartikel  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (leverancier_id, artikelnr)
);

-- Artikelnummers die op de factuur anders staan dan op de bestellijst.
CREATE TABLE IF NOT EXISTS inkoop_artikel_alias (
  leverancier_id integer NOT NULL REFERENCES inkoop_leveranciers(id),
  van            text NOT NULL,
  naar           text NOT NULL,
  PRIMARY KEY (leverancier_id, van)
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE inkoop_leveranciers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inkoop_documenten     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inkoop_regels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inkoop_artikelen      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inkoop_artikel_alias  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_inkoop_leveranciers" ON inkoop_leveranciers
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_inkoop_documenten" ON inkoop_documenten
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_inkoop_regels" ON inkoop_regels
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_inkoop_artikelen" ON inkoop_artikelen
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_inkoop_artikel_alias" ON inkoop_artikel_alias
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Leverancier ─────────────────────────────────────────────────────────────
INSERT INTO inkoop_leveranciers (naam, debiteurnr)
VALUES ('Veldboer Eenhoorn','47425')
ON CONFLICT (naam) DO NOTHING;
