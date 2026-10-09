-- Uitgaande facturen: klanten, prijslijst, facturen en hun regels
--
-- Prijzen staan hier inclusief btw, net als op de kaart. Dat is hoe Sander ze
-- kent en hoe hij ze intypt; de btw wordt eruit gerekend, niet erbij opgeteld.
-- Alles numeric, nooit een kommagetal van de computer: bij geld moet twee cent
-- ook echt twee cent blijven.

-- 1. Klanten -----------------------------------------------------------------

create table if not exists public.klanten (
  id                  bigint generated always as identity primary key,
  naam                text not null,
  contactpersoon      text,
  factuur_email       text,
  cc_email            text,
  adres               text,
  postcode            text,
  plaats              text,
  kvk                 text,
  btw_nummer          text,
  betaaltermijn_dagen int  not null default 14,
  notities            text,
  actief              boolean not null default true,
  aangemaakt_op       timestamptz not null default now()
);

insert into public.klanten (naam, contactpersoon, factuur_email, adres, postcode, plaats)
select * from (values
  ('Woningstichting Het Grootslag', 'Tom Werkhoven', 'factuur@wst-hetgrootslag.nl',
   'Olympiaweg 25',   '1693 EJ', 'Wervershoof'),
  ('Veekro Bedrijfswagens',         'Jacco Bakker',  'factuur@veekro.nl',
   null, null, null),
  ('BENU Apotheek Wervershoof',     'Leonie',        'wervershoof@benu.nl',
   'Olympiaweg 141G', '1693 EK', 'Wervershoof')
) as v(naam, contactpersoon, factuur_email, adres, postcode, plaats)
where not exists (select 1 from public.klanten k where k.naam = v.naam);


-- 2. De prijslijst -----------------------------------------------------------
-- Bewust leeg: prijzen verzinnen we niet, die vult Sander zelf in.

create table if not exists public.producten (
  id           bigint generated always as identity primary key,
  naam         text not null,
  omschrijving text,
  prijs_incl   numeric(10,2) not null,
  btw_tarief   int not null default 9 check (btw_tarief in (0, 9, 21)),
  eenheid      text not null default 'stuk',
  actief       boolean not null default true,
  volgorde     int not null default 0
);


-- 3. De facturen -------------------------------------------------------------

create table if not exists public.verkoopfacturen (
  id                 bigint generated always as identity primary key,
  -- Leeg zolang het een concept is. Een nummer krijg je pas bij versturen,
  -- want een uitgedeeld nummer mag nooit meer verdwijnen.
  nummer             int unique,
  klant_id           bigint not null references public.klanten(id),
  factuurdatum       date,
  vervaldatum        date,
  leverdatum         date,
  periode            text,
  onderwerp          text,
  notitie_op_factuur text,
  interne_notitie    text,
  status             text not null default 'concept'
                     check (status in ('concept','verzonden','betaald','gecrediteerd')),
  -- Alleen door verkoopfactuur_herbereken gevuld, nooit met de hand.
  totaal_excl        numeric(10,2) not null default 0,
  btw_9              numeric(10,2) not null default 0,
  btw_21             numeric(10,2) not null default 0,
  totaal_incl        numeric(10,2) not null default 0,
  pdf_pad            text,
  verzonden_op       timestamptz,
  verzonden_naar     text,
  betaald_op         date,
  herinnering_op     timestamptz,
  gepusht_op         timestamptz,
  credit_van         bigint references public.verkoopfacturen(id),
  aangemaakt_op      timestamptz not null default now(),
  bijgewerkt_op      timestamptz not null default now()
);

create index if not exists verkoopfacturen_openstaand
  on public.verkoopfacturen (vervaldatum) where status = 'verzonden';

create table if not exists public.verkoopfactuur_regels (
  id           bigint generated always as identity primary key,
  factuur_id   bigint not null references public.verkoopfacturen(id) on delete cascade,
  volgorde     int not null default 0,
  product_id   bigint references public.producten(id),
  omschrijving text not null,
  aantal       numeric(10,2) not null default 1,
  prijs_incl   numeric(10,2) not null,
  btw_tarief   int not null default 9 check (btw_tarief in (0, 9, 21))
);

create index if not exists verkoopfactuur_regels_factuur
  on public.verkoopfactuur_regels (factuur_id, volgorde);


-- 4. Toegang -----------------------------------------------------------------
-- Alleen Sander, en schrijven mag rechtstreeks: een concept is van hem. Het
-- nummer uitdelen gaat wel via een functie, zie verderop.

do $$
declare t text;
begin
  foreach t in array array['klanten','producten','verkoopfacturen','verkoopfactuur_regels'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_beheert on public.%I', t);
    execute format(
      'create policy app_beheert on public.%I for all to authenticated
         using (public.is_app_user()) with check (public.is_app_user())', t);
  end loop;
end $$;


-- 8. Instellingen ------------------------------------------------------------

insert into public.instellingen (sleutel, waarde) values
  ('bedrijf', '{"naam":"Boskma Foodservice","handelsnaam":"Snackerie ''t Zonnetje",
                "adres":"Dorpsstraat 82","postcode":"1693 AH","plaats":"Wervershoof",
                "kvk":"42020563","btw":"NL869325826B01","iban":"NL58 RABO 0173 1119 04",
                "email":"sander@boskmafoodservice.nl","telefoon":"","logo":""}'::jsonb),
  -- 1 tot en met 3 zijn buiten de app gemaakt.
  ('factuur_volgend_nummer', '{"nummer": 4}'::jsonb),
  ('basecone_verkoop', '{"adres": "dolfin.mvl03384@mailtobasecone.com"}'::jsonb)
on conflict (sleutel) do nothing;

notify pgrst, 'reload schema';
