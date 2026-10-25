-- De brief zoals verstuurd, in twee vormen.
--
-- brief is de leesbare tekst: wat er die dag is aangeboden, zonder opmaak, te
-- begrijpen door iemand die alleen de database voor zich heeft. Dat is het
-- bewijsstuk.
--
-- brief_opbouw is dezelfde brief met zijn koppen, opsommingen en kaders. Het
-- scherm van de medewerker laat daarmee precies zien wat er is verstuurd, ook
-- als de tekst in de app later verandert. Zonder dit zou een brief van vorig
-- jaar worden getoond in de woorden van vandaag.

alter table public.contractvoorstellen
  add column if not exists brief_opbouw jsonb;

comment on column public.contractvoorstellen.brief is
  'De brief als platte tekst, zoals verstuurd. Het bewijsstuk; niet opnieuw samenstellen.';
comment on column public.contractvoorstellen.brief_opbouw is
  'Dezelfde brief met zijn opbouw, zodat het scherm toont wat er werkelijk is verstuurd.';

notify pgrst, 'reload schema';
