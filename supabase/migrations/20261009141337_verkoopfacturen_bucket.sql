-- Privé-opslag voor de verstuurde facturen
--
-- Niet openbaar: er staan klantgegevens en bedragen in, en een factuur hoort
-- alleen bij de klant en bij Sander terecht te komen. De edge function
-- verkoopfactuur-pdf schrijft erin met haar eigen rechten.

insert into storage.buckets (id, name, public)
values ('verkoopfacturen', 'verkoopfacturen', false)
on conflict (id) do nothing;

drop policy if exists verkoopfacturen_lezen on storage.objects;
create policy verkoopfacturen_lezen on storage.objects
  for select to authenticated
  using (bucket_id = 'verkoopfacturen' and public.is_app_user());
