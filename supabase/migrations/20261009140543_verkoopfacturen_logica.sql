-- Uitgaande facturen: het rekenwerk, de sloten en de historie
--
-- Hoort bij 20261009140510_verkoopfacturen_tabellen; apart toegepast en
-- daarom een apart bestand.

-- 5. De btw eruit rekenen ----------------------------------------------------
--
-- Een prijs van 6,02 inclusief 9% is 5,52 exclusief en 0,50 btw. Per tarief
-- optellen en dan pas afronden: anders loopt een factuur van 75 regels een paar
-- cent uit de pas met wat de klant optelt.

create or replace function public.verkoopfactuur_herbereken(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_incl_9  numeric(12,4) := 0;
  v_incl_21 numeric(12,4) := 0;
  v_incl_0  numeric(12,4) := 0;
  v_btw_9   numeric(10,2);
  v_btw_21  numeric(10,2);
  v_incl    numeric(10,2);
begin
  select
    coalesce(sum(round(aantal * prijs_incl, 2)) filter (where btw_tarief = 9), 0),
    coalesce(sum(round(aantal * prijs_incl, 2)) filter (where btw_tarief = 21), 0),
    coalesce(sum(round(aantal * prijs_incl, 2)) filter (where btw_tarief = 0), 0)
    into v_incl_9, v_incl_21, v_incl_0
    from public.verkoopfactuur_regels where factuur_id = p_id;

  v_btw_9  := round(v_incl_9  *  9 / 109, 2);
  v_btw_21 := round(v_incl_21 * 21 / 121, 2);
  v_incl   := round(v_incl_9 + v_incl_21 + v_incl_0, 2);

  update public.verkoopfacturen
     set btw_9       = v_btw_9,
         btw_21      = v_btw_21,
         totaal_incl = v_incl,
         totaal_excl = v_incl - v_btw_9 - v_btw_21,
         bijgewerkt_op = now()
   where id = p_id;
end $$;

create or replace function public.verkoopfactuur_regel_gewijzigd()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.verkoopfactuur_herbereken(coalesce(new.factuur_id, old.factuur_id));
  return coalesce(new, old);
end $$;

drop trigger if exists verkoopfactuur_regel_gewijzigd on public.verkoopfactuur_regels;
create trigger verkoopfactuur_regel_gewijzigd
  after insert or update or delete on public.verkoopfactuur_regels
  for each row execute function public.verkoopfactuur_regel_gewijzigd();


-- 6. Een factuur met een nummer ligt vast ------------------------------------
--
-- Nummers moeten doorlopen zonder gaten, en wat de klant heeft gekregen mag
-- daarna niet meer veranderen. Corrigeren doe je met een creditfactuur.
-- Wat wél mag: bijhouden wat er met de factuur gebeurt — verstuurd, betaald,
-- herinnerd — en de interne notitie.

create or replace function public.verkoopfactuur_vastgezet()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.nummer is not null then
      raise exception 'factuur % heeft een nummer en kan niet verwijderd worden; maak een creditfactuur', old.nummer;
    end if;
    return old;
  end if;

  if old.nummer is not null and (
       new.nummer            is distinct from old.nummer            or
       new.klant_id          is distinct from old.klant_id          or
       new.factuurdatum      is distinct from old.factuurdatum      or
       new.vervaldatum       is distinct from old.vervaldatum       or
       new.leverdatum        is distinct from old.leverdatum        or
       new.periode           is distinct from old.periode           or
       new.onderwerp         is distinct from old.onderwerp         or
       new.notitie_op_factuur is distinct from old.notitie_op_factuur or
       new.credit_van        is distinct from old.credit_van        or
       new.totaal_incl       is distinct from old.totaal_incl       or
       new.totaal_excl       is distinct from old.totaal_excl       or
       new.btw_9             is distinct from old.btw_9             or
       new.btw_21            is distinct from old.btw_21)
  then
    raise exception 'factuur % is verstuurd en kan niet meer gewijzigd worden; maak een creditfactuur', old.nummer;
  end if;
  return new;
end $$;

drop trigger if exists verkoopfactuur_vastgezet on public.verkoopfacturen;
create trigger verkoopfactuur_vastgezet
  before update or delete on public.verkoopfacturen
  for each row execute function public.verkoopfactuur_vastgezet();

create or replace function public.verkoopfactuur_regel_vast()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nummer int;
begin
  select nummer into v_nummer from public.verkoopfacturen
   where id = coalesce(new.factuur_id, old.factuur_id);
  -- Bij het weggooien van een hele concept-factuur mogen de regels mee.
  if v_nummer is not null then
    raise exception 'factuur % is verstuurd; de regels liggen vast', v_nummer;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists verkoopfactuur_regel_vast on public.verkoopfactuur_regels;
create trigger verkoopfactuur_regel_vast
  before insert or update or delete on public.verkoopfactuur_regels
  for each row execute function public.verkoopfactuur_regel_vast();


-- 7. Het nummer uitdelen -----------------------------------------------------

create or replace function public.verkoopfactuur_definitief(p_id bigint)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_nummer  int;
  v_termijn int;
  v_datum   date;
  v_bestaand int;
begin
  if not public.is_app_user() then raise exception 'geen toegang'; end if;

  select nummer into v_bestaand from public.verkoopfacturen where id = p_id;
  if not found then raise exception 'factuur % bestaat niet', p_id; end if;
  -- Opnieuw proberen na een mislukte verzending mag geen tweede nummer kosten.
  if v_bestaand is not null then return v_bestaand; end if;

  -- for update: twee tegelijk zou hetzelfde nummer opleveren, en dan heb je een
  -- gat of een dubbele in je boekhouding.
  select (waarde ->> 'nummer')::int into v_nummer
    from public.instellingen where sleutel = 'factuur_volgend_nummer' for update;
  if v_nummer is null then raise exception 'factuur_volgend_nummer ontbreekt'; end if;

  update public.instellingen
     set waarde = jsonb_build_object('nummer', v_nummer + 1), bijgewerkt_op = now()
   where sleutel = 'factuur_volgend_nummer';

  select coalesce(k.betaaltermijn_dagen, 14) into v_termijn
    from public.verkoopfacturen f join public.klanten k on k.id = f.klant_id
   where f.id = p_id;

  select coalesce(factuurdatum, current_date) into v_datum
    from public.verkoopfacturen where id = p_id;

  update public.verkoopfacturen
     set nummer = v_nummer, factuurdatum = v_datum,
         vervaldatum = v_datum + v_termijn, bijgewerkt_op = now()
   where id = p_id;

  return v_nummer;
end $$;

revoke all on function public.verkoopfactuur_definitief(bigint) from public, anon;
revoke all on function public.verkoopfactuur_herbereken(bigint) from public, anon;
grant execute on function public.verkoopfactuur_definitief(bigint) to authenticated;


-- 9. De drie facturen van vóór de app ----------------------------------------
-- Zonder regels; of ze betaald zijn weten we niet, dat zet Sander zelf.

insert into public.verkoopfacturen
  (nummer, klant_id, factuurdatum, vervaldatum, status, totaal_incl, interne_notitie)
select v.nummer, k.id, v.datum, v.datum + k.betaaltermijn_dagen, 'verzonden',
       v.bedrag, v.notitie
  from (values
    -- Van Veekro is het bedrag niet bekend; 0 is hier geen nul euro maar een
    -- leeg veld, en dat moet je kunnen lezen.
    (1, 'Veekro Bedrijfswagens',         date '2026-09-30', 0::numeric(10,2),
        'Gemaakt buiten de app, bedrag onbekend'),
    (2, 'BENU Apotheek Wervershoof',     date '2026-09-30', 78.50,
        'Gemaakt buiten de app'),
    (3, 'Woningstichting Het Grootslag', date '2026-09-30', 451.25,
        'Gemaakt buiten de app')
  ) as v(nummer, klant, datum, bedrag, notitie)
  join public.klanten k on k.naam = v.klant
 where not exists (select 1 from public.verkoopfacturen f where f.nummer = v.nummer);

notify pgrst, 'reload schema';
