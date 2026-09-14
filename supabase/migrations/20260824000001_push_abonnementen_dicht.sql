-- push_subscriptions alsnog op slot
--
-- Bij het afsluiten van de beheertabellen (20260822000001) is deze tabel
-- overgeslagen: hij stond niet in de lijst. Gevolg: iedereen met de publieke
-- sleutel kon de endpoints en de sleutels van de aangemelde toestellen ophalen,
-- en er waarschijnlijk ook in schrijven.
--
-- Meldingen versturen kon een buitenstaander er niet mee: daarvoor moet je
-- ondertekenen met de VAPID-privésleutel, en die staat alleen op de server. Maar
-- het is wel een lijst van toestellen, en die hoort niet open te staan.
--
-- De Edge Function send-push draait met de service role en gaat langs RLS heen;
-- die blijft dus gewoon werken.

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.push_subscriptions', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.push_subscriptions FROM anon;

CREATE POLICY app_gebruiker ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());
