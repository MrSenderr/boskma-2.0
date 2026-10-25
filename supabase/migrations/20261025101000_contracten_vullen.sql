-- Wat er nu op de persoonskaarten staat als eerste rij in de contracttabel.
--
-- Elf medewerkers hebben een contract onder Boskma Foodservice; dat wordt
-- één-op-één overgenomen uit wat er op de kaart staat.
--
-- Denzel en Ilona krijgen géén Boskma-contract, want dat hebben ze niet. Zij
-- lopen formeel nog op papier van Kai (zie docs/personeelsdossier.md). Hun
-- ingangsdatum op de kaart is de dag dat ze begonnen, niet de datum van een
-- contract — voor hen gaat alleen de Kai-regel erin, met de datum uit het
-- dossieroverzicht. Dat hun keten daarmee onvolledig is, is geen fout maar de
-- werkelijkheid: er ligt nog geen contract onder de huidige werkgever.

insert into public.contracten (
  medewerker_id, werkgever, soort, duur, begint, eindigt,
  uren_vast, uren_min, uren_max, uurloon, functie, proefperiode,
  bron, opmerking
)
select s.id,
       'boskma',
       case s.contracttype
         when 'Nuluren-overeenkomst (oproep)' then 'nuluren'
         when 'Min-max-overeenkomst'          then 'min_max'
         when 'Vaste uren'                    then 'vaste_uren'
       end,
       s.contractduur,
       s.ingangsdatum,
       case when s.contractduur = 'bepaalde' then s.einddatum end,
       case when s.contracttype = 'Vaste uren' then s.contracturen end,
       s.uren_min,
       s.uren_max,
       s.uurloon,
       s.functie,
       s.proefperiode,
       'overgenomen',
       'Overgenomen van de persoonskaart op 25 oktober 2026.'
  from public.sollicitaties s
 where s.fase = 'medewerker'
   and s.uit_dienst_op is null
   and coalesce(s.is_apparaat, false) = false
   and coalesce(s.is_eigenaar, false) = false
   and s.ingangsdatum is not null
   and s.contracttype in ('Nuluren-overeenkomst (oproep)', 'Min-max-overeenkomst', 'Vaste uren')
   and s.contractduur in ('bepaalde', 'onbepaalde')
   -- Deze twee hebben geen contract onder Boskma; zie hieronder.
   and not (s.voornaam = 'Denzel' and s.achternaam = 'Raven')
   and not (s.voornaam = 'Ilona');

insert into public.contracten (
  medewerker_id, werkgever, soort, duur, begint, uurloon, functie, bron, opmerking
)
select s.id, 'kai', 'nuluren', 'onbepaalde', d.datum, s.uurloon, s.functie, 'overgenomen',
       'Contract bij de vorige eigenaar. Loopt formeel nog op papier van Kai; er is nog geen contract onder Boskma Foodservice.'
  from (values ('Denzel', date '2026-03-25'), ('Ilona', date '2025-05-25')) as d(voornaam, datum)
  join public.sollicitaties s
    on s.voornaam = d.voornaam
   and s.fase = 'medewerker'
   and s.uit_dienst_op is null
   and coalesce(s.is_apparaat, false) = false;
