-- Overgenomen medewerkers staan gewoon in dienst
--
-- Na de overzetting kwamen ze binnen als "Compleet", wat in deze module
-- betekent: klaar om naar het loonbureau te sturen. Dat klopt niet — ze werken
-- er al jaren en het loonbureau kent ze. Zonder deze correctie zou het
-- startscherm tien openstaande taken tonen die er niet zijn.
--
-- Hun dienstverband is destijds buiten deze app om geregeld, dus we zetten de
-- tijdstippen op de ingangsdatum van hun contract.

UPDATE public.sollicitaties
   SET loonbureau_verstuurd_op = COALESCE(
         loonbureau_verstuurd_op,
         ingangsdatum::timestamptz,
         aangenomen_op,
         aangemeld_op
       ),
       loonbureau_bevestigd_op = COALESCE(
         loonbureau_bevestigd_op,
         ingangsdatum::timestamptz,
         aangenomen_op,
         aangemeld_op
       )
 WHERE oude_app_id IS NOT NULL
   AND uit_dienst_op IS NULL
   AND loonbureau_bevestigd_op IS NULL;
