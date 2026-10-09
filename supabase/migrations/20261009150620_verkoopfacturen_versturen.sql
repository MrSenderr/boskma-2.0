-- Betaald, crediteren en achter de late betalers aan
--
-- Een verstuurde factuur ligt vast; wat je er nog mee kunt is bijhouden wat
-- ermee gebeurt. Corrigeren gaat alleen via een creditfactuur.

create or replace function public.verkoopfactuur_betaald(p_id bigint, p_datum date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  update public.verkoopfacturen
     set status = 'betaald', betaald_op = coalesce(p_datum, current_date), bijgewerkt_op = now()
   where id = p_id and status = 'verzonden';
  if not found then raise exception 'factuur % is niet verstuurd of staat al op betaald', p_id; end if;
end $$;

create or replace function public.verkoopfactuur_heropenen(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  update public.verkoopfacturen
     set status = 'verzonden', betaald_op = null, bijgewerkt_op = now()
   where id = p_id and status = 'betaald';
  if not found then raise exception 'factuur % staat niet op betaald', p_id; end if;
end $$;

-- Dezelfde regels, negatief. Begint als concept zodat je hem nog kunt
-- nakijken voordat hij de deur uitgaat.
create or replace function public.verkoopfactuur_crediteren(p_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_nieuw bigint; v_nummer int;
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;

  select nummer into v_nummer from public.verkoopfacturen where id = p_id;
  if v_nummer is null then
    raise exception 'factuur % is nog een concept; die pas je gewoon aan', p_id;
  end if;
  if exists (select 1 from public.verkoopfacturen where credit_van = p_id) then
    raise exception 'er is al een creditfactuur voor factuur %', v_nummer;
  end if;

  insert into public.verkoopfacturen
    (klant_id, onderwerp, notitie_op_factuur, credit_van, interne_notitie)
  select klant_id, 'Creditfactuur bij factuur ' || v_nummer, notitie_op_factuur, id,
         'Credit op factuur ' || v_nummer
    from public.verkoopfacturen where id = p_id
  returning id into v_nieuw;

  insert into public.verkoopfactuur_regels
    (factuur_id, volgorde, product_id, omschrijving, aantal, prijs_incl, btw_tarief)
  select v_nieuw, volgorde, product_id, omschrijving, -aantal, prijs_incl, btw_tarief
    from public.verkoopfactuur_regels where factuur_id = p_id order by volgorde;

  return v_nieuw;
end $$;

-- Na een herinnering zeven dagen stil. Wordt door stuur-verkoopfactuur
-- aangeroepen, niet door de app.
create or replace function public.verkoopfactuur_herinnerd(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.verkoopfacturen
     set herinnering_op = now(), gepusht_op = null, bijgewerkt_op = now()
   where id = p_id;
end $$;

revoke all on function public.verkoopfactuur_betaald(bigint, date) from public, anon;
revoke all on function public.verkoopfactuur_heropenen(bigint)     from public, anon;
revoke all on function public.verkoopfactuur_crediteren(bigint)    from public, anon;
revoke all on function public.verkoopfactuur_herinnerd(bigint)     from public, anon, authenticated;
grant execute on function public.verkoopfactuur_betaald(bigint, date) to authenticated;
grant execute on function public.verkoopfactuur_heropenen(bigint)     to authenticated;
grant execute on function public.verkoopfactuur_crediteren(bigint)    to authenticated;


-- De dagelijkse ronde kijkt voortaan ook naar wat er nog binnen moet komen.
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

  -- Eigen facturen die te laat zijn. Drie dagen na de vervaldatum een seintje,
  -- en na een herinnering pas weer na zeven: anders word je elke dag herinnerd
  -- aan iets waar je niks aan kunt doen.
  for r in
    select id from public.verkoopfacturen
     where status = 'verzonden' and vervaldatum is not null and gepusht_op is null
       and case when herinnering_op is null then vervaldatum + 3
                else herinnering_op::date + 7 end < current_date
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'verkoopfacturen', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
