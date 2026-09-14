-- Melden: er is iets stuk, iets is bijna op
--
-- Zie docs/Modules/meldingen.md. Besloten op 24 augustus 2026.
--
-- Tot nu toe ging dit via een appje dat tussen twintig andere berichten
-- verdween. Nu komt het op één plek binnen en blijft het staan tot Sander het
-- aftikt.
--
-- Openstaande meldingen zijn voor iedereen zichtbaar. Dat is met opzet: het
-- voorkomt dat vier mensen dezelfde kapotte frituur melden, en het laat zien dat
-- er iets mee gebeurt.

CREATE TABLE IF NOT EXISTS public.meldingen (
  id              bigserial PRIMARY KEY,
  soort           text NOT NULL CHECK (soort IN ('stuk', 'voorraad', 'hygiene', 'overig')),
  tekst           text NOT NULL,
  -- Bij een melding vanaf de temperatuurronde weten we om welk apparaat het
  -- gaat. De naam wordt erbij bewaard: een apparaat kan later weg, de melding
  -- moet leesbaar blijven.
  apparaat_id     int REFERENCES public.haccp_apparaten(id) ON DELETE SET NULL,
  apparaat_naam   text,
  foto_pad        text,
  medewerker_id   uuid REFERENCES public.sollicitaties(id),
  door_naam       text,
  gemeld_op       timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'afgehandeld')),
  afgehandeld_op  timestamptz,
  afgehandeld_door text,
  reactie         text
);

CREATE INDEX IF NOT EXISTS meldingen_open_idx ON public.meldingen (status, gemeld_op DESC);

ALTER TABLE public.meldingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meldingen FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.meldingen;
CREATE POLICY app_gebruiker ON public.meldingen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker_meldt ON public.meldingen;
CREATE POLICY medewerker_meldt ON public.meldingen
  FOR INSERT TO authenticated
  WITH CHECK (public.huidige_medewerker() IS NOT NULL);

-- Iedereen die is ingelogd ziet wat er gemeld is. Afhandelen kan alleen Sander:
-- er is geen UPDATE-regel voor medewerkers, dus niemand kan zijn eigen melding
-- wegpoetsen.
DROP POLICY IF EXISTS medewerker_leest ON public.meldingen;
CREATE POLICY medewerker_leest ON public.meldingen
  FOR SELECT TO authenticated
  USING (public.huidige_medewerker() IS NOT NULL);

-- Foto's bij een melding, in de bak Documenten onder meldingen/.
DROP POLICY IF EXISTS meldingfotos ON storage.objects;
CREATE POLICY meldingfotos ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'meldingen'
    AND (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'meldingen'
    AND (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)
  );

-- Waar meldingen heen gemaild worden. In de instellingen en niet in de code,
-- zodat het aanpasbaar is als er ooit een bedrijfsleider bijkomt.
INSERT INTO public.instellingen (sleutel, waarde)
VALUES ('meldingen_naar', '{"adres": "sander@boskmafoodservice.nl"}'::jsonb)
ON CONFLICT (sleutel) DO NOTHING;
