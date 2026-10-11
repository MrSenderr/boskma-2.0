-- Een ingelogde medewerker mag alleen voor zichzelf invullen.
--
-- De regel voor het publieke formulier op /vastedagen laat iedereen een naam
-- uit de lijst kiezen; dat kan daar niet anders, want daar is niemand
-- ingelogd. Maar die regel gold ook voor ingelogde gebruikers, en policies
-- worden bij elkaar opgeteld. Daardoor kon een medewerker een voorkeur
-- insturen op naam van een collega.
--
-- Vanaf nu geldt die ruime regel alleen nog voor anon (het publieke
-- formulier). Wie ingelogd is valt onder eigen_voorkeur_invullen en komt
-- alleen bij zijn eigen persoon_id.

alter policy "inzenden voor medewerker in dienst" on public.rooster_voorkeuren to anon;;
