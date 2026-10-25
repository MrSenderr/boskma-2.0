-- Digitaal tekenen van een contract.
--
-- Het loonbureau maakt het contract; Sander zet het als document in het
-- dossier. Deze tabel hangt daaraan: wie heeft dát stuk getekend, wanneer, en
-- met welke naam. De getekende PDF die eruit komt is weer een gewoon document
-- in hetzelfde dossier.
--
-- Vier keuzes zitten in de vorm.
--
-- **De controlecode.** Bij het starten wordt de SHA-256 van de PDF vastgelegd.
-- Wie tekent, tekent dát bestand. Zou het document later worden vervangen, dan
-- klopt de code niet meer en weigert de app de getekende versie te maken. Zonder
-- dit kun je achteraf niet laten zien wat er getekend is, alleen dát er
-- getekend is.
--
-- **Naam verplicht, krabbel niet.** De naam voluit typen met een bevestiging is
-- wat telt. De krabbel met de vinger zet je erbij als je op een telefoon zit; op
-- een laptop met een muis wordt dat een hanenpoot. Een verplicht vakje dat niet
-- wil is een medewerker die niet tekent.
--
-- **De medewerker eerst.** Sander tekent mee met wat de medewerker heeft
-- getekend, niet andersom. De constraint houdt die volgorde vast: anders staat
-- er een contract dat de werkgever heeft getekend en de medewerker niet, en dat
-- is geen contract maar een aanbod.
--
-- **Ruimte voor een ouder.** Bij iemand onder de 18 komt er een derde vak. Of
-- het moet is nog niet uitgezocht; daarom wel een plek en geen verplichting.
-- Later verplicht maken is één regel, achteraf laten hertekenen is een ronde
-- langs alle jongeren.

create table public.ondertekeningen (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.sollicitaties(id) on delete cascade,
  -- Het contract dat getekend wordt.
  document_id bigint not null references public.dossier_documenten(id) on delete cascade,
  -- Het voorstel waar dit contract uit volgde, voor zover bekend.
  voorstel_id uuid references public.contractvoorstellen(id) on delete set null,

  origineel_sha256 text not null,
  origineel_naam text not null,

  /* Alleen een aanwijzing voor het scherm: laat het vak voor een ouder zien.
     Tekenen kan ook zonder. */
  ouder_nodig boolean not null default false,

  gestart_op timestamptz not null default now(),
  gestart_door text,
  verstuurd_op timestamptz,
  geopend_op timestamptz,

  medewerker_naam text,
  /* De krabbel als PNG in een data-URL. In de rij en niet in de opslag: een
     handtekening hoort bij de ondertekening en niet in een map waar hij los
     van zijn context kan rondzwerven. */
  medewerker_krabbel text,
  medewerker_op timestamptz,

  ouder_naam text,
  ouder_relatie text,
  ouder_krabbel text,
  ouder_op timestamptz,

  werkgever_naam text,
  werkgever_krabbel text,
  werkgever_op timestamptz,

  -- De getekende PDF, zodra die gemaakt is.
  getekend_document_id bigint references public.dossier_documenten(id) on delete set null,
  afgerond_op timestamptz,

  ingetrokken_op timestamptz,
  ingetrokken_reden text,

  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),

  constraint werkgever_tekent_mee check (
    werkgever_op is null or medewerker_op is not null
  ),
  constraint naam_bij_handtekening check (
    (medewerker_op is null) = (nullif(trim(coalesce(medewerker_naam, '')), '') is null)
  )
);

comment on table public.ondertekeningen is
  'Wie heeft welk contract digitaal getekend. De getekende PDF staat als document in dossier_documenten.';
comment on column public.ondertekeningen.origineel_sha256 is
  'SHA-256 van de PDF op het moment van starten. Klopt die later niet meer, dan is er een ander stuk getekend dan gelezen.';

create index ondertekeningen_per_medewerker
  on public.ondertekeningen (medewerker_id, gestart_op desc);
create index ondertekeningen_per_document
  on public.ondertekeningen (document_id);

alter table public.ondertekeningen enable row level security;
revoke all on public.ondertekeningen from anon;

