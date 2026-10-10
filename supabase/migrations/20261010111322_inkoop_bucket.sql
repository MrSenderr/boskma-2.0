-- Privé-opslag voor de inkoopfacturen zelf.
--
-- Hier komen de pdf's te staan die nu nog op de schijf van de oude inkoop-app
-- staan. Niet openbaar: er staan je inkoopprijzen in, en dat is precies wat
-- een leverancier niet van een ander mag weten.
--
-- Sander mag erin kijken en erin uploaden; het achterkamertje dat de facturen
-- uitleest werkt met zijn eigen sleutel en gaat langs deze regels heen.

insert into storage.buckets (id, name, public)
values ('inkoopdocumenten', 'inkoopdocumenten', false)
on conflict (id) do nothing;

drop policy if exists inkoopdocumenten_lezen on storage.objects;
create policy inkoopdocumenten_lezen on storage.objects
  for select to authenticated
  using (bucket_id = 'inkoopdocumenten' and public.is_app_user());

drop policy if exists inkoopdocumenten_schrijven on storage.objects;
create policy inkoopdocumenten_schrijven on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inkoopdocumenten' and public.is_app_user());;
