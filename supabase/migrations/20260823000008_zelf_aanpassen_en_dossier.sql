-- Wat een medewerker zelf kan, en het dossier
--
-- Zie docs/modules/personeel/personeelsmodule.md. Besloten op 23 augustus 2026.

-- 1. Eén stroom: elke wijziging komt langs Sander --------------------------
-- Ook een adreswijziging moet naar het loonbureau, dus alles wordt gemeld. Het
-- verschil zit in of hij eerst goedkeuring nodig heeft:
--
--   * rekeningnummer en e-mailadres  → wachten op akkoord, want die raken de
--     loonbetaling en de toegang
--   * de rest                        → meteen doorgevoerd, Sander ziet het en
--     geeft het door aan het loonbureau als dat nodig is

CREATE TABLE IF NOT EXISTS public.wijzigingen (
  id             bigserial PRIMARY KEY,
  medewerker_id  uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  veld           text NOT NULL,
  oude_waarde    text,
  nieuwe_waarde  text,
  goedkeuring_nodig boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'verwerkt', 'afgewezen')),
  aangevraagd_op timestamptz NOT NULL DEFAULT now(),
  verwerkt_op    timestamptz,
  verwerkt_door  text
);

CREATE INDEX IF NOT EXISTS wijzigingen_open_idx
  ON public.wijzigingen (status, aangevraagd_op DESC);

ALTER TABLE public.wijzigingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wijzigingen FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.wijzigingen;
CREATE POLICY app_gebruiker ON public.wijzigingen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker_eigen ON public.wijzigingen;
CREATE POLICY medewerker_eigen ON public.wijzigingen
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker());

