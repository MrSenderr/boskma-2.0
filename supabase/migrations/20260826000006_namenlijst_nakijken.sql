-- Nakijken of de namenlijst voor de tablet gevuld is
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.wie_werkt_er();
  RAISE NOTICE 'namen in de keuzelijst: %', n;
END $$;
