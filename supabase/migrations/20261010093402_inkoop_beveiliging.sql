-- Alleen Sander mag bij de inkoopgegevens, net als bij de rest van de app.
--
-- Dezelfde vorm als bij de verkoopfacturen: elke tabel krijgt dezelfde regel,
-- zodat er bij een nieuwe tabel niet per ongeluk eentje openblijft. De lus
-- loopt over alles wat er op dat moment staat; een tabel die later bijkomt
-- heeft dus een eigen regel nodig.

grant usage on schema inkoop to authenticated, service_role;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'inkoop' loop
    execute format('alter table inkoop.%I enable row level security', t);
    execute format('drop policy if exists app_beheert on inkoop.%I', t);
    execute format(
      'create policy app_beheert on inkoop.%I for all to authenticated
         using (public.is_app_user()) with check (public.is_app_user())', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema inkoop to authenticated, service_role;
grant usage, select on all sequences in schema inkoop to authenticated, service_role;

-- Wat hierna nog in dit schema wordt aangemaakt krijgt dezelfde rechten.
alter default privileges in schema inkoop
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema inkoop
  grant usage, select on sequences to authenticated, service_role;;
