-- Dagelijkse weerverzameling. Zie supabase/functions/weer-verzamelen.
--
-- De reeks in dagboek_dagen liep 179 dagen en viel op 24 augustus 2026 stil,
-- omdat de oude app hem vanuit de browser vulde. Vanaf nu draait het hier: op
-- een schema, zonder dat er een scherm open hoeft te staan.
--
-- 05:30 UTC (07:30 in de zomer). Het Open-Meteo-archief loopt een paar dagen
-- achter, dus de functie vraagt om gisteren en pakt wat er nog niet is later
-- vanzelf op. Het tijdstip is daarmee niet kritisch.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weer-verzamelen-dagelijks') then
    perform cron.unschedule('weer-verzamelen-dagelijks');
  end if;
end $$;

select cron.schedule(
  'weer-verzamelen-dagelijks',
  '30 5 * * *',
  $cron$
  select net.http_post(
    url := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/weer-verzamelen',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- De publieke anon-sleutel. Die staat ook in de app-bundel en geeft in
      -- zijn eentje nergens toegang toe; de functie zelf schrijft met haar
      -- eigen rechten.
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3p1bXFkZGVhdGV6dG1qcHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMzOTIsImV4cCI6MjA5NTIzOTM5Mn0.7VJ4jf9SVg30SKbFJH94Nj2YsCcf9jEbToCeALAT72Y'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);
