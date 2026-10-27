-- Wie de voorbereiding kan doen
--
-- De mep is geen gewone dienst waar je iemand op zet omdat hij toevallig kan.
-- Bij Boskma doen drie mensen dat: Sander, Daan en Justin. Dat is een kunnen
-- en geen voorkeur, en dus een harde grens voor het roostervoorstel.
--
-- Een eigen kolom en geen werkplek. Werkplekken zijn de posten tijdens de
-- avondspits en die worden gerangschikt op belang; zou de voorbereiding daar
-- tussen komen te staan, dan ging hij meedoen in een verdeling waar hij niet
-- thuishoort — hij is 's ochtends en de spits is 's avonds.
--
-- Standaard staat hij uit. Een verkeerde "kan wel" zet iemand op de mep die
-- het niet kan; een verkeerde "kan niet" levert een open dienst op die je ziet
-- staan. Van die twee is de tweede de goedkoopste vergissing.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS kan_voorbereiding boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sollicitaties.kan_voorbereiding IS
  'Of deze medewerker de voorbereiding (mep) kan draaien. Harde grens voor het roostervoorstel.';

NOTIFY pgrst, 'reload schema';
