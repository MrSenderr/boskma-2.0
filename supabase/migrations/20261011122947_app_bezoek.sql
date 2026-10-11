-- Wie gebruikt de app, en wanneer voor het laatst.
--
-- Bewust zo min mogelijk: per mailadres één regel met de eerste en de laatste
-- keer, en hoeveel losse dagen iemand de app opendeed. Geen klikgedrag, geen
-- schermen, geen tijdstippen per handeling. De vraag is "doet iemand er iets
-- mee", niet "wat doet iemand".
--
-- Waarom niet gewoon auth.users.last_sign_in_at: die verspringt alleen bij
-- opnieuw inloggen. Blijf je ingelogd — en dat doet iedereen — dan blijft daar
-- de datum van maanden geleden staan.

create table public.app_bezoek (
  email         text primary key,
  eerst_gezien  timestamptz not null default now(),
  laatst_gezien timestamptz not null default now(),
  dagen         integer not null default 1,
  laatste_dag   date not null default current_date
);

alter table public.app_bezoek enable row level security;

-- Alleen Sander leest het. Niemand schrijft er rechtstreeks in; dat gaat via
-- de functie hieronder, die alleen de eigen regel kan raken.
create policy app_beheert on public.app_bezoek for select to authenticated
  using (public.is_app_user());

grant select on public.app_bezoek to authenticated;

-- Ieder voor zich: de functie pakt het mailadres uit het token, dus niemand
-- kan de regel van een ander bijwerken, ook niet door iets anders mee te
-- sturen.
create or replace function public.ik_ben_er()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare adres text;
begin
  adres := lower(nullif(auth.jwt() ->> 'email', ''));
  if adres is null then return; end if;

  insert into public.app_bezoek (email)
  values (adres)
  on conflict (email) do update
    set laatst_gezien = now(),
        dagen = public.app_bezoek.dagen
                + case when public.app_bezoek.laatste_dag < current_date then 1 else 0 end,
        laatste_dag = current_date;
end;
$$;

revoke all on function public.ik_ben_er() from public;
grant execute on function public.ik_ben_er() to authenticated;

notify pgrst, 'reload schema';;
