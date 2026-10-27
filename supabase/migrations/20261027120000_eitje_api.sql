-- De koppeling met eitje via hun API
--
-- Tot nu toe kwamen de uren uit een Excel-uitdraai die per mail binnenkwam.
-- Die uitdraai kent alleen namen, en namen lopen uit elkaar: in eitje staat
-- "Ilona Swagerman", bij ons "Swagerman-Honselaar". De app matcht daarom ruim
-- en vraagt wat overblijft met de hand aan.
--
-- De API geeft iets wat de uitdraai niet had: een vast nummer per persoon, met
-- e-mailadres en geboortedatum ernaast. Dat nummer verandert niet als iemand
-- trouwt. Leg je het één keer vast, dan hoeft er daarna nooit meer geraden te
-- worden.

-- 1. Het nummer bij de medewerker ---------------------------------------------

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS eitje_user_id integer;

COMMENT ON COLUMN public.sollicitaties.eitje_user_id IS
  'Het vaste nummer van deze persoon in eitje. Gevuld door de koppeling; '
  'daarna is matchen op naam niet meer nodig.';

-- Twee medewerkers met hetzelfde eitje-nummer is altijd een fout: dan belanden
-- de uren van de één op de ander. Liever de koppeling weigeren dan de uren
-- verkeerd neerzetten.
CREATE UNIQUE INDEX IF NOT EXISTS sollicitaties_eitje_user_id_idx
  ON public.sollicitaties (eitje_user_id)
  WHERE eitje_user_id IS NOT NULL;

-- 2. Het nummer ook bij de urenregel -------------------------------------------
--
-- Waarom niet alleen medewerker_id: een naam die bij de import niet thuis te
-- brengen was, krijgt geen medewerker. Wijs je die persoon later aan, dan moet
-- zijn hele historie meeverhuizen. Met alleen een naam is dat weer hetzelfde
-- gokwerk; met dit nummer is het één opdracht.

ALTER TABLE public.gewerkte_uren
  ADD COLUMN IF NOT EXISTS eitje_user_id integer;

CREATE INDEX IF NOT EXISTS gewerkte_uren_eitje_user_idx
  ON public.gewerkte_uren (eitje_user_id)
  WHERE eitje_user_id IS NOT NULL;

-- 3. Of de uren zijn goedgekeurd ------------------------------------------------
--
-- Dit weet de API en de uitdraai niet. Het staat hier omdat het
-- twaalfmaandsgemiddelde in een aanbod belandt dat juridisch bindend is: dan
-- hoort zichtbaar te zijn of die uren ook zijn afgetekend. Leeg betekent
-- onbekend — dat zijn de regels die uit de Excel kwamen.

ALTER TABLE public.gewerkte_uren
  ADD COLUMN IF NOT EXISTS goedgekeurd boolean;

NOTIFY pgrst, 'reload schema';
