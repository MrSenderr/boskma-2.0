create table public.rooster_voorkeuren (
  id uuid primary key default gen_random_uuid(),
  ingevuld_op timestamptz not null default now(),
  naam text not null check (char_length(trim(naam)) between 2 and 80),
  di text not null check (di in ('graag','kan','liever_niet','nee')),
  wo text not null check (wo in ('graag','kan','liever_niet','nee')),
  "do" text not null check ("do" in ('graag','kan','liever_niet','nee')),
  vr text not null check (vr in ('graag','kan','liever_niet','nee')),
  za text not null check (za in ('graag','kan','liever_niet','nee')),
  zo text not null check (zo in ('graag','kan','liever_niet','nee')),
  za_hele_dag text not null check (za_hele_dag in ('graag','kan','liever_niet','nee')),
  zo_hele_dag text not null check (zo_hele_dag in ('graag','kan','liever_niet','nee')),
  aantal_vast smallint not null check (aantal_vast between 0 and 6),
  blokkades text check (char_length(blokkades) <= 1000),
  geldig_tot text check (char_length(geldig_tot) <= 100),
  opmerking text check (char_length(opmerking) <= 1000)
);
comment on table public.rooster_voorkeuren is 'Uitvraag vaste dagen (okt 2026). Spits 17-20 per dag di-zo, plus za/zo hele dag (12-20). Bij dubbele naam telt de laatste inzending.';

alter table public.rooster_voorkeuren enable row level security;

create policy "iedereen mag inzenden" on public.rooster_voorkeuren
  for insert to anon, authenticated with check (true);

grant insert on public.rooster_voorkeuren to anon, authenticated;

create view public.rooster_voorkeuren_laatste with (security_invoker = true) as
select distinct on (lower(trim(naam))) *
from public.rooster_voorkeuren
order by lower(trim(naam)), ingevuld_op desc;
