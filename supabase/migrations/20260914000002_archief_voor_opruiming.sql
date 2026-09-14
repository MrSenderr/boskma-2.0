-- Vangnet vóór het opruimen van 14 september 2026.
--
-- Alles wat uit public weggaat wordt eerst hierheen gekopieerd. Geen export
-- naar een bestand maar een schema, zodat de gegevens de database niet uit
-- hoeven en een vergissing één SELECT kost om terug te draaien.
--
-- `archief` staat niet in de exposed schemas van de API en de rechten zijn
-- ingetrokken, dus de app ziet hier niets van.

create schema if not exists archief;

revoke all on schema archief from anon, authenticated;

do $$
declare
  t text;
  namen text[] := array[
    -- kas
    'kas_tellingen','kas_telling_regels','kas_coupures','kluis_mutaties','kluis_mutatie_regels',
    -- mep
    'mep_sjablonen','mep_dag_taken','mep_dag_notitie',
    -- werkkaarten, recepten, werkwijzen
    'werkkaarten','werkkaart_stappen','werkkaart_categorieen',
    'recepten','recept_fotos','werkwijzen','werkwijze_stappen',
    -- haccp-taken en wat eromheen hing
    'haccp_taken','haccp_taak_gedaan','haccp_weekakkoord','haccp_week_status','haccp_checklists',
    'haccp_frituurvet','haccp_leveringen','persoonlijke_taken','medewerker_rechten',
    -- eerste inkooppoging, nooit gebruikt door een app
    'inkoop_leveranciers','inkoop_documenten','inkoop_regels','inkoop_artikelen','inkoop_artikel_alias',
    -- de bestel-app die eruit gaat
    'bestellen_locaties','bestellen_gebruikers','bestellen_producten','bestellen_orders',
    'bestellen_regels','bestellen_categorieen',
    -- restjes
    'notities','employee_pins',
    -- hangt aan edge functions die nog beoordeeld moeten worden
    'boskma_state','push_subscriptions','f1_live_cache','meldingen'
  ];
begin
  foreach t in array namen loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'overgeslagen, bestaat niet: %', t;
      continue;
    end if;
    execute format('drop table if exists archief.%I', t);
    execute format('create table archief.%I as table public.%I', t, t);
  end loop;
end $$;
