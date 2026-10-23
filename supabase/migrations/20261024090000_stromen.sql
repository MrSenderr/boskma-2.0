-- Alarm als er iets stilvalt.
--
-- Vier dingen komen binnen zonder dat Sander er iets voor doet: de
-- inkoopfacturen van Veldboer, de facturen uit zijn mail, het rooster uit
-- eitje en het weer. Ze lopen alle vier via iets buiten deze app — een script
-- in zijn Gmail, de oude inkoop-app, een cron.
--
-- Valt er een stil, dan is er geen foutmelding. Er gebeurt gewoon niets meer.
-- Bij het rooster merk je dat als de spits leeg blijft; bij de inkoopfacturen
-- pas als je over een maand prijzen wilt vergelijken en er een gat zit.
--
-- Deze tabel is ook bedoeld om te laten zien dát het goed gaat. Een alarm dat
-- alleen bestaat als er iets mis is, vertrouw je niet: je weet nooit of het nog
-- aanstaat.

create table public.stromen (
  id smallint primary key generated always as identity,
  sleutel text not null unique,
  naam text not null,
  uitleg text,
  -- Zoveel dagen stilte is nog normaal. Ruim genomen: liever een dag later een
  -- terecht alarm dan elke maand een vals.
  max_dagen smallint not null check (max_dagen between 1 and 90),
  pad text,
  laatste_op date,
  gecontroleerd_op timestamptz,
  gepusht_op timestamptz,
  actief boolean not null default true
);

comment on table public.stromen is
  'Wat er vanzelf binnenhoort te komen, en wanneer het stil te lang stil is.';

insert into public.stromen (sleutel, naam, uitleg, max_dagen, pad) values
  ('inkoopfacturen', 'Inkoopfacturen',
   'Veldboer levert wekelijks. Komen ze niet meer binnen, dan hapert de inkoop-app of het mailadres.',
   10, '/inkoop/documenten'),
  ('facturen', 'Facturen uit je mail',
   'Kim haalt ze uit je postvak. Stilte betekent meestal dat het script in Gmail is uitgezet.',
   7, '/facturen/inkomend'),
  ('rooster', 'Rooster uit eitje',
   'Twee keer per dag stuurt eitje de planning door. Zonder dat loopt de spitsindeling achter.',
   3, '/rooster/importeren'),
  ('weer', 'Het weer',
   'Elke ochtend opgehaald. Hier hangt straks de vergelijking met de omzet aan.',
   3, '/');

alter table public.stromen enable row level security;
revoke all on public.stromen from anon;

create policy app_gebruiker on public.stromen
  for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

/* De controle zelf.
 *
 * De vraag "wanneer kwam er voor het laatst iets binnen" is per stroom anders,
 * dus die staan hier uitgeschreven. Komt er een stroom bij, dan hoort hij hier
 * en in de tabel. */
create or replace function public.stromen_controleren()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r record;
begin
  update public.stromen s
     set laatste_op = v.laatste, gecontroleerd_op = now()
    from (values
            ('inkoopfacturen', (select max(datum) from inkoop.documenten)),
            ('facturen',       (select max(aangemaakt_op::date) from public.facturen)),
            ('rooster',        (select max(op::date) from public.rooster_imports)),
            ('weer',           (select max(datum) from public.dagboek_dagen))
         ) as v(sleutel, laatste)
   where s.sleutel = v.sleutel;

  /* Komt een stroom weer op gang, dan mag hij opnieuw alarm slaan. Zonder dit
     krijg je één keer een melding en daarna nooit meer. */
  update public.stromen
     set gepusht_op = null
   where gepusht_op is not null
     and laatste_op is not null
     and laatste_op >= current_date - max_dagen;

  for r in
    select id from public.stromen
     where actief and gepusht_op is null
       and (laatste_op is null or laatste_op < current_date - max_dagen)
  loop
    perform net.http_post(
      url     := 'https://xukzumqddeateztmjpzf.supabase.co/functions/v1/kim-push',
      body    := jsonb_build_object('tabel', 'stromen', 'id', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end $function$;

-- Elke ochtend om zeven uur, na de andere dagelijkse klusjes.
select cron.schedule('stromen-controleren', '0 7 * * *', 'select public.stromen_controleren()');

-- Meteen een eerste stand, zodat de tabel niet leeg op het scherm komt.
select public.stromen_controleren();

notify pgrst, 'reload schema';
