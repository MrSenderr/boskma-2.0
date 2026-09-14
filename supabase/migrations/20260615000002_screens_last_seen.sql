-- Voeg last_seen toe aan screens zodat de app online/offline status kan tonen
ALTER TABLE screens ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
