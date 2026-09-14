-- De opruiming van 14 september 2026.
--
-- Alles wat in `archief` staat gaat hier uit `public`. Per tabel wordt eerst
-- geteld: wijkt het aantal rijen af van de kopie, dan stopt het hele blok en
-- verdwijnt er niets. Een DROP die je niet kunt terugdraaien hoort een controle
-- te hebben die dat wel kan.
--
-- Terugzetten van een tabel:
--   create table public.x as table archief.x;
-- Daarna wel de policies en indexen opnieuw zetten; die gaan hier mee weg.

do $$
declare
  t          text;
  in_public  bigint;
  in_archief bigint;
  weg        int := 0;
  rijen      bigint := 0;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'archief' and c.relkind = 'r'
    order by c.relname
  loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'stond al niet meer in public: %', t;
      continue;
    end if;

    execute format('select count(*) from public.%I', t) into in_public;
    execute format('select count(*) from archief.%I', t) into in_archief;

    if in_public <> in_archief then
      raise exception 'aantallen verschillen voor %: public heeft %, archief heeft % — niets gedropt',
        t, in_public, in_archief;
    end if;

    execute format('drop table public.%I cascade', t);
    weg := weg + 1;
    rijen := rijen + in_archief;
  end loop;

  raise notice 'gedropt: % tabellen, % rijen (allemaal bewaard in archief)', weg, rijen;
end $$;

-- De zichtbaarheidslijst kende negen onderdelen; er is er nog een over.
-- Regels die verwijzen naar mep, werkkaarten, recepten en de rest slaan nergens
-- meer op.
delete from public.medewerker_verborgen where onderdeel <> 'temperaturen';
