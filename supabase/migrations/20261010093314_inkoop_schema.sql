-- Inkoopadministratie: het schema zoals het in de losse inkoop-app stond.
--
-- Overgenomen uit een pg_dump van boskma-db, zodat de twee applicaties op
-- dezelfde gegevens gaan werken. Alleen de structuur; de gegevens zijn apart
-- ingeladen. Constraints en indexen volgen na de gegevens, net als in de dump:
-- backorders staat alfabetisch voor documenten en zou anders op zijn
-- verwijzing stuklopen.
--
-- De view draait met de rechten van wie hem bevraagt, anders zou hij straks
-- langs de beveiliging op de tabellen heen lezen.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.6


--
-- Name: inkoop; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA inkoop;




--
-- Name: artikel_alias; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.artikel_alias (
    leverancier_id integer NOT NULL,
    van text NOT NULL,
    naar text NOT NULL
);


--
-- Name: assortiment; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.assortiment (
    leverancier_id integer NOT NULL,
    artikelnr text NOT NULL,
    omschrijving text,
    groep text,
    inhoud text,
    bestelartikel boolean DEFAULT false NOT NULL,
    levertijd_dagen smallint
);


--
-- Name: backorders; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.backorders (
    id integer NOT NULL,
    document_id integer NOT NULL,
    artikelnr text NOT NULL,
    omschrijving text,
    aantal numeric(10,3),
    nageleverd_op date
);


--
-- Name: backorders_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.backorders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backorders_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.backorders_id_seq OWNED BY inkoop.backorders.id;


--
-- Name: documenten; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.documenten (
    id integer NOT NULL,
    leverancier_id integer NOT NULL,
    soort text NOT NULL,
    nummer text NOT NULL,
    datum date,
    afleverdatum date,
    referentie text,
    bestandsnaam text,
    bestand_hash text NOT NULL,
    opslagpad text,
    mail_bericht_id text,
    status text DEFAULT 'nieuw'::text NOT NULL,
    melding text,
    som_regels numeric(10,2),
    btw numeric(10,2),
    totaal_incl numeric(10,2),
    verschil numeric(10,2),
    extractie_model text,
    ontvangen timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documenten_soort_check CHECK ((soort = ANY (ARRAY['factuur'::text, 'orderbevestiging'::text]))),
    CONSTRAINT documenten_status_check CHECK ((status = ANY (ARRAY['nieuw'::text, 'verwerkt'::text, 'controleren'::text, 'afgekeurd'::text])))
);


--
-- Name: documenten_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.documenten_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documenten_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.documenten_id_seq OWNED BY inkoop.documenten.id;


--
-- Name: leveranciers; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.leveranciers (
    id integer NOT NULL,
    naam text NOT NULL,
    debiteurnr text,
    profiel text NOT NULL,
    mail_afzender text,
    vaste_leverdagen smallint[] DEFAULT '{2,4}'::smallint[],
    actief boolean DEFAULT true NOT NULL,
    artikel_url text
);


--
-- Name: regels; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.regels (
    id integer NOT NULL,
    document_id integer NOT NULL,
    regelnr integer,
    afleverdatum date,
    leveringsnr text,
    referentie text,
    artikelnr text NOT NULL,
    omschrijving text,
    merk text,
    inhoud text,
    aantal numeric(10,3) NOT NULL,
    eenheid text,
    prijs numeric(10,4),
    bedrag numeric(10,2) NOT NULL,
    btw_pct smallint,
    soort text DEFAULT 'Levering'::text NOT NULL,
    CONSTRAINT regels_soort_check CHECK ((soort = ANY (ARRAY['Levering'::text, 'Emballage'::text, 'Retour/credit'::text, 'Gratis'::text])))
);


--
-- Name: factuurregels; Type: VIEW; Schema: inkoop; Owner: -
--

CREATE VIEW inkoop.factuurregels WITH (security_invoker = true) AS
 SELECT r.id,
    r.document_id,
    r.regelnr,
    r.afleverdatum,
    r.leveringsnr,
    r.referentie,
    r.artikelnr,
    r.omschrijving,
    r.merk,
    r.inhoud,
    r.aantal,
    r.eenheid,
    r.prijs,
    r.bedrag,
    r.btw_pct,
    r.soort,
    COALESCE(al.naar, r.artikelnr) AS artikelnr_norm,
    (r.omschrijving ~~* 'ACTIE%'::text) AS actie,
    COALESCE(a.omschrijving, r.omschrijving) AS artikelnaam,
    COALESCE(r.inhoud, a.inhoud) AS artikelinhoud,
    (a.artikelnr IS NOT NULL) AS op_bestellijst,
    a.bestelartikel,
    a.groep,
    d.leverancier_id,
    lv.naam AS leveranciernaam,
    d.nummer AS factuurnummer,
    d.datum AS factuurdatum
   FROM ((((inkoop.regels r
     JOIN inkoop.documenten d ON ((d.id = r.document_id)))
     JOIN inkoop.leveranciers lv ON ((lv.id = d.leverancier_id)))
     LEFT JOIN inkoop.artikel_alias al ON (((al.leverancier_id = d.leverancier_id) AND (al.van = r.artikelnr))))
     LEFT JOIN inkoop.assortiment a ON (((a.leverancier_id = d.leverancier_id) AND (a.artikelnr = COALESCE(al.naar, r.artikelnr)))))
  WHERE ((d.soort = 'factuur'::text) AND (d.status = 'verwerkt'::text));


--
-- Name: foodcost_doelen; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.foodcost_doelen (
    groep text NOT NULL,
    doel numeric(4,3) NOT NULL,
    toelichting text,
    CONSTRAINT foodcost_doelen_doel_check CHECK (((doel > (0)::numeric) AND (doel <= (1)::numeric)))
);


