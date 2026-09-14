-- Mappen voor schermafbeeldingen en een schakelaar voor de diashow.
--
-- map:    groepeert afbeeldingen, bijvoorbeeld 'Kermis 2026' naast de gewone
--         menukaarten. Leeg betekent 'Algemeen'.
-- actief: zet een diashow uit zonder hem weg te gooien, zodat je hem kunt
--         klaarzetten en later aanzetten.

ALTER TABLE screen_images  ADD COLUMN IF NOT EXISTS map TEXT;
ALTER TABLE screen_rotatie ADD COLUMN IF NOT EXISTS actief BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS screen_images_map_idx ON screen_images (map);

COMMENT ON COLUMN screen_images.map IS
  'Naam van de map waarin deze afbeelding staat. Leeg = Algemeen.';
COMMENT ON COLUMN screen_rotatie.actief IS
  'Staat deze regel aan? Uit betekent bewaren maar niet tonen.';
