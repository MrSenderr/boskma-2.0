-- De vastgelegde indeling van een avondspits.
--
-- De app rekent een voorstel uit; dit is wat Sander er daadwerkelijk van
-- gemaakt heeft. Dat onderscheid is het halve punt: een voorstel dat nergens
-- blijft staan is een rekenmachine die niemand gelooft.
--
-- Het is ook het geheugen voor afwisseling. Wie vier keer achter elkaar runner
-- was staat hier vier keer als runner, en daar kan de volgende indeling op
-- letten.
--
-- Een plek zonder regel is onbezet. Dat is een geldige uitkomst — zijn er maar
-- vijf mensen, dan blijven er twee plekken leeg — en we zetten er liever niets
-- dan een lege regel voor neer.

create table public.spits_indeling (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  werkplek_id uuid not null references public.werkplekken(id) on delete cascade,
  -- Welke van de plekken: snackbakker heeft een 1 en een 2.
  plek smallint not null default 1 check (plek between 1 and 6),
  medewerker_id uuid not null references public.sollicitaties(id) on delete cascade,
  vastgezet_op timestamptz not null default now(),
  vastgezet_door text,
  unique (datum, werkplek_id, plek)
);
comment on table public.spits_indeling is 'Wie waar stond in de avondspits. Vastgelegd door Sander; tevens het geheugen voor afwisseling.';

-- Twee keer dezelfde persoon op één avond is altijd een fout: je staat niet
-- tegelijk op de kassa en in de keuken.
create unique index spits_indeling_een_plek_per_persoon
  on public.spits_indeling (datum, medewerker_id);

create index spits_indeling_op_datum on public.spits_indeling (datum desc);

alter table public.spits_indeling enable row level security;
revoke all on public.spits_indeling from anon;

create policy app_gebruiker on public.spits_indeling
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

-- Alleen je eigen plek, zoals bij de shifts: een medewerker ziet zijn eigen
-- rooster, niet dat van de rest.
create policy eigen_plek on public.spits_indeling
  for select to authenticated
  using (medewerker_id = public.huidige_medewerker());

notify pgrst, 'reload schema';
