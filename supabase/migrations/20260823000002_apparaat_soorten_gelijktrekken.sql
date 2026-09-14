-- Soortnamen van apparaten gelijktrekken
--
-- De oude app gebruikte 'koelkast'; de nieuwe app noemt het 'koeling', omdat een
-- koelcel en een koelwerkbank ook koelingen zijn maar geen kast. Zonder deze
-- migratie vielen bestaande apparaten terug op 'Overig' en verdwenen hun
-- grenzen uit beeld.

UPDATE public.haccp_apparaten SET type = 'koeling'
 WHERE lower(type) IN ('koelkast', 'koelcel', 'koel');

UPDATE public.haccp_apparaten SET type = 'vriezer'
 WHERE lower(type) IN ('vrieskast', 'vriescel', 'vries');

UPDATE public.haccp_apparaten SET type = 'warmhoudunit'
 WHERE lower(type) IN ('warmhoud', 'bain-marie', 'bainmarie');

-- Alles wat we niet herkennen blijft staan zoals het staat; dat wordt in de app
-- als 'Overig' getoond en is daar met één keuze recht te zetten.
