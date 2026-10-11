-- De medewerker mag zijn eigen voorkeur zien en opnieuw invullen.
--
-- Opslaan is een nieuwe regel, geen wijziging van de oude: zo blijft staan wat
-- iemand eerder opgaf, en kun je later nazien wanneer iets veranderde. De view
-- rooster_voorkeuren_laatste pakt vanzelf de nieuwste.
--
-- Er is bewust geen update- of deleteregel. Je eigen antwoord van vorige maand
-- hoort niet weggepoetst te kunnen worden.
--
-- De bestaande policy app_gebruiker (Sander leest alles) blijft zoals hij is,
-- net als de policy voor het publieke formulier op /vastedagen.

create policy eigen_voorkeur_lezen on public.rooster_voorkeuren
  for select to authenticated
  using (persoon_id = public.huidige_medewerker());

create policy eigen_voorkeur_invullen on public.rooster_voorkeuren
  for insert to authenticated
  with check (persoon_id = public.huidige_medewerker());;
