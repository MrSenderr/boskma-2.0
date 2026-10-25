-- Wat bestel je op een dinsdag, en wat op een donderdag?
--
-- Aanleiding: de inkoopmodule liet vooral gegevens zien waar je niets mee doet.
-- Dit is de eerste die een vraag beantwoordt die je werkelijk hebt — wat moet er
-- deze dinsdag besteld worden — in plaats van te tonen wat er ooit is binnen-
-- gekomen.
--
-- Het kan omdat de afleverdatum bij 96% van de factuurregels staat, en omdat het
-- patroon zo duidelijk is: sinds juli 2026 zijn er zestien dinsdagen en zestien
-- donderdagen met leveringen, samen 97% van alles. De rest is losse aanvulling.
--
-- Drie keuzes zitten in deze view.
--
-- **Per weekdag en niet per week.** Een dinsdaglevering lijkt op andere
-- dinsdagleveringen, niet op de donderdag ervoor. Dat is precies wat Sander
-- vroeg, en het blijkt ook uit de cijfers: donderdag is in euro's een derde
-- groter dan dinsdag.
--
-- **Een venster van de laatste twaalf weken.** Ouder dan dat zegt weinig over
-- wat je nu nodig hebt; het seizoen verandert, de kaart verandert. Met te weinig
-- geschiedenis zou de view leeg blijven, dus staat er geen ondergrens aan het
-- aantal leverdagen — hoe vaak iets voorkwam staat erbij, zodat het scherm zelf
-- kan kiezen wat het voorstelt en wat het alleen noemt.
--
-- **Emballage telt niet mee.** Statiegeldregels zijn geen bestelling; die komen
-- vanzelf mee met wat je afneemt.
--
-- De view stelt niets voor en bestelt niets. Hij telt alleen wat er is gebeurd.
-- Wat daarvan een voorstel wordt, bepaalt het scherm.

create or replace view inkoop.bestelpatroon
with (security_invoker = true) as
with venster as (
  select (current_date - interval '12 weeks')::date as vanaf
),
leverdagen as (
  -- Op welke dagen is er werkelijk geleverd, per weekdag geteld.
  select extract(isodow from r.afleverdatum)::int as dagnr,
         count(distinct r.afleverdatum) as dagen,
         max(r.afleverdatum) as laatste_dag
    from inkoop.documentregels r, venster v
   where r.afleverdatum is not null
     and r.afleverdatum >= v.vanaf
     and coalesce(r.soort, '') <> 'Emballage'
   group by 1
),
per_artikel as (
  select extract(isodow from r.afleverdatum)::int as dagnr,
         d.leverancier_id,
         r.artikelnr,
         max(coalesce(r.artikelnaam, r.omschrijving)) as naam,
         max(r.eenheid) as eenheid,
         count(distinct r.afleverdatum) as keer,
         sum(r.aantal) as totaal_aantal,
         max(r.afleverdatum) as laatst_besteld,
         max(r.prijs) filter (where r.prijs is not null) as laatste_prijs
    from inkoop.documentregels r
    join inkoop.documenten d on d.id = r.document_id
   cross join venster v
   where r.afleverdatum is not null
     and r.afleverdatum >= v.vanaf
     and coalesce(r.soort, '') <> 'Emballage'
     and r.artikelnr is not null
   group by 1, 2, 3
)
select p.dagnr,
       l.dagen            as leverdagen,
       l.laatste_dag,
       p.leverancier_id,
       lev.naam           as leveranciernaam,
       p.artikelnr,
       p.naam,
       p.eenheid,
       p.keer,
       -- Gemiddeld per kéér dat je het bestelde, niet per leverdag: anders
       -- zakt het voorstel weg bij iets wat je om de week neemt.
       round(p.totaal_aantal / nullif(p.keer, 0), 1) as gemiddeld,
       round(100.0 * p.keer / nullif(l.dagen, 0))    as hoe_vaak_pct,
       p.laatst_besteld,
       p.laatste_prijs
  from per_artikel p
  join leverdagen l using (dagnr)
  left join inkoop.leveranciers lev on lev.id = p.leverancier_id;

comment on view inkoop.bestelpatroon is
  'Wat er per weekdag wordt besteld, over de laatste twaalf weken. Telt wat er is gebeurd; stelt zelf niets voor.';
