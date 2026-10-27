-- Wie er kan, en wie niet
--
-- Het verdeelalgoritme voor de spits staat er al: werkplekken, wie waar het
-- beste staat, hoe belangrijk een plek is. Wat ontbrak is het eerste wat je
-- moet weten voordat je iemand indeelt — of hij er die dag überhaupt is.
--
-- Drie dingen bepalen dat, en eitje weet ze alle drie: wat iemand zelf heeft
-- opgegeven, of hij verlof heeft, en of hij ziek is. Ze komen uit drie
-- endpoints en landen hier in twee tabellen, want het zijn twee vormen:
-- beschikbaarheid is een losse dag met een oordeel erover, verlof en ziekte
-- zijn periodes. Die door elkaar husselen geeft een tabel waarin de helft van
-- de kolommen altijd leeg staat.
--
-- Ook voor de meewerkend eigenaar. Die vult zijn eigen beschikbaarheid en
-- verlof in eitje in, net als de rest, en gaat hier dus door dezelfde molen.
-- Een uitzondering voor de baas is precies waar dit soort code gaat rammelen.

-- 1. Wat iemand zelf heeft opgegeven ------------------------------------------

CREATE TABLE IF NOT EXISTS public.beschikbaarheid (
  bron_id        text PRIMARY KEY,
  datum          date NOT NULL,
  -- "available" of "unavailable" zoals eitje het schrijft. Met opzet geen
  -- CHECK: komt er een derde waarde bij, dan hoort die ingelezen te worden en
  -- zichtbaar te zijn, niet geweigerd.
  status         text,
  -- De reden die hij er zelf bij typte ("bruiloft"). Daar staat soms meer in
  -- dan in de status: "kan wel maar liever niet tot 20 uur".
  opmerking      text,
  naam           text,
  eitje_user_id  integer,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE SET NULL,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beschikbaarheid_datum_idx
  ON public.beschikbaarheid (datum);
CREATE INDEX IF NOT EXISTS beschikbaarheid_medewerker_idx
  ON public.beschikbaarheid (medewerker_id, datum);

-- 2. Verlof en ziekte ----------------------------------------------------------
--
-- `tot` mag leeg zijn en dat betekent: loopt nog. Eitje geeft een ziekmelding
-- zonder einddatum terug zolang hij loopt, ook als je een latere week opvraagt.
-- Zou hier de begindag worden ingevuld, dan stond iemand die al drie weken ziek
-- thuis zit vanaf dag twee weer als inzetbaar in het rooster.
--
-- Wie hieruit leest moet dus `van <= dag AND (tot IS NULL OR tot >= dag)`
-- vragen, en niet `BETWEEN`.

CREATE TABLE IF NOT EXISTS public.afwezigheid (
  -- Verlof 21 en ziekmelding 21 bestaan naast elkaar: twee lijsten, twee
  -- nummerreeksen. Vandaar het soort in de sleutel.
  bron_id        text PRIMARY KEY,
  soort          text NOT NULL CHECK (soort IN ('verlof', 'ziek')),
  van            date NOT NULL,
  tot            date,
  -- Bij verlof: accepted, pending. Bij ziekte: loopt of afgerond.
  status         text,
  reden          text,
  naam           text,
  eitje_user_id  integer,
  medewerker_id  uuid REFERENCES public.sollicitaties(id) ON DELETE SET NULL,
  bijgewerkt_op  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS afwezigheid_periode_idx
  ON public.afwezigheid (van, tot);
CREATE INDEX IF NOT EXISTS afwezigheid_medewerker_idx
  ON public.afwezigheid (medewerker_id, van);

-- 3. Wie mag wat ---------------------------------------------------------------
-- Zelfde regels als bij het rooster: beheer ziet alles, een medewerker alleen
-- zichzelf. Dat iemand verlof heeft of ziek is, is niet andermans zaak.

ALTER TABLE public.beschikbaarheid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afwezigheid     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.beschikbaarheid FROM anon;
REVOKE ALL ON public.afwezigheid     FROM anon;

DROP POLICY IF EXISTS app_gebruiker ON public.beschikbaarheid;
CREATE POLICY app_gebruiker ON public.beschikbaarheid
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS app_gebruiker ON public.afwezigheid;
CREATE POLICY app_gebruiker ON public.afwezigheid
  FOR ALL TO authenticated
  USING (public.is_app_user()) WITH CHECK (public.is_app_user());

DROP POLICY IF EXISTS eigen_opgave ON public.beschikbaarheid;
CREATE POLICY eigen_opgave ON public.beschikbaarheid
  FOR SELECT TO authenticated
  USING (medewerker_id IS NOT NULL AND medewerker_id = public.huidige_medewerker());

DROP POLICY IF EXISTS eigen_afwezigheid ON public.afwezigheid;
CREATE POLICY eigen_afwezigheid ON public.afwezigheid
  FOR SELECT TO authenticated
  USING (medewerker_id IS NOT NULL AND medewerker_id = public.huidige_medewerker());

NOTIFY pgrst, 'reload schema';
