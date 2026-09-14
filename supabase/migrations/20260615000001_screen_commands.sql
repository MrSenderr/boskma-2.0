-- Screen commands table — remote reboot/refresh Pi's from Boskma app
-- Run in Supabase SQL editor: https://xukzumqddeateztmjpzf.supabase.co

CREATE TABLE IF NOT EXISTS screen_commands (
  id BIGSERIAL PRIMARY KEY,
  screen_id INT NOT NULL,
  command TEXT NOT NULL,           -- 'reboot' | 'refresh'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ          -- null = pending, set by Pi when done
);

-- Anon can insert (app writes commands) and read/update (Pi reads + marks done)
ALTER TABLE screen_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full access" ON screen_commands FOR ALL TO anon USING (true) WITH CHECK (true);
