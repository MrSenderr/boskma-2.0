-- Twee views voor het documentenscherm.
--
-- De app praat via de api met de database en kan daar geen joins en tellingen
-- in elkaar zetten zoals de oude applicatie dat met losse zoekopdrachten deed.
-- Dus zetten we die hier klaar.
--
-- Allebei security_invoker: ze lezen met de rechten van wie ze bevraagt, zodat
-- ze niet langs de beveiliging op de tabellen heen gaan.

-- De lijst met facturen, inclusief hoeveel regels erop staan.
create view inkoop.factuuroverzicht with (security_invoker = true) as
  select d.id,
         d.leverancier_id,
         l.naam as leveranciernaam,
         d.nummer,
         d.datum,
         d.referentie,
         d.som_regels,
         d.btw,
         d.totaal_incl,
         d.verschil,
         d.status,
         d.melding,
         d.opslagpad,
         d.bestandsnaam,
         d.ontvangen,
         count(r.id)::int as regels,
         count(*) filter (where r.soort = 'Emballage')::int as emballage
    from inkoop.documenten d
    join inkoop.leveranciers l on l.id = d.leverancier_id
    left join inkoop.regels r on r.document_id = d.id
   where d.soort = 'factuur'
   group by d.id, l.naam;

-- De regels van één document, met de volledige artikelnaam erbij.
--
-- Bewust zonder filter op status: juist bij een document dat zijn controlesom
-- niet haalt wil je op dit scherm zien wat erop staat, want daar ga je de fout
-- zoeken. Voor de berekeningen is er factuurregels, die filtert wel.
create view inkoop.documentregels with (security_invoker = true) as
  select r.*,
         coalesce(al.naar, r.artikelnr) as artikelnr_norm,
         coalesce(a.omschrijving, r.omschrijving) as artikelnaam,
         (a.artikelnr is not null) as op_bestellijst
    from inkoop.regels r
    join inkoop.documenten d on d.id = r.document_id
    left join inkoop.artikel_alias al
           on al.leverancier_id = d.leverancier_id and al.van = r.artikelnr
    left join inkoop.assortiment a
           on a.leverancier_id = d.leverancier_id
          and a.artikelnr = coalesce(al.naar, r.artikelnr);

grant select on inkoop.factuuroverzicht, inkoop.documentregels to authenticated, service_role;

notify pgrst, 'reload schema';;
