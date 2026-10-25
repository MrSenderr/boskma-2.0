-- De medewerker ziet het voorstel, bevestigt de ontvangst en kiest.
--
-- Waarom dit functies zijn en geen schrijfrecht op de tabel: de medewerker mag
-- antwoorden, maar niet veranderen wát er is aangeboden. Met een gewone
-- UPDATE-policy zou hij ook de aangeboden uren of het uurloon kunnen bijwerken
-- en zou het voorstel niet meer het voorstel zijn. Deze functies raken alleen
-- de antwoordvelden aan, en alleen in de eigen rij.
--
-- Twee kolommen erbij.
--
-- **brief** — de tekst zoals die is verstuurd. De app stelt de zinnen samen en
-- laat ze aan Sander zien; wat hij zag hoort ook het bewijsstuk te zijn. Zou de
-- brief later opnieuw worden samengesteld uit de velden, dan verandert hij mee
-- met de code en staat er over een jaar iets anders dan wat er die dag uitging.
--
-- **op_papier** — niet alles gaat digitaal. Wie geen mail leest krijgt het op
-- papier mee, en dan legt Sander het antwoord zelf vast. Dat hoort te zien te
-- zijn, want de tijdstippen van geopend en bevestigd komen dan niet van de
-- medewerker zelf.

alter table public.contractvoorstellen
  add column if not exists brief text,
  add column if not exists op_papier boolean not null default false;

comment on column public.contractvoorstellen.brief is
  'De brief zoals verstuurd. Niet opnieuw samenstellen: dit is het bewijsstuk.';
comment on column public.contractvoorstellen.op_papier is
  'Waar of het voorstel op papier is meegegeven en het antwoord door Sander is vastgelegd.';

/* Openen is geen handeling, maar wel een feit. Alleen de eerste keer: daarna
   zou elke keer dat hij zijn dossier opent de datum opschuiven, en dan weet je
   niet meer wanneer hij het voor het eerst zag. */
create or replace function public.voorstel_geopend(p_voorstel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mij uuid := public.huidige_medewerker();
begin
  if mij is null then raise exception 'geen toegang'; end if;

  update public.contractvoorstellen
     set geopend_op = now()
   where id = p_voorstel
     and medewerker_id = mij
     and verstuurd_op is not null
     and ingetrokken_op is null
     and geopend_op is null;
end;
$$;

/* Ontvangst bevestigen. Dit is het bewijs dat de aanzegging is aangekomen
   (art. 7:668 BW vraagt schriftelijk, en digitaal mag als de ontvangst te
   bewijzen is). Daarom een aparte handeling, met een eigen tijdstip, en niet
   iets dat de app stilletjes afleidt uit een paginabezoek. */
create or replace function public.voorstel_bevestigen(p_voorstel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mij uuid := public.huidige_medewerker();
begin
  if mij is null then raise exception 'geen toegang'; end if;

  update public.contractvoorstellen
     set ontvangst_bevestigd_op = coalesce(ontvangst_bevestigd_op, now()),
         geopend_op             = coalesce(geopend_op, now())
   where id = p_voorstel
     and medewerker_id = mij
     and verstuurd_op is not null
     and ingetrokken_op is null;
end;
$$;

/* Antwoorden.
 *
 * De twee keuzes zijn los: een verlenging is een afspraak, een aanbod vaste
 * uren mag je weigeren (art. 7:628a lid 5 BW) zonder dat de verlenging daarmee
 * van tafel is. Wie één van beide beantwoordt, beantwoordt niet het andere.
 *
 * Een gegeven antwoord blijft staan. Van gedachten veranderen loopt via
 * Sander: hij trekt het voorstel in en stuurt een nieuw. Anders kun je niet
 * meer laten zien wat er is geantwoord en wanneer, en dat is precies waar deze
 * tabel voor bedoeld is.
 *
 * Een keuze die niet bij de aard van het voorstel hoort wordt geweigerd. Een
 * ja op een verlenging die niet is aangeboden zou in het dossier staan als een
 * afspraak die nooit is gedaan. */
create or replace function public.voorstel_antwoorden(
  p_voorstel uuid,
  p_verlenging text default null,
  p_vaste_uren text default null,
  p_reactie text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mij uuid := public.huidige_medewerker();
  v   public.contractvoorstellen;
  nu  timestamptz := now();
begin
  if mij is null then raise exception 'geen toegang'; end if;

  select * into v
    from public.contractvoorstellen
   where id = p_voorstel
     and medewerker_id = mij
     and verstuurd_op is not null
     and ingetrokken_op is null;
  if not found then raise exception 'voorstel niet gevonden'; end if;

  if p_verlenging is not null then
    if p_verlenging not in ('akkoord', 'niet_akkoord') then
      raise exception 'onbekend antwoord op de verlenging';
    end if;
    if v.aard not in ('verlengen', 'verlengen_en_vaste_uren') then
      raise exception 'er is geen verlenging aangeboden';
    end if;
    if v.keuze_verlenging is not null then
      raise exception 'de verlenging is al beantwoord';
    end if;
  end if;

  if p_vaste_uren is not null then
    if p_vaste_uren not in ('aangenomen', 'geweigerd') then
      raise exception 'onbekend antwoord op de vaste uren';
    end if;
    if v.aard not in ('vaste_uren', 'verlengen_en_vaste_uren') then
      raise exception 'er zijn geen vaste uren aangeboden';
    end if;
    if v.keuze_vaste_uren is not null then
      raise exception 'de vaste uren zijn al beantwoord';
    end if;
  end if;

  if p_verlenging is null and p_vaste_uren is null then
    raise exception 'er is niets gekozen';
  end if;

  update public.contractvoorstellen
     set keuze_verlenging    = coalesce(p_verlenging, keuze_verlenging),
         keuze_verlenging_op = case
           when p_verlenging is not null then nu else keuze_verlenging_op end,
         keuze_vaste_uren    = coalesce(p_vaste_uren, keuze_vaste_uren),
         keuze_vaste_uren_op = case
           when p_vaste_uren is not null then nu else keuze_vaste_uren_op end,
         -- Wat hij erbij schrijft komt achter een eerdere opmerking, zodat een
         -- tweede antwoord de eerste toelichting niet wist.
         reactie = nullif(
           trim(concat_ws(E'\n\n', nullif(trim(coalesce(reactie, '')), ''),
                                   nullif(trim(coalesce(p_reactie, '')), ''))), ''),
         ontvangst_bevestigd_op = coalesce(ontvangst_bevestigd_op, nu),
         geopend_op             = coalesce(geopend_op, nu),
         bijgewerkt_op          = nu
   where id = p_voorstel;
end;
$$;

revoke all on function public.voorstel_geopend(uuid) from public;
revoke all on function public.voorstel_bevestigen(uuid) from public;
revoke all on function public.voorstel_antwoorden(uuid, text, text, text) from public;
grant execute on function public.voorstel_geopend(uuid) to authenticated;
grant execute on function public.voorstel_bevestigen(uuid) to authenticated;
grant execute on function public.voorstel_antwoorden(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
