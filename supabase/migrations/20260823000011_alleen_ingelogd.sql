-- Functies voor ingelogde mensen ook echt op slot voor bezoekers
--
-- Supabase geeft nieuwe functies in het schema public standaard uitvoerrecht aan
-- anon. Een REVOKE ... FROM public haalt dat niet weg, want anon is een eigen rol
-- met een eigen recht. Gevolg: een willekeurige bezoeker kon deze functies
-- aanroepen. Ze weigeren allemaal netjes zelf ("geen toegang") en er lekte dus
-- niets, maar aankloppen hoeft niet te kunnen.
--
-- Wat hier NIET tussen staat: is_app_user() en huidige_medewerker(). Die worden
-- binnen RLS-regels aangeroepen en moeten daar aanroepbaar blijven.

REVOKE EXECUTE ON FUNCTION public.wie_ben_ik()                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.mijn_gegeven_wijzigen(text, text)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.wijziging_afhandelen(bigint, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verslag_reageren(bigint, text, text)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.verslag_gelezen(bigint)               FROM anon;
