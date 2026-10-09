-- Correctie: facturen zonder vervaldatum vielen buiten de ronde
--
-- Niet elke leverancier zet een vervaldatum op de factuur. Die facturen bleven
-- daardoor onaangeroerd staan: een incasso werd nooit afgevinkt en een
-- handmatige factuur gaf nooit een seintje. Nu valt de ronde terug op
-- factuurdatum + 14, en als ook die ontbreekt op het moment dat de factuur naar
-- Basecone ging + 14.
--
-- LET OP: net als de vorige migratie stond dit op 09-10-2026 al in de database.
-- De tekst van de functie vóór deze correctie is niet meer te achterhalen, dus
-- staat hij hier in zijn geheel zoals hij nu draait. Daardoor is deze migratie
-- gelijk aan het slot van de vorige; dat is geen fout maar het gevolg van
-- achteraf vastleggen.

create or replace function public.facturen_dagelijks()
returns void language plpgsql security definer set search_path = '' as $$
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
end $$;
