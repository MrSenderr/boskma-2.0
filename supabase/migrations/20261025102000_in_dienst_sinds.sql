-- "In dienst sinds" los van "dit contract begon op".
--
-- Het veld ingangsdatum op de persoonskaart betekende twee dingen tegelijk:
-- wanneer iemand bij Boskma begon, en wanneer zijn huidige contract inging.
-- Bij de meesten is dat hetzelfde, maar niet bij wie is overgenomen:
--
--   Denzel  in dienst sinds 15-03-2023, contract bij Kai van 25-03-2026
--   Ilona   in dienst sinds 01-04-2019, contract bij Kai van 25-05-2025
--
-- Voor de ketenregeling en de twaalf maanden oproep telt de eerste datum, voor
-- het aanzeggen de tweede. Zolang ze op één hoop liggen klopt er altijd één
-- van de twee niet.
--
-- Vanaf hier: in_dienst_sinds hoort bij de persoon, de contractdatums staan in
-- public.contracten.

alter table public.sollicitaties add column if not exists in_dienst_sinds date;

update public.sollicitaties
   set in_dienst_sinds = ingangsdatum
 where in_dienst_sinds is null and ingangsdatum is not null;

comment on column public.sollicitaties.in_dienst_sinds is
  'De dag dat deze persoon bij Boskma begon, ook als dat onder de vorige eigenaar was. Telt voor de ketenregeling en de twaalf maanden oproep.';

comment on column public.sollicitaties.ingangsdatum is
  'VERVALT. Was de begindatum van het lopende contract; die staat nu in public.contracten. Gebruik in_dienst_sinds voor de startdatum van de persoon. Blijft staan tot alle schermen zijn omgezet.';

/* Het lopende contract per medewerker, voor schermen die er maar één nodig
   hebben.
 *
 * Loopt er vandaag niets meer — het contract is afgelopen en er is nog geen
 * nieuw — dan geeft de view het laatst bekende terug met loopt = false. Dat is
 * bruikbaarder dan niets: je wilt juist zien wat er wás toen het afliep.
 *
 * security_invoker, net als de andere views: leest met de rechten van wie het
 * opvraagt, dus de regels op contracten blijven gelden. */
create view public.huidig_contract with (security_invoker = true) as
select distinct on (c.medewerker_id)
       c.medewerker_id,
       c.id as contract_id,
       c.werkgever,
       c.soort,
       c.duur,
       c.begint,
       c.eindigt,
       c.uren_vast,
       c.uren_min,
       c.uren_max,
       c.uurloon,
       c.functie,
       c.proefperiode,
       c.beeindigd_op,
       (c.begint <= current_date
        and (c.eindigt is null or c.eindigt >= current_date)
        and c.beeindigd_op is null) as loopt
  from public.contracten c
 order by c.medewerker_id,
          (c.begint <= current_date
           and (c.eindigt is null or c.eindigt >= current_date)
           and c.beeindigd_op is null) desc,
          c.begint desc;

comment on view public.huidig_contract is
  'Het lopende contract per medewerker, of anders het laatst bekende (loopt = false).';

grant select on public.huidig_contract to authenticated;

notify pgrst, 'reload schema';
