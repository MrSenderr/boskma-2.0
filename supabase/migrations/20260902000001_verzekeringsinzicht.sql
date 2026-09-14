-- Velden voor de export naar Verzekeringsinzicht
--
-- Zie docs/SPEC-verzekeringsinzicht-csv.md in boskma-2.0. Drie dingen die we
-- nergens hadden staan:
--
--   contracturen  het aantal uren per week. Hieruit volgen in de export zowel
--                 ft/pt als het parttimepercentage, dus zonder dit veld kan de
--                 export niet kloppen.
--   voorletters   we hebben alleen de roepnaam. "Jan" wordt J., maar heet
--                 iemand voluit Johannes Pieter dan hoort er J.P. te staan.
--   tussenvoegsel zit nu vastgeplakt aan de achternaam ("de Vries").
--
-- Voorletters en tussenvoegsel worden in de app afgeleid zolang ze leeg zijn;
-- wat hier staat wint. Daarom geen backfill: een gok in de database is niet van
-- een correctie te onderscheiden, een gok in de app wel.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS voorletters   text,
  ADD COLUMN IF NOT EXISTS tussenvoegsel text,
  ADD COLUMN IF NOT EXISTS contracturen  numeric(4,1);

-- PostgREST onthoudt de vorm van elke tabel; zonder dit blijven de nieuwe
-- kolommen onzichtbaar voor de app.
NOTIFY pgrst, 'reload schema';

-- De huisnummer-toevoeging mag een medewerker zelf invullen ------------------
--
-- Het invulformulier had één veld voor het huisnummer, waar mensen "82 A" in
-- typen. De verzekeraar wil dat gesplitst. De export knipt het er zelf af, maar
-- wie het netjes wil zetten moet dat kunnen. Zelfde functie, één veld erbij —
-- de rest van de body staat er ongewijzigd in omdat plpgsql niet half te
-- vervangen is.

CREATE OR REPLACE FUNCTION public.mijn_gegeven_wijzigen(p_veld text, p_waarde text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mij       uuid := public.huidige_medewerker();
  toegestaan text[] := ARRAY['telefoonnummer','straat','huisnummer','toevoeging',
                             'postcode','woonplaats','noodcontact_naam','noodcontact_tel',
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
REVOKE EXECUTE ON FUNCTION public.mijn_gegeven_wijzigen(text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mijn_gegeven_wijzigen(text,text) TO authenticated;
