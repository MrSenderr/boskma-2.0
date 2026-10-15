-- Een groep bij een product in de prijslijst.
--
-- De lijst was plat en alfabetisch, dus de bollen stonden tussen de pistolets.
-- Er was al een kolom `volgorde`, maar die stond op nul bij alles en was
-- nergens in te vullen — een sorteernummer dat je niet kunt zien helpt niemand.
--
-- `groep` is de naam die je op het scherm ziet staan; `volgorde` bepaalt waar
-- die groep in de lijst komt. Producten in dezelfde groep delen hun volgorde.
-- Binnen een groep gaat het op naam.

alter table public.producten add column groep text;

comment on column public.producten.groep is
  'Kopje waaronder dit product in de prijslijst staat. Producten in dezelfde groep delen hun volgorde.';

notify pgrst, 'reload schema';