-- Welke velden wachten op akkoord
CREATE OR REPLACE FUNCTION public.veld_vraagt_akkoord(veld text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT veld IN ('iban', 'email');
$$;

-- Eén ingang voor alles wat een medewerker aan zichzelf wijzigt. Er is geen
-- UPDATE-recht op de tabel, dus dit is de enige weg — en dan kan er ook niets
-- anders langs.
CREATE OR REPLACE FUNCTION public.mijn_gegeven_wijzigen(p_veld text, p_waarde text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mij       uuid := public.huidige_medewerker();
  toegestaan text[] := ARRAY['telefoonnummer','straat','huisnummer','postcode',
                             'woonplaats','noodcontact_naam','noodcontact_tel',
                             'tshirt_maat','iban','email'];
  oud       text;
  waarde    text := nullif(trim(coalesce(p_waarde, '')), '');
BEGIN
  IF mij IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF NOT (p_veld = ANY(toegestaan)) THEN RAISE EXCEPTION 'dit veld kun je niet zelf wijzigen'; END IF;

  SELECT CASE p_veld
           WHEN 'telefoonnummer' THEN s.telefoonnummer
           WHEN 'email'          THEN s.email
           ELSE s.onboarding_data ->> p_veld
         END
    INTO oud
    FROM public.sollicitaties s WHERE s.id = mij;

  IF coalesce(oud, '') = coalesce(waarde, '') THEN
    RETURN 'ongewijzigd';
  END IF;

  -- Een openstaand verzoek voor hetzelfde veld vervangen, niet opstapelen.
  DELETE FROM public.wijzigingen
   WHERE medewerker_id = mij AND veld = p_veld AND status = 'open';

  INSERT INTO public.wijzigingen (medewerker_id, veld, oude_waarde, nieuwe_waarde, goedkeuring_nodig)
  VALUES (mij, p_veld, oud, waarde, public.veld_vraagt_akkoord(p_veld));

  IF public.veld_vraagt_akkoord(p_veld) THEN
    RETURN 'wacht_op_akkoord';
  END IF;

  -- Meteen doorvoeren; Sander ziet hem als melding.
  IF p_veld = 'telefoonnummer' THEN
    UPDATE public.sollicitaties SET telefoonnummer = waarde WHERE id = mij;
  ELSE
    UPDATE public.sollicitaties
       SET onboarding_data = coalesce(onboarding_data, '{}'::jsonb)
                             || jsonb_build_object(p_veld, waarde)
     WHERE id = mij;
  END IF;

  RETURN 'doorgevoerd';
END;
$$;

REVOKE ALL ON FUNCTION public.mijn_gegeven_wijzigen(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.mijn_gegeven_wijzigen(text,text) TO authenticated;

-- 2. Afhandelen door Sander ----------------------------------------------------
-- Goedkeuren voert de wijziging alsnog door. Voor het e-mailadres verandert
-- daarmee ook het inlogadres, dus dat wordt in de app nog aan het account
-- gekoppeld.

CREATE OR REPLACE FUNCTION public.wijziging_afhandelen(p_id bigint, p_akkoord boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w record;
BEGIN
  IF NOT public.is_app_user() THEN RAISE EXCEPTION 'geen toegang'; END IF;

  SELECT * INTO w FROM public.wijzigingen WHERE id = p_id AND status = 'open';
  IF NOT FOUND THEN RETURN; END IF;

  IF p_akkoord AND w.goedkeuring_nodig THEN
    IF w.veld = 'email' THEN
      UPDATE public.sollicitaties SET email = w.nieuwe_waarde WHERE id = w.medewerker_id;
    ELSE
      UPDATE public.sollicitaties
         SET onboarding_data = coalesce(onboarding_data, '{}'::jsonb)
                               || jsonb_build_object(w.veld, w.nieuwe_waarde)
       WHERE id = w.medewerker_id;
    END IF;
  END IF;

  UPDATE public.wijzigingen
     SET status = CASE WHEN p_akkoord THEN 'verwerkt' ELSE 'afgewezen' END,
         verwerkt_op = now(),
         verwerkt_door = auth.jwt() ->> 'email'
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wijziging_afhandelen(bigint,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.wijziging_afhandelen(bigint,boolean) TO authenticated;

-- 3. Het dossier ---------------------------------------------------------------
-- Gespreksverslagen en documenten. Verzuim en waarschuwingen horen er
-- uitdrukkelijk niet bij.

CREATE TABLE IF NOT EXISTS public.dossier_verslagen (
  id              bigserial PRIMARY KEY,
  medewerker_id   uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  titel           text NOT NULL,
  tekst           text NOT NULL,
  gesprek_op      date NOT NULL DEFAULT CURRENT_DATE,
  geschreven_op   timestamptz NOT NULL DEFAULT now(),
  geschreven_door text,
  -- Standaard privé. Delen is een bewuste handeling.
  gedeeld_op      timestamptz,
  gelezen_op      timestamptz,
  reactie         text CHECK (reactie IN ('akkoord', 'niet_akkoord')),
  reactie_op      timestamptz,
  opmerking       text
);

CREATE INDEX IF NOT EXISTS dossier_verslagen_medewerker_idx
  ON public.dossier_verslagen (medewerker_id, gesprek_op DESC);

ALTER TABLE public.dossier_verslagen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dossier_verslagen FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.dossier_verslagen;
CREATE POLICY app_gebruiker ON public.dossier_verslagen
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

-- Een medewerker ziet alleen wat gedeeld is. Niet-gedeelde verslagen bestaan
-- voor hem niet.
DROP POLICY IF EXISTS medewerker_gedeeld ON public.dossier_verslagen;
CREATE POLICY medewerker_gedeeld ON public.dossier_verslagen
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker() AND gedeeld_op IS NOT NULL);

CREATE OR REPLACE FUNCTION public.verslag_reageren(
  p_verslag bigint, p_reactie text, p_opmerking text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mij uuid := public.huidige_medewerker();
BEGIN
  IF mij IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF p_reactie NOT IN ('akkoord', 'niet_akkoord') THEN RAISE EXCEPTION 'onbekende reactie'; END IF;

  UPDATE public.dossier_verslagen
     SET reactie    = p_reactie,
         reactie_op = now(),
         opmerking  = nullif(trim(coalesce(p_opmerking, '')), ''),
         gelezen_op = coalesce(gelezen_op, now())
   WHERE id = p_verslag
     AND medewerker_id = mij
     AND gedeeld_op IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.verslag_reageren(bigint,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.verslag_reageren(bigint,text,text) TO authenticated;

-- 4. Documenten in het dossier -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dossier_documenten (
  id            bigserial PRIMARY KEY,
  medewerker_id uuid NOT NULL REFERENCES public.sollicitaties(id) ON DELETE CASCADE,
  soort         text NOT NULL,   -- loonheffing | mutatieformulier | contract | overig
  naam          text NOT NULL,
  pad           text NOT NULL,   -- pad in de bak Documenten
  toegevoegd_op timestamptz NOT NULL DEFAULT now(),
  toegevoegd_door text
);

CREATE INDEX IF NOT EXISTS dossier_documenten_medewerker_idx
  ON public.dossier_documenten (medewerker_id, toegevoegd_op DESC);

ALTER TABLE public.dossier_documenten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dossier_documenten FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.dossier_documenten;
CREATE POLICY app_gebruiker ON public.dossier_documenten
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS medewerker_eigen_documenten ON public.dossier_documenten;
CREATE POLICY medewerker_eigen_documenten ON public.dossier_documenten
  FOR SELECT TO authenticated
  USING (medewerker_id = public.huidige_medewerker());