create policy app_gebruiker on public.ondertekeningen
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

/* De medewerker ziet alleen wat hem is voorgelegd, en mag het niet wijzigen.
   Tekenen gaat via een functie die alleen de handtekeningvelden aanraakt. */
create policy eigen_ondertekening on public.ondertekeningen
  for select to authenticated
  using (
    medewerker_id = public.huidige_medewerker()
    and verstuurd_op is not null
    and ingetrokken_op is null
  );

/* Openen vastleggen, één keer. Dit is geen handtekening: het is het spoor dat
   hij het stuk heeft opengeslagen. */
create or replace function public.ondertekening_geopend(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mij uuid := public.huidige_medewerker();
begin
  if mij is null then raise exception 'geen toegang'; end if;

  update public.ondertekeningen
     set geopend_op = now()
   where id = p_id
     and medewerker_id = mij
     and verstuurd_op is not null
     and ingetrokken_op is null
     and geopend_op is null;
end;
$$;

/* Tekenen.
 *
 * Eén keer. Een handtekening die je kunt overschrijven is geen handtekening,
 * en met een tweede poging zou je de datum kunnen verzetten. Is er iets mis,
 * dan trekt Sander de ondertekening in en begint hij opnieuw — dan staat er in
 * het dossier dat dat is gebeurd.
 *
 * De krabbel is optioneel maar wordt wel nagekeken: alleen een PNG uit het
 * tekenvak, en niet groter dan een handtekening hoort te zijn. */
create or replace function public.ondertekening_tekenen(
  p_id uuid,
  p_naam text,
  p_krabbel text default null,
  p_ouder_naam text default null,
  p_ouder_relatie text default null,
  p_ouder_krabbel text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mij  uuid := public.huidige_medewerker();
  naam text := nullif(trim(coalesce(p_naam, '')), '');
  o_naam text := nullif(trim(coalesce(p_ouder_naam, '')), '');
  nu   timestamptz := now();
  rij  public.ondertekeningen;
begin
  if mij is null then raise exception 'geen toegang'; end if;
  if naam is null or length(naam) < 2 then
    raise exception 'vul je naam voluit in';
  end if;

  select * into rij
    from public.ondertekeningen
   where id = p_id
     and medewerker_id = mij
     and verstuurd_op is not null
     and ingetrokken_op is null;
  if not found then raise exception 'niets te tekenen'; end if;
  if rij.medewerker_op is not null then raise exception 'dit is al getekend'; end if;

  if p_krabbel is not null and p_krabbel <> '' then
    if p_krabbel not like 'data:image/png;base64,%' then
      raise exception 'de handtekening kwam niet uit het tekenvak';
    end if;
    if length(p_krabbel) > 400000 then
      raise exception 'de handtekening is te groot';
    end if;
  end if;
  if p_ouder_krabbel is not null and p_ouder_krabbel <> '' then
    if p_ouder_krabbel not like 'data:image/png;base64,%' then
      raise exception 'de handtekening kwam niet uit het tekenvak';
    end if;
    if length(p_ouder_krabbel) > 400000 then
      raise exception 'de handtekening is te groot';
    end if;
  end if;

  update public.ondertekeningen
     set medewerker_naam    = naam,
         medewerker_krabbel = nullif(p_krabbel, ''),
         medewerker_op      = nu,
         ouder_naam         = o_naam,
         ouder_relatie      = case when o_naam is null then null
                                   else nullif(trim(coalesce(p_ouder_relatie, '')), '') end,
         ouder_krabbel      = case when o_naam is null then null
                                   else nullif(p_ouder_krabbel, '') end,
         ouder_op           = case when o_naam is null then null else nu end,
         geopend_op         = coalesce(geopend_op, nu),
         bijgewerkt_op      = nu
   where id = p_id;
end;
$$;

revoke all on function public.ondertekening_geopend(uuid) from public;
revoke all on function public.ondertekening_tekenen(uuid, text, text, text, text, text) from public;
grant execute on function public.ondertekening_geopend(uuid) to authenticated;
grant execute on function public.ondertekening_tekenen(uuid, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
