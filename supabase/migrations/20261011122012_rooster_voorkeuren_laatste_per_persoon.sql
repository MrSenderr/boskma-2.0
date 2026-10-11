create or replace view public.rooster_voorkeuren_laatste with (security_invoker = true) as
select distinct on (coalesce(persoon_id::text, lower(trim(naam)))) *
from public.rooster_voorkeuren
order by coalesce(persoon_id::text, lower(trim(naam))), ingevuld_op desc;
grant select on public.rooster_voorkeuren_laatste to authenticated;
