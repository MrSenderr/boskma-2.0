-- Eigen cronjob voor ruim-id-kopieen-op.
--
-- Die functie hing aan daily-digest: die riep hem elke ochtend aan. Daily-digest
-- gaat weg, en daarmee zou het opruimen van identiteitsbewijzen stilletjes
-- stoppen — kopieën van paspoorten zouden dan voor onbepaalde tijd in de opslag
-- blijven staan.
--
-- Een bewaarbeperking die afhangt van een mailfunctie is geen bewaarbeperking.
-- Daarom hier, naast weer-verzamelen, met een eigen schema.
--
-- 06:00 UTC (08:00 in de zomer), kort na het oude tijdstip van daily-digest.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ruim-id-kopieen-op-dagelijks') then
    perform cron.unschedule('ruim-id-kopieen-op-dagelijks');
  end if;
end $$;

select cron.schedule(
  'ruim-id-kopieen-op-dagelijks',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/ruim-id-kopieen-op',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3p1bXFkZGVhdGV6dG1qcHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMzOTIsImV4cCI6MjA5NTIzOTM5Mn0.7VJ4jf9SVg30SKbFJH94Nj2YsCcf9jEbToCeALAT72Y'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
