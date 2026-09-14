-- Rotatie met een looptijd.
-- Zonder datums geldt een regel altijd. Met datums alleen binnen die periode,
-- zodat bijvoorbeeld een kermis-diashow vanzelf begint en weer stopt.

ALTER TABLE screen_rotatie ADD COLUMN IF NOT EXISTS van DATE;
ALTER TABLE screen_rotatie ADD COLUMN IF NOT EXISTS tot DATE;

COMMENT ON COLUMN screen_rotatie.van IS
  'Eerste dag dat deze regel meedoet. Leeg = vanaf altijd.';
COMMENT ON COLUMN screen_rotatie.tot IS
  'Laatste dag dat deze regel meedoet, deze dag telt mee. Leeg = tot altijd.';
