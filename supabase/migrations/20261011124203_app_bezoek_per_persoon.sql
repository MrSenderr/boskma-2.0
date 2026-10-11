-- Het bezoek gekoppeld aan de persoon, zodat het scherm geen mailadressen
-- nodig heeft.
--
-- De personeelslijst haalt expres niet alle velden op — e-mail hoort niet in
-- een overzicht. Koppelen op mailadres in de app kon dus nooit werken. Hier
-- gebeurt het koppelen, en de app krijgt alleen een persoon_id terug.
--
-- security_invoker: leest met de rechten van wie het opvraagt, dus de regels
-- op app_bezoek (alleen Sander) blijven gelden.

create view public.app_bezoek_persoon with (security_invoker = true) as
  select s.id as persoon_id,
         b.eerst_gezien,
         b.laatst_gezien,
         b.dagen
    from public.app_bezoek b
    join public.sollicitaties s on lower(s.email) = b.email;

grant select on public.app_bezoek_persoon to authenticated;

notify pgrst, 'reload schema';;
