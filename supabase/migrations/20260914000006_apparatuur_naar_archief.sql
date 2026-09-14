-- De apparatuurmodule eruit.
--
-- De metingen van de koel- en vriescellen komen in een andere vorm terug; tot
-- die tijd hoeft de app ze niet te kennen. Zes apparaten en zesenvijftig
-- metingen gaan naar archief, net als de rest.
--
-- medewerker_verborgen gaat mee: dat hield bij welke menu-onderdelen je voor
-- iemand verbergt, en `temperaturen` was het laatste onderdeel dat er nog in
-- kon staan. Zonder onderdelen is er niets meer te verbergen.
--
-- Zelfde controle als bij de vorige opruiming: klopt het aantal rijen in de
-- kopie niet, dan verdwijnt er niets.

do $$
declare
  t          text;
  in_public  bigint;
  in_archief bigint;
  namen      text[] := array['haccp_apparaten', 'haccp_temps', 'medewerker_verborgen'];
begin
  foreach t in array namen loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'stond al niet meer in public: %', t;
      continue;
    end if;

    execute format('drop table if exists archief.%I', t);
    execute format('create table archief.%I as table public.%I', t, t);

    execute format('select count(*) from public.%I', t) into in_public;
    execute format('select count(*) from archief.%I', t) into in_archief;
    if in_public <> in_archief then
      raise exception 'aantallen verschillen voor %: public %, archief % — niets gedropt',
        t, in_public, in_archief;
    end if;

    execute format('drop table public.%I cascade', t);
  end loop;
end $$;
