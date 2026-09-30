-- VAPID-sleutels voor pushberichten in Vault in plaats van in de edge-function-secrets.
-- kim-push maakt ze de eerste keer zelf aan; de private key verlaat Supabase nooit.
-- (Toegepast op 30-09-2026. Sleutels zijn aangemaakt; send-push gebruikt ze ook.)

create or replace function public.push_vapid_ophalen()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'public',  (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    'private', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private')
  );
$$;

create or replace function public.push_vapid_opslaan(p_public text, p_private text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nooit overschrijven: bestaande abonnementen hangen aan deze sleutels.
  if exists (select 1 from vault.secrets where name = 'push_vapid_private') then
    return;
  end if;
  perform vault.create_secret(p_public,  'push_vapid_public',  'VAPID public key voor web push (boskma-app)');
  perform vault.create_secret(p_private, 'push_vapid_private', 'VAPID private key voor web push (boskma-app)');
end;
$$;

-- De public key is niet geheim: de app heeft hem nodig om een abonnement te maken.
create or replace function public.push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public';
$$;

revoke all on function public.push_vapid_ophalen()             from public, anon, authenticated;
revoke all on function public.push_vapid_opslaan(text, text)   from public, anon, authenticated;
revoke all on function public.push_public_key()                from public, anon;
grant execute on function public.push_vapid_ophalen()           to service_role;
grant execute on function public.push_vapid_opslaan(text, text) to service_role;
grant execute on function public.push_public_key()              to authenticated;
