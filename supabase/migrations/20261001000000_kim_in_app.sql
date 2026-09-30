-- Kim in de app: vragen en wachtposten met pushberichten
--
-- Wat dit doet:
--  1. push_subscriptions komt terug in public (nieuwe tabel; de oude in 'archief' blijft staan).
--  2. kim_vragen en kim_wachtposten krijgen de kolommen die de app en de push nodig hebben.
--  3. Sander (is_app_user) mag ze lezen; antwoorden en afvinken gaat via twee functies.
--  4. Een nieuwe vraag, of een wachtpost met een nieuwe melding, roept de edge function
--     kim-push aan. Die leest de rij zelf op en pusht elke rij hooguit een keer.
--
-- Let op: send-push (nieuwe sollicitatie) leest ook public.push_subscriptions. Die
-- begint dus weer te werken zodra er een abonnement in staat.


-- 1. Push-abonnementen -------------------------------------------------------

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  email       text not null default (auth.jwt() ->> 'email'),
  voor_kim    boolean not null default false,
  apparaat    text,
  created_at  timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Pushabonnementen per apparaat. voor_kim = true: dit apparaat krijgt de berichten van Kim.';

alter table public.push_subscriptions enable row level security;

drop policy if exists eigen_abonnementen on public.push_subscriptions;
create policy eigen_abonnementen on public.push_subscriptions
  for all to authenticated
  using      (email = auth.jwt() ->> 'email')
  with check (email = auth.jwt() ->> 'email' and (not voor_kim or public.is_app_user()));


-- 2. Extra kolommen ----------------------------------------------------------

alter table public.kim_vragen
  add column if not exists advies      text,          -- de letter die Kim aanraadt, bv. 'A'
  add column if not exists gepusht_op  timestamptz;   -- wanneer de push de deur uit ging

comment on column public.kim_vragen.opties is
  'Een optie per element, beginnend met de letter: ''A. Weggooien'', ''B. Bewaren''.';

alter table public.kim_wachtposten
  add column if not exists melding     text,          -- wat er veranderd is, in een zin
  add column if not exists melding_op  timestamptz,   -- Kim zet dit als er iets te melden is
  add column if not exists gepusht_op  timestamptz;

comment on column public.kim_wachtposten.melding is
  'Alleen invullen als er iets verandert: antwoord binnen, of vandaag bellen. Met melding_op = now() gaat er een push uit.';


-- 3. Lezen, antwoorden en afvinken -------------------------------------------

drop policy if exists app_leest on public.kim_vragen;
create policy app_leest on public.kim_vragen
  for select to authenticated using (public.is_app_user());

drop policy if exists app_leest on public.kim_wachtposten;
create policy app_leest on public.kim_wachtposten
  for select to authenticated using (public.is_app_user());

create or replace function public.kim_beantwoord(p_id bigint, p_antwoord text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_user() then
    raise exception 'geen toegang';
  end if;
  if coalesce(trim(p_antwoord), '') = '' then
    raise exception 'leeg antwoord';
  end if;

  update public.kim_vragen
     set antwoord      = left(trim(p_antwoord), 2000),
         beantwoord_op = now()
   where id = p_id
     and afgehandeld_op is null;

  if not found then
    raise exception 'vraag % bestaat niet of is al afgehandeld', p_id;
  end if;
end;
$$;

create or replace function public.kim_wachtpost_geregeld(p_id bigint, p_opmerking text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_user() then
    raise exception 'geen toegang';
  end if;

  update public.kim_wachtposten
     set afgedaan_op = now(),
         uitkomst    = coalesce(nullif(trim(p_opmerking), ''), 'Door Sander afgevinkt in de app')
   where id = p_id
     and afgedaan_op is null;

  if not found then
    raise exception 'wachtpost % bestaat niet of is al afgedaan', p_id;
  end if;
end;
$$;

revoke all on function public.kim_beantwoord(bigint, text)         from public, anon;
revoke all on function public.kim_wachtpost_geregeld(bigint, text) from public, anon;
grant execute on function public.kim_beantwoord(bigint, text)         to authenticated;
grant execute on function public.kim_wachtpost_geregeld(bigint, text) to authenticated;


-- 4. Push bij een nieuwe vraag of een nieuwe melding ------------------------
--
-- Geen geheim nodig: kim-push gebruikt uit het verzoek alleen tabel + nummer, leest de
-- rij zelf op en pusht elke rij hooguit een keer. Een vreemde aanroep kan dus niets
-- versturen wat niet al in de database klaarstond.

create or replace function public.kim_push_aanroepen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
    body    := jsonb_build_object('tabel', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end;
$$;

drop trigger if exists kim_vraag_push on public.kim_vragen;
create trigger kim_vraag_push
  after insert on public.kim_vragen
  for each row execute function public.kim_push_aanroepen();

drop trigger if exists kim_wachtpost_push on public.kim_wachtposten;
create trigger kim_wachtpost_push
  after update of melding_op on public.kim_wachtposten
  for each row
  when (new.melding_op is distinct from old.melding_op and new.melding is not null)
  execute function public.kim_push_aanroepen();
