-- Contractvoorstellen: verlengen, stoppen of vaste uren aanbieden.
--
-- Wat hier staat is wat er is aangeboden, niet wat er is afgesproken. Het
-- afgesproken contract komt in public.contracten te staan zodra het getekend
-- is. Dat onderscheid is het halve punt van deze tabel: bij een geschil moet
-- je kunnen laten zien wat je wanneer hebt aangeboden, ook als er uiteindelijk
-- iets anders of niets uitkwam.
--
-- Drie keuzes zitten in de vorm.
--
-- **Twee losse antwoorden.** Een verlenging en een aanbod vaste uren kunnen in
-- één voorstel zitten, maar de medewerker mag vaste uren weigeren (art. 7:628a
-- lid 5 BW) terwijl een verlenging een andere afspraak is. Eén ja of nee op
-- het geheel zou betekenen dat wie de uren afwijst ook de verlenging afwijst,
-- en dat is niet wat er bedoeld wordt.
--
-- **Intrekken in plaats van wijzigen.** Bedenk je je, dan blijft het oude
-- voorstel staan met de datum waarop het is ingetrokken, en komt er een nieuw
-- voorstel naast. Een voorstel aanpassen ná verzending zou de tijdstippen van
-- verstuurd en geopend laten slaan op een tekst die er toen niet stond.
--
-- **Elk moment apart vastgelegd.** Verstuurd, geopend, ontvangst bevestigd,
-- beantwoord. Digitaal aanzeggen mag als de ontvangst te bewijzen is, en dat
-- bewijs is deze reeks tijdstippen.

create table public.contractvoorstellen (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.sollicitaties(id) on delete cascade,
  -- Het contract dat hiermee afloopt of wordt opgevolgd.
  vorig_contract_id uuid references public.contracten(id) on delete set null,

  aard text not null check (
    aard in ('verlengen', 'stoppen', 'vaste_uren', 'verlengen_en_vaste_uren')
  ),

  -- Wat er wordt aangeboden. Leeg bij stoppen.
  soort text check (soort in ('nuluren', 'min_max', 'vaste_uren', 'bandbreedte')),
  duur text check (duur in ('bepaalde', 'onbepaalde')),
  begint date,
  eindigt date,
  uren_vast numeric(5,2),
  uren_min numeric(5,2),
  uren_max numeric(5,2),
  uurloon numeric(10,4),
  functie text,

  /* Bij een aanbod vaste uren: het gemiddelde waarop het gebaseerd is, zoals
     het op dat moment berekend was. Vastleggen en niet later opnieuw rekenen —
     anders verandert de onderbouwing van een aanbod dat al verstuurd is. */
  gemiddelde_uren numeric(5,2),

  -- Wanneer het antwoord binnen moet zijn: de aanzegdatum, of een maand na de
  -- twaalf maanden oproep.
  uiterlijk date,
  toelichting text,

  opgesteld_op timestamptz not null default now(),
  opgesteld_door text,
  verstuurd_op timestamptz,
  verstuurd_naar text,
  geopend_op timestamptz,
  ontvangst_bevestigd_op timestamptz,

  keuze_verlenging text check (keuze_verlenging in ('akkoord', 'niet_akkoord')),
  keuze_verlenging_op timestamptz,
  keuze_vaste_uren text check (keuze_vaste_uren in ('aangenomen', 'geweigerd')),
  keuze_vaste_uren_op timestamptz,
  reactie text,

  ingetrokken_op timestamptz,
  ingetrokken_reden text,

  naar_loonbureau_op timestamptz,
  -- Het contract dat er uiteindelijk uit kwam.
  contract_id uuid references public.contracten(id) on delete set null,

  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),

  constraint einde_na_begin check (eindigt is null or begint is null or eindigt >= begint),
  constraint onbepaalde_heeft_geen_einde check (duur is distinct from 'onbepaalde' or eindigt is null),
  constraint stoppen_biedt_niets_aan check (aard <> 'stoppen' or (soort is null and duur is null))
);

comment on table public.contractvoorstellen is
  'Wat er is aangeboden: verlengen, stoppen of vaste uren. Het afgesproken contract staat in public.contracten.';

create index contractvoorstellen_per_medewerker
  on public.contractvoorstellen (medewerker_id, opgesteld_op desc);

alter table public.contractvoorstellen enable row level security;
revoke all on public.contractvoorstellen from anon;

create policy app_gebruiker on public.contractvoorstellen
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

/* De medewerker mag zijn eigen voorstel lezen, maar niet wijzigen. Antwoorden
   gaat straks via een functie die alleen de antwoordvelden aanraakt; met een
   gewoon schrijfrecht zou hij ook de aangeboden uren kunnen veranderen.

   Alleen wat verstuurd is en niet is ingetrokken: een concept is nog van
   Sander alleen. */
create policy eigen_voorstel on public.contractvoorstellen
  for select to authenticated
  using (
    medewerker_id = public.huidige_medewerker()
    and verstuurd_op is not null
    and ingetrokken_op is null
  );

notify pgrst, 'reload schema';
