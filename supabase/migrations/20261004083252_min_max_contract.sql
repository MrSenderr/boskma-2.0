-- Min-max-overeenkomst: een ondergrens en een bovengrens aan de uren
--
-- Naast vaste uren en een nulurencontract komt er een derde vorm, waarbij je
-- een minimum garandeert en een maximum afspreekt. Die twee getallen zijn geen
-- detail: het minimum is wat je hoe dan ook betaalt, en het verschil tussen de
-- twee is waar het loonbureau naar kijkt.
--
-- contracturen blijft wat het was: het vaste aantal uren per week bij een
-- contract met vaste uren. Bij een min-max staat het aantal in deze twee.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS uren_min numeric(4,1),
  ADD COLUMN IF NOT EXISTS uren_max numeric(4,1);

COMMENT ON COLUMN public.sollicitaties.uren_min IS
  'Min-max-overeenkomst: het gegarandeerde aantal uren per week.';
COMMENT ON COLUMN public.sollicitaties.uren_max IS
  'Min-max-overeenkomst: het hoogste aantal uren per week dat je mag oproepen.';

-- PostgREST onthoudt de vorm van elke tabel; zonder dit blijven de nieuwe
-- kolommen onzichtbaar voor de app.
NOTIFY pgrst, 'reload schema';
