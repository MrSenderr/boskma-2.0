-- Een seintje zodra er een inkoopfactuur binnen is.
--
-- De factuur komt binnen terwijl je in de zaak staat. Het verslag erbij is
-- alleen iets waard als je weet dat hij er is; anders kijk je er over een week
-- naar, als de prijzen al betaald zijn.
--
-- Eén keer per dag, meegelift op facturen_dagelijks dat toch al om kwart voor
-- zes draait. Niet bij elke binnenkomst: dat zou betekenen dat de inkoop-app
-- hiervan af moet weten, en die staat los.

alter table inkoop.documenten add column if not exists gepusht_op timestamptz;

comment on column inkoop.documenten.gepusht_op is
  'Wanneer hierover een pushbericht is verstuurd. Leeg = nog niet gemeld.';

-- Wat er nu al staat is geen nieuws meer. Zonder dit zou de eerste ronde
-- negentien meldingen tegelijk sturen.
update inkoop.documenten set gepusht_op = now() where gepusht_op is null;

create or replace function public.facturen_dagelijks()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r record;
begin
  update public.facturen
     set status = 'betaald',
         betaald_op = coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14),
         betaald_via = 'incasso', bijgewerkt_op = now()
   where status = 'open' and betaalwijze = 'incasso' and soort = 'factuur'
     and coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14) < current_date;

  for r in
    select id from public.facturen
     where status = 'open' and betaalwijze = 'handmatig' and soort = 'factuur'
       and gepusht_op is null
       and coalesce(vervaldatum, factuurdatum + 14, basecone_op::date + 14) <= current_date + 3
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'facturen', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;

  -- Eigen facturen die te laat zijn. Drie dagen na de vervaldatum een seintje,
  -- en na een herinnering pas weer na zeven: anders word je elke dag herinnerd
  -- aan iets waar je niks aan kunt doen.
  for r in
    select id from public.verkoopfacturen
     where status = 'verzonden' and vervaldatum is not null and gepusht_op is null
       and case when herinnering_op is null then vervaldatum + 3
                else herinnering_op::date + 7 end < current_date
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'verkoopfacturen', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;

  -- Nieuwe inkoopfacturen, met het verslag een tik verderop.
  for r in
    select id from inkoop.documenten
     where status = 'verwerkt' and gepusht_op is null
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'inkoop_documenten', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end $function$;

notify pgrst, 'reload schema';
