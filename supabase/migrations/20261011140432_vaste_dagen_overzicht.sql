-- Ieders voorkeur voor vaste dagen op één rij, inclusief wie nog niets heeft
-- opgegeven.
--
-- Links beginnen bij de mensen, niet bij de antwoorden: juist wie nog niet
-- heeft ingevuld is wat je wilt zien als je het rooster gaat maken. Daarom
-- een left join en geen gewone.
--
-- Alleen wie nu in dienst is, en geen apparaten — die werken geen diensten.
--
-- security_invoker: leest met de rechten van wie het opvraagt. Sander ziet
-- iedereen; een medewerker die dit zou opvragen ziet alleen zichzelf, want de
-- regels op rooster_voorkeuren blijven gelden.

create view public.vaste_dagen_overzicht with (security_invoker = true) as
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
     and coalesce(s.is_apparaat, false) = false;

grant select on public.vaste_dagen_overzicht to authenticated;

notify pgrst, 'reload schema';;
