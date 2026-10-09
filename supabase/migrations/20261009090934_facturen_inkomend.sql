-- Inkomende facturen: wat Kim per mail binnenkrijgt
--
-- LET OP: dit staat sinds 09-10-2026 al in de database en draait. Deze migratie
-- legt alleen vast wat er is, zodat de repo en de database hetzelfde zeggen.
-- Hij is daarom als 'applied' gemarkeerd en niet opnieuw uitgevoerd. Alles is
-- bewust herhaalbaar geschreven, zodat hij op een lege database hetzelfde
-- oplevert.
--
-- Kim schrijft bij elke inkoopfactuur een rij in public.facturen. Namen van de
-- tabel en de kolommen veranderen breekt haar ronde.

create table if not exists public.facturen (
  id               bigint generated always as identity primary key,
  leverancier      text not null,
  factuurnummer    text,
  soort            text not null default 'factuur' check (soort in ('factuur','creditnota')),
  factuurdatum     date,
  vervaldatum      date,
  bedrag_incl      numeric,
  betaalwijze      text not null default 'onbekend'
                   check (betaalwijze in ('incasso','handmatig','vooraf_betaald','onbekend')),
  iban             text,
  betalingskenmerk text,
  status           text not null default 'open'
                   check (status in ('open','betaald','betwist','geannuleerd')),
  betaald_op       date,
  betaald_via      text check (betaald_via in ('incasso','handmatig','vooraf','verrekend')),
  basecone_adres   text,
  basecone_op      timestamptz,
  gmail_thread     text,
  opmerking        text,
  gepusht_op       timestamptz,
  aangemaakt_op    timestamptz not null default now(),
  bijgewerkt_op    timestamptz not null default now()
);

-- Dezelfde factuur twee keer binnenkrijgen mag geen twee rijen worden.
create unique index if not exists facturen_uniek
  on public.facturen (lower(leverancier), factuurnummer)
  where factuurnummer is not null;

create index if not exists facturen_open
  on public.facturen (vervaldatum) where status = 'open';

-- Wat een leverancier altijd doet. bevestigd = Sander heeft het zelf gezegd;
-- de rest is afgeleid uit wat er in de mails stond.
create table if not exists public.leverancier_betaalwijze (
  leverancier   text primary key,
  afzender      text,
  betaalwijze   text not null
                check (betaalwijze in ('incasso','handmatig','vooraf_betaald','onbekend')),
  iban          text,
  bevestigd     boolean not null default false,
  opmerking     text,
  bijgewerkt_op timestamptz not null default now()
);

-- Lezen mag Sander; veranderen gaat alleen via de functies hieronder, zodat er
-- nooit iets anders verandert dan de bedoeling was.
alter table public.facturen enable row level security;
alter table public.leverancier_betaalwijze enable row level security;

drop policy if exists app_leest on public.facturen;
create policy app_leest on public.facturen
  for select to authenticated using (public.is_app_user());

drop policy if exists app_leest on public.leverancier_betaalwijze;
create policy app_leest on public.leverancier_betaalwijze
  for select to authenticated using (public.is_app_user());


-- Afvinken en terugdraaien ---------------------------------------------------

create or replace function public.factuur_betaald(p_id bigint, p_datum date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  update public.facturen
     set status = 'betaald', betaald_op = coalesce(p_datum, current_date),
         betaald_via = case betaalwijze
                         when 'incasso' then 'incasso'
                         when 'vooraf_betaald' then 'vooraf'
                         else 'handmatig' end,
         bijgewerkt_op = now()
   where id = p_id and status <> 'betaald';
  if not found then raise exception 'factuur % bestaat niet of is al betaald', p_id; end if;
end $$;

create or replace function public.factuur_heropenen(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  update public.facturen
     set status = 'open', betaald_op = null, betaald_via = null, bijgewerkt_op = now()
   where id = p_id;
  if not found then raise exception 'factuur % bestaat niet', p_id; end if;
end $$;

-- Betaalwijze zetten, en standaard ook onthouden voor de volgende keer.
create or replace function public.factuur_betaalwijze(
  p_id bigint, p_betaalwijze text, p_voortaan boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lev text;
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  if p_betaalwijze not in ('incasso','handmatig','vooraf_betaald') then
    raise exception 'onbekende betaalwijze';
  end if;
  update public.facturen set betaalwijze = p_betaalwijze, bijgewerkt_op = now()
   where id = p_id returning leverancier into v_lev;
  if v_lev is null then raise exception 'factuur % bestaat niet', p_id; end if;
  if p_voortaan then
    insert into public.leverancier_betaalwijze (leverancier, betaalwijze, bevestigd, opmerking)
    values (v_lev, p_betaalwijze, true, 'Door Sander gezet in de app')
    on conflict (leverancier) do update
      set betaalwijze = excluded.betaalwijze, bevestigd = true, bijgewerkt_op = now();
  end if;
end $$;

revoke all on function public.factuur_betaald(bigint, date)            from public, anon;
revoke all on function public.factuur_heropenen(bigint)                from public, anon;
revoke all on function public.factuur_betaalwijze(bigint, text, boolean) from public, anon;
grant execute on function public.factuur_betaald(bigint, date)            to authenticated;
grant execute on function public.factuur_heropenen(bigint)                to authenticated;
grant execute on function public.factuur_betaalwijze(bigint, text, boolean) to authenticated;


-- De dagelijkse ronde --------------------------------------------------------
--
-- Een incasso hoef je niet af te vinken: die wordt afgeschreven. Een handmatige
-- factuur wel, en die mag je niet vergeten — vandaar de push.

create or replace function public.facturen_dagelijks()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.facturen
     set status = 'betaald',
         betaald_op = coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14),
         betaald_via = 'incasso', bijgewerkt_op = now()
   where status = 'open' and betaalwijze = 'incasso' and soort = 'factuur'
     and coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14) < current_date;

  -- kim-push zet gepusht_op, dus elke factuur hoogstens een keer.
  for r in
    select id from public.facturen
     where status = 'open' and betaalwijze = 'handmatig' and soort = 'factuur'
       and gepusht_op is null
       and coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14) <= current_date + 3
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'facturen', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end $$;

-- Draait als cron-taak 'facturen-dagelijks' om 05:45 UTC:
--   select cron.schedule('facturen-dagelijks', '45 5 * * *', $job$select public.facturen_dagelijks()$job$);

notify pgrst, 'reload schema';
