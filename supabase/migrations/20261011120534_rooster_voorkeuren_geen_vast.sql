alter table public.rooster_voorkeuren
  add column wil_vast boolean not null default true,
  add column akkoord_geen_vast boolean not null default false;

alter table public.rooster_voorkeuren
  alter column di drop not null, alter column wo drop not null, alter column "do" drop not null,
  alter column vr drop not null, alter column za drop not null, alter column zo drop not null,
  alter column za_hele_dag drop not null, alter column zo_hele_dag drop not null,
  alter column aantal_vast drop not null;

alter table public.rooster_voorkeuren add constraint vast_of_akkoord check (
  (wil_vast and di is not null and wo is not null and "do" is not null and vr is not null
     and za is not null and zo is not null and za_hele_dag is not null and zo_hele_dag is not null
     and aantal_vast is not null)
  or (not wil_vast and akkoord_geen_vast)
);

comment on column public.rooster_voorkeuren.wil_vast is 'false = wil geen vaste dagen; wordt alleen ingepland als er ruimte ontstaat op de vaste plekken (akkoord_geen_vast = bevestigd).';

create or replace view public.rooster_voorkeuren_laatste with (security_invoker = true) as
select distinct on (lower(trim(naam))) *
from public.rooster_voorkeuren
order by lower(trim(naam)), ingevuld_op desc;
