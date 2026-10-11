alter table public.rooster_voorkeuren
  add column persoon_id uuid references public.sollicitaties(id) on delete cascade;

create index rooster_voorkeuren_persoon_idx on public.rooster_voorkeuren (persoon_id, ingevuld_op desc);

-- Namen voor de keuzelijst op /vastedagen. Alleen id + naam van wie nu in dienst is.
create function public.vaste_dagen_namen()
returns table (id uuid, naam text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, trim(concat_ws(' ', s.voornaam, s.tussenvoegsel, s.achternaam))
  from public.sollicitaties s
  where s.fase = 'medewerker'
    and s.uit_dienst_op is null
    and coalesce(s.is_apparaat, false) = false
  order by s.voornaam, s.achternaam
$$;

revoke all on function public.vaste_dagen_namen() from public;
grant execute on function public.vaste_dagen_namen() to anon, authenticated;

-- Inzenden alleen voor iemand die nu in dienst is.
alter policy "iedereen mag inzenden" on public.rooster_voorkeuren
  rename to "inzenden voor medewerker in dienst";
alter policy "inzenden voor medewerker in dienst" on public.rooster_voorkeuren
  with check (persoon_id in (select v.id from public.vaste_dagen_namen() v));

-- Lezen in de app.
create policy app_gebruiker on public.rooster_voorkeuren
  for select to authenticated using (is_app_user());
grant select on public.rooster_voorkeuren to authenticated;
grant select on public.rooster_voorkeuren_laatste to authenticated;
