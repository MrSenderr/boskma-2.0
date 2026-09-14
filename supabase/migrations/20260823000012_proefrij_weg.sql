-- Proefsollicitatie opruimen
--
-- Bij het natrekken of het sollicitatieformulier nog werkte na het afsluiten van
-- de functies is er een echte rij aangemaakt. Die hoort er niet te staan.

DELETE FROM public.sollicitaties
 WHERE voornaam = 'Test'
   AND achternaam = 'Probe'
   AND fase = 'sollicitant'
   AND aangemeld_op > now() - interval '1 hour';
