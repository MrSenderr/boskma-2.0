-- De wachtrij voor facturen die je zelf in de app zet.
--
-- Waarom een eigen tabel en geen rij in `documenten`: een document heeft een
-- factuurnummer, een datum en bedragen, en die kent niemand voordat de pdf
-- gelezen is. Een halve rij met "nog-onbekend" erin zou overal meetellen waar
-- hij niet thuishoort. Dit is een briefje op de stapel, geen factuur.
--
-- Het achterkamertje pakt er steeds één op, leest hem uit en zet hier de
-- uitkomst neer. Het scherm kijkt hier om de paar seconden of het al klaar is.

create table inkoop.uploads (
  id            bigint generated always as identity primary key,
  opslagpad     text not null,
  bestandsnaam  text not null,
  -- Dezelfde pdf twee keer uploaden levert dezelfde hash op; dan weten we het
  -- meteen, zonder ervoor te hoeven betalen.
  bestand_hash  text not null unique,
  leverancier_id integer not null references inkoop.leveranciers(id),
  status        text not null default 'nieuw'
                check (status in ('nieuw','bezig','klaar','mislukt','duplicaat')),
  melding       text,
  document_id   integer references inkoop.documenten(id) on delete set null,
  aangemaakt_op timestamptz not null default now(),
  verwerkt_op   timestamptz
);

create index idx_uploads_status on inkoop.uploads (status, aangemaakt_op);

alter table inkoop.uploads enable row level security;

create policy app_beheert on inkoop.uploads for all to authenticated
  using (public.is_app_user()) with check (public.is_app_user());

grant select, insert, update, delete on inkoop.uploads to authenticated, service_role;

notify pgrst, 'reload schema';;
