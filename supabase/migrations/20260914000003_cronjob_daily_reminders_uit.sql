-- De cronjob van daily-reminders eraf.
--
-- Die maakte elke ochtend om 07:00 Todoist-taken aan voor verjaardagen,
-- jubilea, aflopende contracten en keuringen, gelezen uit boskma_state — de
-- JSON-blob van de oude app, die sinds 24 augustus 2026 niet meer bijgewerkt
-- wordt. De functie gaat weg, dus de trekker moet er eerst af: anders draait
-- hij morgenochtend op tabellen die er niet meer zijn.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-reminders') then
    perform cron.unschedule('daily-reminders');
  end if;
end $$;
