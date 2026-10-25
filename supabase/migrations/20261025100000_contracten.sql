-- De contractgeschiedenis per medewerker.
--
-- Tot nu toe stond er één contract plat op de persoonskaart: contracttype,
-- ingangsdatum, einddatum, uren, loon. Dat werkt zolang iemand één contract
-- heeft, maar drie dingen zijn niet uit te rekenen zonder de geschiedenis:
--
--   - de ketenregeling (hoeveelste contract, en of er een pauze van meer dan
--     zes maanden tussen zat die de telling reset)
--   - de twaalf maanden oproep, die bij een overgenomen medewerker al begon
--     bij de vorige eigenaar
--   - aanzeggen, dat per contract geldt en niet per persoon
--
-- Vanaf hier is deze tabel de waarheid. De persoonskaart leest het lopende
-- contract uit de view huidig_contract; zie de migratie daarna.
--
-- Contracten bij Kai staan er ook in. Bij een overname telt de tijd bij de
-- vorige eigenaar mee voor de keten (opvolgend werkgeverschap), maar het is
-- wel een ander contract bij een andere werkgever — vandaar de kolom.

create table public.contracten (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.sollicitaties(id) on delete cascade,

  werkgever text not null default 'boskma' check (werkgever in ('boskma', 'kai')),

  /* De vorm van het contract. Sleutelwoorden en geen nette namen: die staan in
     de app (SOORTNAAM), zodat een andere formulering op het scherm niet
     betekent dat er in de database iets verandert.

     'bandbreedte' bestaat nog niet maar komt per 1 januari 2028 in de plaats
     van nuluren. Hij staat er nu al in, zodat er dan niets te verbouwen valt. */
  soort text not null check (soort in ('nuluren', 'min_max', 'vaste_uren', 'bandbreedte')),
  duur text not null check (duur in ('bepaalde', 'onbepaalde')),

  begint date not null,
  eindigt date,

  /* Eén set urenvelden voor alle vormen; `soort` zegt welke gelden. Een
     bandbreedtecontract is min plus max, dus die past hier vanzelf in.

     Met opzet géén controle op de verhouding tussen min en max. Vanaf 2028 mag
     het maximum hoogstens dertig procent boven het minimum liggen, maar
     Maartje heeft nu 10/40 en dat is vandaag gewoon geldig. Een regel uit de
     toekomst hoort het verleden niet ongeldig te maken. */
  uren_vast numeric(5,2) check (uren_vast is null or uren_vast > 0),
  uren_min numeric(5,2) check (uren_min is null or uren_min >= 0),
  uren_max numeric(5,2) check (uren_max is null or uren_max > 0),

  uurloon numeric(10,4) check (uurloon is null or uurloon >= 0),
  functie text,
  proefperiode boolean,

  -- Als het anders afliep dan op de einddatum: opgezegd, met wederzijds
  -- goedvinden, tijdens de proeftijd.
  beeindigd_op date,
  beeindigd_reden text,

  -- Het contract zelf, als het in het dossier staat.
  document_id bigint references public.dossier_documenten(id) on delete set null,
  bron text not null default 'handmatig' check (bron in ('handmatig', 'overgenomen', 'voorstel')),
  opmerking text,

  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),

  -- Een contract voor onbepaalde tijd heeft geen einddatum. Staat er toch een,
  -- dan is er iets door elkaar gehaald en dat wil je meteen weten.
  constraint onbepaalde_heeft_geen_einde check (duur = 'bepaalde' or eindigt is null),
  constraint einde_na_begin check (eindigt is null or eindigt >= begint),
  constraint max_niet_onder_min check (uren_min is null or uren_max is null or uren_max >= uren_min)
);

comment on table public.contracten is
  'Alle contracten per medewerker, ook die bij de vorige eigenaar. Basis voor ketenregeling, aanzeggen en het aanbod vaste uren.';

create index contracten_per_medewerker on public.contracten (medewerker_id, begint desc);

alter table public.contracten enable row level security;
revoke all on public.contracten from anon;

create policy app_gebruiker on public.contracten
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

-- Je eigen contracten mag je zien; die van een ander niet. Nodig voor stap 5
-- en 7, als de medewerker zijn voorstel en zijn contract in de app krijgt.
create policy eigen_contracten on public.contracten
  for select to authenticated
  using (medewerker_id = public.huidige_medewerker());

notify pgrst, 'reload schema';
