-- Prijsmutaties: per artikel de eerste en de laatste prijs die je betaalde.
--
-- Overgenomen uit de losse inkoop-app. Wat het bijzonder maakt is de kolom
-- impact: prijsverschil maal afgenomen aantal. Daarop sorteer je, niet op
-- percentage. Een artikel dat 40% duurder wordt maar dat je zelden koopt kost
-- je minder dan frites die een dubbeltje stijgen.
--
-- Acties tellen gewoon mee als prijs — dat is immers wat je betaalde — maar de
-- gewone prijs staat erbij. Zonder dat getal zegt een actieprijs niets: je
-- ziet wel dat het goedkoper was, niet waarvandaan. En juist het aflopen van
-- een actie is de stijging die je niet ziet aankomen.

create view inkoop.prijsmutaties with (security_invoker = true) as
with prijzen as (
  select leverancier_id,
         leveranciernaam,
         artikelnr_norm as artikelnr,
         factuurdatum,
         prijs,
         aantal,
         artikelnaam as omschrijving,
         merk,
         actie,
         first_value(prijs) over w as eerste,
         last_value(prijs) over w as laatste,
         first_value(factuurdatum) over w as eerste_datum,
         last_value(factuurdatum) over w as laatste_datum,
         last_value(actie) over w as laatste_actie,
         first_value(actie) over w as eerste_actie
    from inkoop.factuurregels
   where soort = 'Levering' and prijs is not null and prijs > 0
  window w as (partition by leverancier_id, artikelnr_norm
               order by factuurdatum, id
               rows between unbounded preceding and unbounded following)
)
select leverancier_id,
       min(leveranciernaam) as leveranciernaam,
       artikelnr,
       min(omschrijving) as omschrijving,
       min(merk) as merk,
       min(eerste)::numeric(10,4) as eerste,
       min(laatste)::numeric(10,4) as laatste,
       min(prijs)::numeric(10,4) as laagste,
       max(prijs)::numeric(10,4) as hoogste,
       min(eerste_datum) as van,
       min(laatste_datum) as tot,
       count(*)::int as keer_gekocht,
       bool_or(laatste_actie) as laatste_was_actie,
       bool_or(eerste_actie) as eerste_was_actie,
       avg(prijs) filter (where not actie)::numeric(10,4) as normale_prijs,
       count(*) filter (where actie)::int as keer_op_actie,
       sum(aantal)::numeric(10,2) as totaal_aantal,
       ((min(laatste) - min(eerste)) * sum(aantal))::numeric(10,2) as impact
  from prijzen
 group by leverancier_id, artikelnr
having count(*) > 1 and min(eerste) <> min(laatste);

grant select on inkoop.prijsmutaties to authenticated, service_role;

notify pgrst, 'reload schema';;
