-- Per artikel de laatst betaalde prijs.
--
-- Hier rekent het scherm de stuks-, kilo- en literprijs mee uit. De
-- verpakkingsinhoud staat als tekst op de factuur ("40x85 gram"), dus dat
-- omrekenen gebeurt in de app en niet hier: het is uitpluiswerk met veel
-- uitzonderingen, en dat hoort op een plek waar het te testen valt.

create view inkoop.laatste_prijzen with (security_invoker = true) as
  select distinct on (leverancier_id, artikelnr_norm)
         leverancier_id,
         leveranciernaam,
         artikelnr_norm as artikelnr,
         artikelnaam as naam,
         merk,
         artikelinhoud as inhoud,
         eenheid,
         prijs,
         factuurdatum,
         factuurnummer,
         op_bestellijst,
         groep
    from inkoop.factuurregels
   where soort = 'Levering' and prijs is not null and prijs > 0
   order by leverancier_id, artikelnr_norm, factuurdatum desc, id desc;

grant select on inkoop.laatste_prijzen to authenticated, service_role;

notify pgrst, 'reload schema';;
