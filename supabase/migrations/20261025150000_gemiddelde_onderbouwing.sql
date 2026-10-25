-- Waar het twaalfmaandsgemiddelde vandaan komt.
--
-- Aanleiding: de gewerkte uren staan pas vanaf juli 2026 in de app, en de
-- uitdraai van Eitje droeg het etiket "1 januari – 31 december 2026" terwijl er
-- alleen uren vanaf juli in zaten. Zolang de app dat etiket geloofde telden
-- januari tot en met juni als maanden zonder werk, en zou er een gemiddelde
-- uitkomen dat veel te laag is. Een aanbod onder het echte gemiddelde blijft
-- vijf jaar opeisbaar (art. 7:628a lid 5 BW), dus dat is het dure getal.
--
-- Twee dingen hier.
--
-- **maanden_met_uren()** — in welke maanden er érgens in de zaak uren zijn
-- verloond. Dat één medewerker een maand niet werkt is normaal; dat de héle
-- zaak een maand stilligt niet. Staat er van niemand iets in een maand, dan is
-- dat een gat in de uitdraai en geen rustige maand. De app knipt de ingelezen
-- periodes hiermee terug tot wat er werkelijk is.
--
-- Twee personen, niet één. In mei 2026 stonden er zes regels, allemaal van
-- Sander zelf — een restje van een vroege proef. Eén iemands uren maken nog
-- geen maand van de zaak, en die ene maand zou als volledig ingelezen gelden
-- en het gemiddelde van iedereen omlaag trekken. De eigenaar en de oefenkaart
-- tellen daarom niet mee, en er moeten er minstens twee zijn.
--
-- **gemiddelde_bron en gemiddelde_over** — zolang Eitje geen twaalf maanden
-- levert, kan het echte gemiddelde bij het loonbureau worden opgevraagd: zij
-- hebben de verloonde uren uitbetaald en weten ze exact. Sander mag het
-- berekende getal daarmee overschrijven. Wát er is gebruikt hoort dan in het
-- voorstel te staan, en op het blad dat naar het loonbureau gaat — anders kun
-- je later niet laten zien waarop het aanbod rustte.

alter table public.contractvoorstellen
  add column if not exists gemiddelde_bron text
    check (gemiddelde_bron is null or gemiddelde_bron in ('berekend', 'loonbureau')),
  add column if not exists gemiddelde_over text;

comment on column public.contractvoorstellen.gemiddelde_bron is
  'Waar het gemiddelde vandaan komt: berekend uit de ingelezen uren, of opgave van het loonbureau.';
comment on column public.contractvoorstellen.gemiddelde_over is
  'Over welke periode het gemiddelde gaat, in gewone taal. Bijvoorbeeld: juli t/m oktober 2026.';

/* In welke maanden er verloonde uren staan, over iedereen heen. Een functie en
   geen view, zodat de app er één klein antwoord uit krijgt in plaats van alle
   regels van de hele zaak. */
create or replace function public.maanden_met_uren()
returns table (maand text)
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(g.datum, 'YYYY-MM') as maand
    from public.gewerkte_uren g
    join public.sollicitaties s on s.id = g.medewerker_id
   where g.minuten > 0
     and coalesce(s.is_eigenaar, false) = false
     and coalesce(s.is_test, false) = false
     and coalesce(s.is_apparaat, false) = false
   group by 1
  having count(distinct g.medewerker_id) >= 2
   order by 1
$$;

revoke all on function public.maanden_met_uren() from public;
grant execute on function public.maanden_met_uren() to authenticated;

notify pgrst, 'reload schema';
