-- De prijs per artikel per factuur: de prijs waarop je het meeste afnam.
--
-- Twee vallen zitten hierin, allebei op echte facturen van Veldboer gevonden:
--
-- 1. Een factuur kan een foutieve regel bevatten die op dezelfde factuur wordt
--    gecrediteerd. Bij de bananen gebeurde dat op 9 oktober 2026: elf stuks à
--    € 0,47, plus vijf "per kg" à € 2,35, plus diezelfde vijf er weer af. Neem
--    je de hoogste prijs, dan koos je € 2,35 en meldde het verslag de week
--    erna een prijsdaling van tachtig procent op een artikel dat al maanden
--    € 0,47 kost.
--
-- 2. Bij een artikel dat per kilo gaat staat op de factuur aantal 1 (een
--    colli), prijs € 17,39 (per kilo) en bedrag € 36,17 (het gewicht maal de
--    prijs). Het bedrag delen door het aantal geeft dan € 36,17, en dat
--    schommelt mee met het gewicht van de doos. De volgende week zou er een
--    prijsstijging gemeld worden die er niet is.
--
-- Dus: tel per prijs op hoeveel er netto van is afgenomen — creditregels
-- trekken hun eigen regel weg — en neem de prijs waar het meeste op staat. Dat
-- is de prijs zoals hij op de factuur staat, en correcties vallen vanzelf af.
--
-- Gratis regels tellen niet mee: een monster van nul euro is geen prijs.

drop view if exists inkoop.factuur_artikel;

create view inkoop.factuur_artikel with (security_invoker = true) as
with per_prijs as (
  select r.document_id,
         r.leverancier_id,
         r.factuurdatum,
         r.artikelnr_norm as artikelnr,
         r.prijs,
         min(r.artikelnaam) as artikelnaam,
         min(r.groep) as groep,
         sum(r.aantal) as aantal,
         sum(r.bedrag) as bedrag,
         bool_or(r.actie) as actie
    from inkoop.factuurregels r
   where r.soort in ('Levering', 'Retour/credit')
     and r.artikelnr_norm is not null
     and r.prijs is not null
     and r.prijs > 0
   group by r.document_id, r.leverancier_id, r.factuurdatum, r.artikelnr_norm, r.prijs
),
gekozen as (
  select distinct on (document_id, artikelnr) *
    from per_prijs
   where aantal > 0
   order by document_id, artikelnr, aantal desc, bedrag desc, prijs
)
select g.document_id,
       g.leverancier_id,
       g.factuurdatum,
       g.artikelnr,
       g.artikelnaam,
       g.groep,
       g.aantal,
       g.prijs,
       g.bedrag,
       g.actie,
       lag(g.prijs) over w as vorige_prijs,
       lag(g.factuurdatum) over w as vorige_datum,
       lag(g.actie) over w as vorige_actie,
       (lag(g.prijs) over w) is null as is_nieuw
  from gekozen g
window w as (partition by g.leverancier_id, g.artikelnr order by g.factuurdatum, g.document_id);

comment on view inkoop.factuur_artikel is
  'Per factuur per artikel de prijs waarop het meeste is afgenomen, met de prijs van de vorige keer ernaast. Creditregels op dezelfde factuur vallen weg.';

grant select on inkoop.factuur_artikel to authenticated;

notify pgrst, 'reload schema';
