-- Een broodje om de stapel
--
-- Zie docs/Modules/werkkaarten.md. Bij een gestapelde kaart hoort onderaan en
-- bovenaan een broodje, zodat de stapel leest als de burger die eruit komt.
--
-- Het broodje is geen stap: het gaat apart de oven in en heeft zijn eigen timer
-- in het bereidingsblok. Het is dus puur de omlijsting van de stapel, en daarom
-- een vinkje per kaart en geen regel in de lijst.

ALTER TABLE public.werkkaarten
  ADD COLUMN IF NOT EXISTS broodje boolean NOT NULL DEFAULT false;

UPDATE public.werkkaarten w
   SET broodje = true
  FROM public.werkkaart_categorieen c
 WHERE c.id = w.categorie_id
   AND c.naam = 'Burgers';

DO $$
BEGIN
  RAISE NOTICE 'kaarten met een broodje: %',
    (SELECT count(*) FROM public.werkkaarten WHERE broodje);
END $$;
