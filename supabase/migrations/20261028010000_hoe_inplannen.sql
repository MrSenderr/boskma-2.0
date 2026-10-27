-- Niet iedereen wordt op dezelfde manier ingepland
--
-- De verdeling ging ervan uit dat iedereen meedoet. Dat klopt niet, en het
-- liep meteen mis: wie zijn beschikbaarheid nooit invult gold als beschikbaar,
-- en kreeg daardoor diensten die Sander in werkelijkheid zelf belt. Zo vullen
-- precies de mensen die je níet automatisch wilt inplannen het rooster, terwijl
-- wie wél doorgeeft dat hij kan eruit wordt gedrukt.
--
-- Drie patronen in de praktijk, met twee instellingen te vangen:
--
--   verdelen     Doet mee in de verdeling. De meeste mensen.
--
--   alleen_vast  Werkt in principe alleen zijn vaste dagen. Ilona en Lenthe:
--                die vullen geen beschikbaarheid in en worden voor andere dagen
--                gebeld. Ze krijgen dus hun vaste diensten en verder niets —
--                maar ze staan wel in de lijst van wie je kunt vragen als er
--                een plek open blijft.
--
-- Joost is het derde geval: pure invalkracht. Dat is `alleen_vast` zonder
-- vaste diensten — dan wordt hij nooit ingepland en blijft hij over als iemand
-- om te bellen. Daar is geen derde waarde voor nodig.

ALTER TABLE public.sollicitaties
  ADD COLUMN IF NOT EXISTS inplannen text NOT NULL DEFAULT 'verdelen'
  CHECK (inplannen IN ('verdelen', 'alleen_vast'));

COMMENT ON COLUMN public.sollicitaties.inplannen IS
  'verdelen = doet mee in het roostervoorstel; alleen_vast = krijgt alleen zijn '
  'vaste diensten en komt verder in de lijst van wie je kunt bellen.';

NOTIFY pgrst, 'reload schema';
