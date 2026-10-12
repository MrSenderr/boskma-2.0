-- De werkplekken van de avondspits, en wie waar staat.
--
-- Vrijdag t/m zondag van 17 tot 20 draait de zaak op zes plekken. Snackbakker
-- is er twee, dus het zijn zeven paar handen. Wie waar het beste staat zat tot
-- nu toe alleen in Sanders hoofd; dat werkt zolang hij er zelf is.
--
-- Twee tabellen: de plekken zelf, en per medewerker per plek hoe goed het
-- gaat. Het indelen zelf gebeurt in de app (src/lib/spits.ts) — dat is rekenen
-- met voorkeuren, geen databasewerk.

create table public.werkplekken (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique check (char_length(trim(naam)) between 2 and 40),
  -- Hoeveel mensen hier tegelijk staan. Bij snackbakker twee.
  aantal smallint not null default 1 check (aantal between 1 and 6),
  -- Hoe hard deze plek bezet moet zijn, 1 tot 10. Staan er te weinig mensen,
  -- dan vult de app van hoog naar laag: de kassa kun je niet leeg laten, de
  -- keukenhulp wel. De tweede man op een plek weegt één punt lichter dan de
  -- eerste, zodat een tweede snackbakker niet vóór de chef gaat.
  belang smallint not null default 5 check (belang between 1 and 10),
  volgorde smallint not null default 0,
  actief boolean not null default true,
  aangemaakt_op timestamptz not null default now()
);
comment on table public.werkplekken is 'Werkplekken in de avondspits (17-20). Belang bepaalt welke plek het eerst bezet wordt als er te weinig volk is.';

insert into public.werkplekken (naam, aantal, belang, volgorde) values
  ('Kassa',        1, 10, 1),
  ('Patatbakker',  1,  9, 2),
  ('Snackbakker',  2,  8, 3),
  ('Chef keuken',  1,  7, 4),
  ('Runner',       1,  5, 5),
  ('Keukenhulp',   1,  3, 6);

create table public.medewerker_werkplek (
  medewerker_id uuid not null references public.sollicitaties(id) on delete cascade,
  werkplek_id uuid not null references public.werkplekken(id) on delete cascade,
  -- liefst: hier staat hij het liefst en het best
  -- kan:    gaat goed
  -- nood:   alleen als het niet anders kan
  -- nooit:  harde grens, de app zet hem er nooit
  -- Geen regel betekent: nog niet beoordeeld. Dat is iets anders dan 'nood' —
  -- de app mag het, maar zegt erbij dat het een gok is.
  niveau text not null check (niveau in ('liefst','kan','nood','nooit')),
  gezet_op timestamptz not null default now(),
  primary key (medewerker_id, werkplek_id)
);
comment on table public.medewerker_werkplek is 'Per medewerker per werkplek hoe goed het gaat. Ingevuld door Sander, niet door de medewerker zelf: dit is een beoordeling, geen wens.';

alter table public.werkplekken enable row level security;
alter table public.medewerker_werkplek enable row level security;

revoke all on public.werkplekken from anon;
revoke all on public.medewerker_werkplek from anon;

create policy app_gebruiker on public.werkplekken
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

create policy app_gebruiker on public.medewerker_werkplek
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

-- Een medewerker moet de naam van zijn plek kunnen zien ("jij staat op de
-- kassa"). De plekken zelf zijn daarvoor nodig; wat anderen kunnen niet.
create policy plekken_lezen on public.werkplekken
  for select to authenticated
  using (public.huidige_medewerker() is not null);

create policy eigen_niveaus on public.medewerker_werkplek
  for select to authenticated
  using (medewerker_id = public.huidige_medewerker());

notify pgrst, 'reload schema';