--
-- Name: instellingen; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.instellingen (
    sleutel text NOT NULL,
    waarde text NOT NULL
);


--
-- Name: leveranciers_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.leveranciers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leveranciers_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.leveranciers_id_seq OWNED BY inkoop.leveranciers.id;


--
-- Name: mail_log; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.mail_log (
    id integer NOT NULL,
    tijd timestamp with time zone DEFAULT now() NOT NULL,
    bestandsnaam text,
    afzender text,
    onderwerp text,
    status text NOT NULL,
    melding text,
    document_id integer,
    leverancier_id integer,
    nummer text
);


--
-- Name: mail_log_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.mail_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mail_log_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.mail_log_id_seq OWNED BY inkoop.mail_log.id;


--
-- Name: regels_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.regels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regels_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.regels_id_seq OWNED BY inkoop.regels.id;


--
-- Name: samenstelling_regels; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.samenstelling_regels (
    id integer NOT NULL,
    samenstelling_id integer NOT NULL,
    volgorde integer DEFAULT 0 NOT NULL,
    leverancier_id integer,
    artikelnr text,
    onderdeel_id integer,
    hoeveelheid numeric(10,4) NOT NULL,
    eenheid text DEFAULT 'stuk'::text NOT NULL,
    notitie text,
    CONSTRAINT samenstelling_regels_check CHECK ((((artikelnr IS NOT NULL) AND (leverancier_id IS NOT NULL) AND (onderdeel_id IS NULL)) OR ((artikelnr IS NULL) AND (onderdeel_id IS NOT NULL)))),
    CONSTRAINT samenstelling_regels_eenheid_check CHECK ((eenheid = ANY (ARRAY['stuk'::text, 'gram'::text, 'kilo'::text, 'ml'::text, 'liter'::text, 'verpakking'::text, 'portie'::text]))),
    CONSTRAINT samenstelling_regels_hoeveelheid_check CHECK ((hoeveelheid > (0)::numeric))
);


--
-- Name: samenstelling_regels_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.samenstelling_regels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: samenstelling_regels_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.samenstelling_regels_id_seq OWNED BY inkoop.samenstelling_regels.id;


--
-- Name: samenstellingen; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.samenstellingen (
    id integer NOT NULL,
    naam text NOT NULL,
    groep text,
    opbrengst numeric(10,3) DEFAULT 1 NOT NULL,
    eenheidnaam text DEFAULT 'portie'::text NOT NULL,
    verkoopprijs numeric(10,2),
    btw_pct smallint DEFAULT 9 NOT NULL,
    prijs_bron text DEFAULT 'handmatig'::text NOT NULL,
    mplus_id text,
    vet_opslag boolean DEFAULT false NOT NULL,
    doel_foodcost numeric(4,3),
    notitie text,
    gewijzigd timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT samenstellingen_opbrengst_check CHECK ((opbrengst > (0)::numeric)),
    CONSTRAINT samenstellingen_prijs_bron_check CHECK ((prijs_bron = ANY (ARRAY['handmatig'::text, 'mplus'::text])))
);


--
-- Name: samenstellingen_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.samenstellingen_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: samenstellingen_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.samenstellingen_id_seq OWNED BY inkoop.samenstellingen.id;


--
-- Name: uitzonderingen; Type: TABLE; Schema: inkoop; Owner: -
--

CREATE TABLE inkoop.uitzonderingen (
    id integer NOT NULL,
    naam text NOT NULL,
    van date NOT NULL,
    tot date NOT NULL,
    inkoop_van date NOT NULL,
    inkoop_tot date NOT NULL,
    toelichting text
);


--
-- Name: uitzonderingen_id_seq; Type: SEQUENCE; Schema: inkoop; Owner: -
--

CREATE SEQUENCE inkoop.uitzonderingen_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uitzonderingen_id_seq; Type: SEQUENCE OWNED BY; Schema: inkoop; Owner: -
--

ALTER SEQUENCE inkoop.uitzonderingen_id_seq OWNED BY inkoop.uitzonderingen.id;


--
-- Name: backorders id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.backorders ALTER COLUMN id SET DEFAULT nextval('inkoop.backorders_id_seq'::regclass);


--
-- Name: documenten id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.documenten ALTER COLUMN id SET DEFAULT nextval('inkoop.documenten_id_seq'::regclass);


--
-- Name: leveranciers id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.leveranciers ALTER COLUMN id SET DEFAULT nextval('inkoop.leveranciers_id_seq'::regclass);


--
-- Name: mail_log id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.mail_log ALTER COLUMN id SET DEFAULT nextval('inkoop.mail_log_id_seq'::regclass);


--
-- Name: regels id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.regels ALTER COLUMN id SET DEFAULT nextval('inkoop.regels_id_seq'::regclass);


--
-- Name: samenstelling_regels id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.samenstelling_regels ALTER COLUMN id SET DEFAULT nextval('inkoop.samenstelling_regels_id_seq'::regclass);


--
-- Name: samenstellingen id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.samenstellingen ALTER COLUMN id SET DEFAULT nextval('inkoop.samenstellingen_id_seq'::regclass);


--
-- Name: uitzonderingen id; Type: DEFAULT; Schema: inkoop; Owner: -
--

ALTER TABLE ONLY inkoop.uitzonderingen ALTER COLUMN id SET DEFAULT nextval('inkoop.uitzonderingen_id_seq'::regclass);


--
-- Data for Name: artikel_alias; Type: TABLE DATA; Schema: inkoop; Owner: -
--
