-- Werkkaarten: hoe je een gerecht opbouwt
--
-- Zie docs/Modules/werkkaarten.md. Besloten op 24 augustus 2026, naar de pdf
-- "zonnetje_werkkaarten_2".
--
-- Bewust los van recepten. Een recept gaat over de voorbereiding — pindasaus in
-- bulk. Een werkkaart gaat over de service — hoe stapel ik dit broodje. Andere
-- vraag, ander moment, andere weergave.

CREATE TABLE IF NOT EXISTS public.werkkaart_categorieen (
  id                 bigserial PRIMARY KEY,
  naam               text NOT NULL,
  volgorde           int NOT NULL DEFAULT 0,
  -- 'lijst' = genummerde stappen, 'stapel' = blokken van onder naar boven
  weergave           text NOT NULL DEFAULT 'lijst' CHECK (weergave IN ('lijst', 'stapel')),
  -- Wat voor élk gerecht in deze categorie geldt; komt bovenaan elke kaart te
  -- staan. Op één plek bewaard, overal getoond.
  gedeelde_bereiding text,
  actief             boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.werkkaarten (
  id                bigserial PRIMARY KEY,
  categorie_id      bigint NOT NULL REFERENCES public.werkkaart_categorieen(id) ON DELETE CASCADE,
  naam              text NOT NULL,
  -- Leeg = de weergave van de categorie aanhouden.
  weergave          text CHECK (weergave IN ('lijst', 'stapel')),
  -- Een gerecht dat de gedeelde bereiding niet volgt heeft zijn eigen verhaal.
  gebruikt_gedeelde boolean NOT NULL DEFAULT true,
  eigen_bereiding   text,
  foto_pad          text,
  volgorde          int NOT NULL DEFAULT 0,
  actief            boolean NOT NULL DEFAULT true,
  bijgewerkt_op     timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door   text
);

CREATE TABLE IF NOT EXISTS public.werkkaart_stappen (
  id       bigserial PRIMARY KEY,
  kaart_id bigint NOT NULL REFERENCES public.werkkaarten(id) ON DELETE CASCADE,
  volgorde int NOT NULL DEFAULT 0,
  tekst    text NOT NULL,
  -- Een stap die om de oven of de frituur gaat; die valt op met een kleur.
  apparaat boolean NOT NULL DEFAULT false,
  -- Staat hier een getal, dan wordt de stap een tikbare timer.
  minuten  int,
  -- Alleen bij de stapelweergave: waar het blok voor staat.
  kleur    text CHECK (kleur IN ('groente','vlees','bacon','kaas','saus','brood','overig'))
);

CREATE INDEX IF NOT EXISTS werkkaarten_categorie_idx
  ON public.werkkaarten (categorie_id, volgorde);
CREATE INDEX IF NOT EXISTS werkkaart_stappen_kaart_idx
  ON public.werkkaart_stappen (kaart_id, volgorde);

-- Lezen mag iedereen die is ingelogd; schrijven wie recepten mag bijhouden.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['werkkaart_categorieen', 'werkkaarten', 'werkkaart_stappen'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    EXECUTE format('DROP POLICY IF EXISTS iedereen_leest ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY iedereen_leest ON public.%I FOR SELECT TO authenticated '
      'USING (public.is_app_user() OR public.huidige_medewerker() IS NOT NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS mag_schrijven ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mag_schrijven ON public.%I FOR ALL TO authenticated '
      'USING (public.heeft_recht(''recepten'')) WITH CHECK (public.heeft_recht(''recepten''))', t);
  END LOOP;
END $$;
