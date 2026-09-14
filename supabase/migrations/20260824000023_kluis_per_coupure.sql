-- De kluis per coupure
--
-- Zie docs/Modules/kas.md. Uitgebreid op 24 augustus 2026.
--
-- De kluis hield twee bedragen bij: munten en briefgeld. Maar bij "uit de kassa"
-- weet de app het al per coupure — die informatie werd weggegooid zodra het naar
-- de kluis ging. En zonder aantallen kun je de kluis niet natellen: je weet wel
-- dat er honderd euro aan munten ligt, niet of dat rollen dubbeltjes zijn of
-- twee-euromunten.
--
-- Vanaf nu heeft elke mutatie regels per coupure. De bedragen in
-- kluis_mutaties blijven staan als optelsom daarvan, zodat een saldo in geld
-- nooit los kan komen te staan van de aantallen.

CREATE TABLE IF NOT EXISTS public.kluis_mutatie_regels (
  id          bigserial PRIMARY KEY,
  mutatie_id  bigint NOT NULL REFERENCES public.kluis_mutaties(id) ON DELETE CASCADE,
  waarde_cent int NOT NULL,
  -- Getekend: positief is erbij, negatief is eraf. Net als bij de bedragen.
  aantal      int NOT NULL,
  UNIQUE (mutatie_id, waarde_cent)
);

CREATE INDEX IF NOT EXISTS kluis_mutatie_regels_idx
  ON public.kluis_mutatie_regels (mutatie_id);

ALTER TABLE public.kluis_mutatie_regels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kluis_mutatie_regels FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.kluis_mutatie_regels;
CREATE POLICY app_gebruiker ON public.kluis_mutatie_regels
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS mag_kassen ON public.kluis_mutatie_regels;
CREATE POLICY mag_kassen ON public.kluis_mutatie_regels
  FOR ALL TO authenticated
  USING (public.heeft_recht('kas')) WITH CHECK (public.heeft_recht('kas'));

-- Wat er al staat: mutaties uit de kassa kunnen hun regels alsnog krijgen, want
-- die staan in de telling. De rest niet — die zijn destijds alleen als bedrag
-- ingevoerd.
INSERT INTO public.kluis_mutatie_regels (mutatie_id, waarde_cent, aantal)
SELECT m.id, r.waarde_cent, r.eruit
  FROM public.kluis_mutaties m
  JOIN public.kas_telling_regels r ON r.telling_id = m.telling_id
 WHERE m.soort = 'uit_kassa'
   AND r.eruit > 0
ON CONFLICT (mutatie_id, waarde_cent) DO NOTHING;

DO $$
DECLARE
  totaal int;
  zonder int;
BEGIN
  SELECT count(*) INTO totaal FROM public.kluis_mutaties;
  SELECT count(*) INTO zonder
    FROM public.kluis_mutaties m
   WHERE NOT EXISTS (SELECT 1 FROM public.kluis_mutatie_regels r WHERE r.mutatie_id = m.id);

  RAISE NOTICE 'kluismutaties: %, waarvan zonder coupures: %', totaal, zonder;
  IF zonder > 0 THEN
    RAISE NOTICE 'die tellen wel mee in het geldsaldo maar niet in de aantallen; natellen zet dat recht';
  END IF;
END $$;
