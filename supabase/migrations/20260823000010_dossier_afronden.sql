-- Het dossier afmaken: gelezen melden, bestanden inzien, reactie opmerken
--
-- Zie docs/modules/personeel/personeelsmodule.md.

-- 1. Openen telt als gelezen ---------------------------------------------------
-- Zonder dit staat er bij Sander altijd "nog niet geopend", ook als de
-- medewerker het verslag allang gelezen heeft maar er niets van vindt.

CREATE OR REPLACE FUNCTION public.verslag_gelezen(p_verslag bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mij uuid := public.huidige_medewerker();
BEGIN
  IF mij IS NULL THEN RETURN; END IF;

  UPDATE public.dossier_verslagen
     SET gelezen_op = now()
   WHERE id = p_verslag
     AND medewerker_id = mij
     AND gedeeld_op IS NOT NULL
     AND gelezen_op IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.verslag_gelezen(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.verslag_gelezen(bigint) TO authenticated;

-- 2. Een medewerker mag bij zijn eigen dossierbestanden ------------------------
-- Documenten van het dossier staan onder dossier/<medewerker-id>/…. Daar hangt
-- het leesrecht aan: aan de map, niet aan een lijstje. Alles buiten die map
-- blijft dicht — ID-kopieën en loonheffingsverklaringen dus ook.

DROP POLICY IF EXISTS medewerker_eigen_dossierbestanden ON storage.objects;
CREATE POLICY medewerker_eigen_dossierbestanden ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'Documenten'
    AND (storage.foldername(name))[1] = 'dossier'
    AND public.huidige_medewerker() IS NOT NULL
    AND (storage.foldername(name))[2] = public.huidige_medewerker()::text
  );

-- 3. Een reactie mag niet ongemerkt blijven liggen -----------------------------
-- Vooral "niet akkoord": dat hoort Sander te zien, niet pas als hij toevallig
-- het dossier openslaat. Hij tikt hem af als hij hem gezien heeft.

ALTER TABLE public.dossier_verslagen
  ADD COLUMN IF NOT EXISTS reactie_gezien_op timestamptz;
