-- Onboarding flow
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

-- 1. Onboarding tokens tabel
CREATE TABLE IF NOT EXISTS onboarding_tokens (
  token          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sollicitatie_id UUID NOT NULL REFERENCES sollicitaties(id) ON DELETE CASCADE,
  aangemaakt_op  TIMESTAMPTZ NOT NULL DEFAULT now(),
  gebruikt_op    TIMESTAMPTZ
);

-- Index voor snelle lookup op sollicitatie
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_sollicitatie
  ON onboarding_tokens(sollicitatie_id);

-- RLS: tabel is alleen toegankelijk via Edge Functions (service role)
ALTER TABLE onboarding_tokens ENABLE ROW LEVEL SECURITY;
-- Geen anon-policies: alle toegang verloopt via Edge Functions met service role key

-- 2. Onboarding kolommen op sollicitaties
ALTER TABLE sollicitaties
  ADD COLUMN IF NOT EXISTS onboarding_verstuurd_op  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_ingevuld_op   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_data          JSONB;

-- onboarding_data structuur (ter documentatie):
-- {
--   straat:             text,
--   huisnummer:         text,
--   postcode:           text,
--   woonplaats:         text,
--   bsn:                text,
--   iban:               text,
--   noodcontact_naam:   text,
--   noodcontact_tel:    text,
--   loonheffingskorting: boolean,
--   tshirt_maat:        text   -- S | M | L | XL | XXL
-- }
