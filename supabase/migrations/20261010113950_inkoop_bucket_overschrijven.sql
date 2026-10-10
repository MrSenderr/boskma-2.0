-- Hetzelfde bestand nog eens uploaden moet kunnen.
--
-- Is het uitlezen de eerste keer misgegaan, dan staat de pdf er al maar de
-- factuur niet. Zonder deze regel loopt de tweede poging stuk op de opslag in
-- plaats van dat hij gewoon overschrijft — en dan zit je vast.

drop policy if exists inkoopdocumenten_overschrijven on storage.objects;
create policy inkoopdocumenten_overschrijven on storage.objects
  for update to authenticated
  using (bucket_id = 'inkoopdocumenten' and public.is_app_user())
  with check (bucket_id = 'inkoopdocumenten' and public.is_app_user());;
