-- De meewerkend eigenaar.
--
-- Sander staat zelf in het rooster — zo'n 25 geplande diensten — maar hij was
-- geen medewerker in de app. Daardoor hingen die diensten los en telde het
-- spitsscherm hem als een open dienst: een dienst zonder naam, terwijl hij
-- gewoon in de zaak staat.
--
-- Hij moet dus wél meedoen in het rooster en in de spits, maar niet in alles
-- wat bij een personeelslid hoort: geen invullink, geen loonbureau, geen
-- contractvergelijking met eitje, geen "heeft zijn vaste dagen nog niet
-- ingevuld". Vandaar een eigen merkteken in plaats van hem overal uit te
-- zonderen op zijn naam.

alter table public.sollicitaties
  add column is_eigenaar boolean not null default false;

comment on column public.sollicitaties.is_eigenaar is
  'Meewerkend eigenaar: doet mee in rooster en spits, maar niet in de onboarding, het loonbureau of de contractvergelijking.';

-- Zijn oude regel stond als afgewezen sollicitant in het archief. Dat is hij
-- niet; het was een proef uit de begintijd van de app.
update public.sollicitaties
   set fase = 'medewerker',
       status = 'aangenomen',
       is_eigenaar = true,
       aangenomen_op = coalesce(aangenomen_op, aangemeld_op, now())
 where voornaam = 'Sander'
   and achternaam = 'Boskma'
   and is_apparaat = false;

-- De importeur kreeg ooit te horen dat deze naam genegeerd moest worden, bij
-- gebrek aan iemand om hem aan te hangen. Nu is die er wel.
update public.rooster_namen
   set medewerker_id = (select id from public.sollicitaties
                         where voornaam = 'Sander' and achternaam = 'Boskma' and is_apparaat = false
                         limit 1),
       negeren = false,
       gezet_op = now()
 where naam = 'sander boskma';

-- Wat er al binnen was alsnog aan hem hangen. Op naam, want dat is het enige
-- wat die regels hebben.
update public.geplande_shifts
   set medewerker_id = (select id from public.sollicitaties
                         where voornaam = 'Sander' and achternaam = 'Boskma' and is_apparaat = false
                         limit 1)
 where medewerker_id is null
   and lower(trim(coalesce(voornaam,'') || ' ' || coalesce(achternaam,''))) = 'sander boskma';

update public.gewerkte_uren
   set medewerker_id = (select id from public.sollicitaties
                         where voornaam = 'Sander' and achternaam = 'Boskma' and is_apparaat = false
                         limit 1)
 where medewerker_id is null
   and lower(trim(coalesce(voornaam,'') || ' ' || coalesce(achternaam,''))) = 'sander boskma';

-- Het overzicht vaste dagen gaat over wie je inroostert op vaste dagen. De
-- eigenaar vult dat niet in, en zou daar elke week als gat in staan.
create or replace view public.vaste_dagen_overzicht with (security_invoker = true) as
  select s.id as persoon_id,
         trim(concat_ws(' ', s.voornaam, s.tussenvoegsel, s.achternaam)) as naam,
         v.ingevuld_op,
         v.wil_vast,
         v.akkoord_geen_vast,
         v.di, v.wo, v."do", v.vr, v.za, v.zo,
         v.za_hele_dag, v.zo_hele_dag,
         v.aantal_vast,
         v.blokkades,
         v.geldig_tot,
         v.opmerking
    from public.sollicitaties s
    left join public.rooster_voorkeuren_laatste v on v.persoon_id = s.id
   where s.fase = 'medewerker'
     and s.uit_dienst_op is null
     and coalesce(s.is_apparaat, false) = false
     and coalesce(s.is_eigenaar, false) = false;

grant select on public.vaste_dagen_overzicht to authenticated;

notify pgrst, 'reload schema';
