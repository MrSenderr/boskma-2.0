-- Is deze wijziging al doorgegeven aan het loonbureau?
--
-- Medewerkers kunnen straks zelf hun gegevens aanpassen. De meeste velden
-- gaan meteen door en Sander ziet er een melding van, maar een adres of een
-- rekeningnummer raakt de loonbetaling: dat moet het loonbureau weten.
--
-- Tot nu toe verdween zo'n melding zodra hij was weggetikt, en kon je later
-- niet meer nagaan of dat rekeningnummer altijd al zo was of vorige maand is
-- veranderd. Erger: of je het had doorgegeven.
--
-- Deze kolom houdt dat laatste vast. Leeg betekent: nog doorgeven. Hij wordt
-- gezet als Sander het aftekent, of vanzelf als er een mutatieformulier naar
-- het loonbureau gaat — dat formulier bevat die gegevens al.
--
-- Alleen voor velden die het loonbureau aangaan. Bij een kledingmaat blijft
-- hij leeg en dat is goed: daar hoeft niemand iets mee.

alter table public.wijzigingen
  add column if not exists naar_loonbureau_op timestamptz;

comment on column public.wijzigingen.naar_loonbureau_op is
  'Wanneer deze wijziging aan het loonbureau is doorgegeven. Leeg bij velden die hen niet aangaan.';

notify pgrst, 'reload schema';
