-- Een testmedewerker om mee te oefenen.
--
-- Aanleiding: contractvoorstellen, tekenen en het verzoek aan het loonbureau
-- zijn gebouwd, maar niet te proberen zonder op een echte medewerker post te
-- versturen. Op productie oefenen met een echt mens is geen oefenen.
--
-- Het vlaggetje is_test staat op de kaart, niet in een aparte tabel. Wie hier
-- komt zoeken moet in één oogopslag zien dat deze rij geen mens is, en een
-- aparte tabel zou betekenen dat elk scherm twee bronnen moet raadplegen.
--
-- Waar hij buiten blijft: de seintjes op het startscherm, de rooster- en
-- spitslijsten, de vaste dagen, en de lijstjes rond het loonbureau. Een
-- oefening mag geen maandenlange ruis op het startscherm opleveren. Waar hij
-- wél staat: de personeelslijst, met een label, want anders kun je hem niet
-- openen.
--
-- Het mailadres is een plus-adres van Sanders eigen Gmail. Post komt dus in
-- zijn eigen postvak, maar het is een ander adres dan zijn inlog — en daardoor
-- kan hij er in een privévenster mee inloggen en de medewerkerkant zien zoals
-- een medewerker hem ziet.
--
-- Weghalen is één regel: delete from sollicitaties where is_test. Alles wat
-- eraan hangt (contracten, voorstellen, ondertekeningen, documenten) gaat met
-- de cascades mee.

alter table public.sollicitaties
  add column if not exists is_test boolean not null default false;

comment on column public.sollicitaties.is_test is
  'Geen mens maar een oefenkaart. Blijft buiten seintjes, rooster en loonbureaulijsten; staat wel in de personeelslijst.';

/* De namenlijst voor /vastedagen: een oefenkaart hoort daar niet tussen te
   staan, want die lijst is voor medewerkers zelf. */
create or replace function public.vaste_dagen_namen()
returns table (id uuid, naam text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, trim(concat_ws(' ', s.voornaam, s.tussenvoegsel, s.achternaam))
  from public.sollicitaties s
  where s.fase = 'medewerker'
    and s.uit_dienst_op is null
    and coalesce(s.is_apparaat, false) = false
    and coalesce(s.is_test, false) = false
  order by s.voornaam, s.achternaam
$$;

revoke all on function public.vaste_dagen_namen() from public;
grant execute on function public.vaste_dagen_namen() to anon, authenticated;

create or replace view public.vaste_dagen_overzicht
with (security_invoker = true) as
  select s.id as persoon_id,
         trim(concat_ws(' ', s.voornaam, s.tussenvoegsel, s.achternaam)) as naam,
         v.ingevuld_op, v.wil_vast, v.akkoord_geen_vast,
         v.di, v.wo, v."do", v.vr, v.za, v.zo,
         v.za_hele_dag, v.zo_hele_dag, v.aantal_vast, v.blokkades,
         v.geldig_tot, v.opmerking
    from public.sollicitaties s
    left join public.rooster_voorkeuren_laatste v on v.persoon_id = s.id
   where s.fase = 'medewerker'
     and s.uit_dienst_op is null
     and coalesce(s.is_apparaat, false) = false
     and coalesce(s.is_eigenaar, false) = false
     and coalesce(s.is_test, false) = false;

-- De oefenkaart zelf. Eén, en alleen als hij er nog niet is.
insert into public.sollicitaties (
  voornaam, achternaam, email, fase, status, is_test,
  geboortedatum, in_dienst_sinds, functie, uurloon,
  -- loonbureau_verstuurd_op moet gevuld zijn, anders herkent
  -- huidige_medewerker() hem niet en kan Sander niet als hem inloggen.
  loonbureau_verstuurd_op, aangenomen_op
)
select
  'Test', 'Medewerker', 'sanderboskma+test@gmail.com', 'medewerker', 'aangenomen', true,
  -- Zeventien: dan verschijnt bij het tekenen het vak voor een ouder.
  '2009-03-14', '2026-01-01', 'Medewerker fastservice II', 8.25,
  now(), now()
where not exists (select 1 from public.sollicitaties where is_test);

/* Een lopend contract dat eind dit jaar afloopt, zodat er iets te verlengen en
   aan te zeggen valt. Nuluren, want dat is wat hier het meest voorkomt. */
insert into public.contracten (
  medewerker_id, werkgever, soort, duur, begint, eindigt,
  uurloon, functie, bron, opmerking
)
select s.id, 'boskma', 'nuluren', 'bepaalde', '2026-01-01', '2026-12-31',
       8.25, 'Medewerker fastservice II', 'handmatig',
       'Oefencontract. Hoort bij de testmedewerker.'
  from public.sollicitaties s
 where s.is_test
   and not exists (select 1 from public.contracten c where c.medewerker_id = s.id);

notify pgrst, 'reload schema';
