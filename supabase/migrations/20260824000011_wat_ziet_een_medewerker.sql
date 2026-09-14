-- Wat een medewerker in zijn menu ziet
--
-- Zie docs/Modules/rechten.md. Besloten op 24 augustus 2026.
--
-- Niet iedereen heeft met alles te maken: voor iemand achter de balie is de
-- mise en place nergens voor nodig, en een menu vol dingen die je nooit gebruikt
-- maakt het moeilijker om te vinden wat je wél nodig hebt.
--
-- De tabel bewaart wat er WEG moet, niet wat er mag. Daarmee ziet een nieuwe
-- medewerker vanzelf alles, en is dit een uitzondering die je bewust maakt in
-- plaats van een lijst die je bij iedere nieuwe medewerker moet aanvinken.
--
-- Dit gaat over overzicht, niet over veiligheid. Wie het adres intikt komt er
-- nog steeds; de echte grenzen staan in de RLS-regels van de tabellen zelf.

CREATE TABLE IF NOT EXISTS public.medewerker_verborgen (
  medewerker_id uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  onderdeel     text NOT NULL CHECK (onderdeel IN (
                  'temperaturen', 'taken', 'mep', 'recepten', 'levering', 'frituurvet')),
  verborgen_op  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (medewerker_id, onderdeel)
);

ALTER TABLE public.medewerker_verborgen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medewerker_verborgen FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.medewerker_verborgen;
CREATE POLICY app_gebruiker ON public.medewerker_verborgen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

-- Je moet je eigen menu kunnen opbouwen, dus je mag zien wat er voor jou uit staat.
DROP POLICY IF EXISTS medewerker_eigen ON public.medewerker_verborgen;
CREATE POLICY medewerker_eigen ON public.medewerker_verborgen
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker());
