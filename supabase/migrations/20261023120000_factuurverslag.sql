-- Bouwstenen voor het verslag bij een inkoopfactuur.
--
-- Veldboer levert wekelijks vijfenveertig tot honderd regels. Wat daarin
-- opvalt — een prijs die omhoog ging, iets nieuws, iets dat er juist niet op
-- staat — zie je met het blote oog niet. Deze twee views leveren het materiaal;
-- het verslag zelf wordt in de app geschreven (src/lib/factuurverslag.ts),
-- zodat de regels erachter te toetsen zijn.
--
-- security_invoker, net als de andere views hier: ze lezen met de rechten van
-- wie het opvraagt, dus de regels op inkoop.regels blijven gelden.

-- Per factuur per artikel, met de vorige prijs ernaast.
--
-- Eerst samenvoegen per factuur: een artikel kan twee regels hebben op dezelfde
-- factuur (deelleveringen), en dan is "de vorige prijs" niet die van de regel
-- erboven maar die van de vorige factuur.
create view inkoop.factuur_artikel with (security_invoker = true) as
with per_factuur as (
  select r.document_id,
         r.leverancier_id,
         r.factuurdatum,
         r.artikelnr_norm as artikelnr,
         min(r.artikelnaam) as artikelnaam,
         min(r.groep) as groep,
         sum(r.aantal) as aantal,
         max(r.prijs) as prijs,
         sum(r.bedrag) as bedrag,
         bool_or(r.actie) as actie
    from inkoop.factuurregels r
   where r.soort = 'Levering'
     and r.artikelnr_norm is not null
     and r.prijs is not null
     and r.prijs > 0
   group by r.document_id, r.leverancier_id, r.factuurdatum, r.artikelnr_norm
)
select p.*,
       lag(p.prijs) over w as vorige_prijs,
       lag(p.factuurdatum) over w as vorige_datum,
       lag(p.actie) over w as vorige_actie,
       -- Geen enkele eerdere factuur met dit artikel: dan is het nieuw.
       (lag(p.prijs) over w) is null as is_nieuw
  from per_factuur p
window w as (partition by p.leverancier_id, p.artikelnr order by p.factuurdatum, p.document_id);

comment on view inkoop.factuur_artikel is
  'Per factuur per artikel, met de prijs van de vorige keer ernaast. Basis voor het verslag bij een factuur.';

-- Welke artikelen op welke factuur stonden, zonder de rest.
--
-- Hiermee kan de app zien wat er normaal gesproken wekelijks op staat en deze
-- keer ontbreekt. Dat is meestal een vergeten bestelling, en dat merk je nu pas
-- als je het in de zaak nodig hebt.
create view inkoop.factuur_artikelen_kort with (security_invoker = true) as
select r.document_id,
       r.leverancier_id,
       r.factuurdatum,
       r.artikelnr_norm as artikelnr,
       min(r.artikelnaam) as artikelnaam
  from inkoop.factuurregels r
 where r.soort = 'Levering'
   and r.artikelnr_norm is not null
 group by r.document_id, r.leverancier_id, r.factuurdatum, r.artikelnr_norm;

comment on view inkoop.factuur_artikelen_kort is
  'Welke artikelen op welke factuur stonden. Voor "dit bestel je normaal wekelijks en nu niet".';

grant select on inkoop.factuur_artikel to authenticated;
grant select on inkoop.factuur_artikelen_kort to authenticated;

notify pgrst, 'reload schema';
