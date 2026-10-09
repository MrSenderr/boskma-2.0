-- Het schriftje laten lezen
--
-- leverancier_betaalwijze werd wel gevuld maar door niemand geraadpleegd: een
-- nieuwe factuur van dezelfde leverancier kwam elke maand opnieuw bij "nog
-- uitzoeken". Nu vult een factuur zichzelf in zodra de leverancier bekend is.
--
-- Alleen bij bevestigd = true. De rest is afgeleid uit de mails en daar zit
-- minstens een twijfelgeval tussen; een gok mag geen betaalwijze worden zonder
-- dat Sander hem heeft gezien.

create or replace function public.factuur_betaalwijze_invullen()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_wijze text;
begin
  if new.betaalwijze <> 'onbekend' then return new; end if;

  select b.betaalwijze into v_wijze
    from public.leverancier_betaalwijze b
   where lower(b.leverancier) = lower(new.leverancier)
     and b.bevestigd
     and b.betaalwijze <> 'onbekend'
   limit 1;

  if v_wijze is not null then new.betaalwijze := v_wijze; end if;
  return new;
end $$;

drop trigger if exists factuur_betaalwijze_invullen on public.facturen;
create trigger factuur_betaalwijze_invullen
  before insert on public.facturen
  for each row execute function public.factuur_betaalwijze_invullen();


-- De lijst met leveranciers ---------------------------------------------------
--
-- Iedereen van wie ooit een factuur binnenkwam, met wat er over hem bekend is.
-- Als functie, want dit is een samenvoeging van twee tabellen en die kan de app
-- niet in een keer opvragen.

create or replace function public.leveranciers_overzicht()
returns table (
  leverancier   text,
  betaalwijze   text,
  bevestigd     boolean,
  opmerking     text,
  aantal        bigint,
  aantal_open   bigint,
  laatste       date
)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(f.leverancier, b.leverancier)                 as leverancier,
    b.betaalwijze,
    coalesce(b.bevestigd, false)                           as bevestigd,
    b.opmerking,
    count(f.id)                                            as aantal,
    count(f.id) filter (where f.status = 'open')           as aantal_open,
    max(f.factuurdatum)                                    as laatste
  from public.facturen f
  full join public.leverancier_betaalwijze b
         on lower(b.leverancier) = lower(f.leverancier)
  where public.is_app_user()
  group by coalesce(f.leverancier, b.leverancier), b.betaalwijze, b.bevestigd, b.opmerking
  order by 1;
$$;

-- Vastleggen hoe een leverancier betaalt, en meteen de openstaande facturen van
-- die leverancier bijwerken die nog op onbekend stonden. Wat Sander al een keer
-- met de hand heeft gezet blijft staan.
create or replace function public.leverancier_betaalwijze_zetten(
  p_leverancier text, p_betaalwijze text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_geraakt int;
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;
  if p_betaalwijze not in ('incasso','handmatig','vooraf_betaald') then
    raise exception 'onbekende betaalwijze';
  end if;

  update public.leverancier_betaalwijze
     set betaalwijze = p_betaalwijze, bevestigd = true,
         opmerking = 'Door Sander gezet in de app', bijgewerkt_op = now()
   where lower(leverancier) = lower(p_leverancier);
  get diagnostics v_geraakt = row_count;

  if v_geraakt = 0 then
    insert into public.leverancier_betaalwijze (leverancier, betaalwijze, bevestigd, opmerking)
    values (p_leverancier, p_betaalwijze, true, 'Door Sander gezet in de app');
  end if;

  update public.facturen
     set betaalwijze = p_betaalwijze, bijgewerkt_op = now()
   where lower(leverancier) = lower(p_leverancier)
     and status = 'open' and betaalwijze = 'onbekend';
end $$;

revoke all on function public.leveranciers_overzicht()                        from public, anon;
revoke all on function public.leverancier_betaalwijze_zetten(text, text)      from public, anon;
grant execute on function public.leveranciers_overzicht()                     to authenticated;
grant execute on function public.leverancier_betaalwijze_zetten(text, text)   to authenticated;

notify pgrst, 'reload schema';
