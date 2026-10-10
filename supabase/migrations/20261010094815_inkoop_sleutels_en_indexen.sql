-- Sleutels, verwijzingen en indexen van het inkoopschema.
--
-- Deze draaien ná de gegevens, net als in de dump: backorders verwijst naar
-- documenten en staat er alfabetisch voor, dus andersom loopt het vast.
-- De tellers staan op de laatst gebruikte nummers, anders begint een nieuwe
-- factuur weer bij 1 en botst hij op een bestaande.

SELECT pg_catalog.setval('inkoop.backorders_id_seq', 1, false);
SELECT pg_catalog.setval('inkoop.documenten_id_seq', 17, true);
SELECT pg_catalog.setval('inkoop.leveranciers_id_seq', 104, true);
SELECT pg_catalog.setval('inkoop.mail_log_id_seq', 10, true);
SELECT pg_catalog.setval('inkoop.regels_id_seq', 1253, true);
SELECT pg_catalog.setval('inkoop.samenstelling_regels_id_seq', 1, true);
SELECT pg_catalog.setval('inkoop.samenstellingen_id_seq', 1, true);
SELECT pg_catalog.setval('inkoop.uitzonderingen_id_seq', 1, true);

ALTER TABLE ONLY inkoop.artikel_alias
    ADD CONSTRAINT artikel_alias_pkey PRIMARY KEY (leverancier_id, van);
ALTER TABLE ONLY inkoop.assortiment
    ADD CONSTRAINT assortiment_pkey PRIMARY KEY (leverancier_id, artikelnr);
ALTER TABLE ONLY inkoop.backorders
    ADD CONSTRAINT backorders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.documenten
    ADD CONSTRAINT documenten_bestand_hash_key UNIQUE (bestand_hash);
ALTER TABLE ONLY inkoop.documenten
    ADD CONSTRAINT documenten_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.foodcost_doelen
    ADD CONSTRAINT foodcost_doelen_pkey PRIMARY KEY (groep);
ALTER TABLE ONLY inkoop.instellingen
    ADD CONSTRAINT instellingen_pkey PRIMARY KEY (sleutel);
ALTER TABLE ONLY inkoop.leveranciers
    ADD CONSTRAINT leveranciers_naam_key UNIQUE (naam);
ALTER TABLE ONLY inkoop.leveranciers
    ADD CONSTRAINT leveranciers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.mail_log
    ADD CONSTRAINT mail_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.regels
    ADD CONSTRAINT regels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.samenstelling_regels
    ADD CONSTRAINT samenstelling_regels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.samenstellingen
    ADD CONSTRAINT samenstellingen_naam_key UNIQUE (naam);
ALTER TABLE ONLY inkoop.samenstellingen
    ADD CONSTRAINT samenstellingen_pkey PRIMARY KEY (id);
ALTER TABLE ONLY inkoop.uitzonderingen
    ADD CONSTRAINT uitzonderingen_pkey PRIMARY KEY (id);

CREATE INDEX idx_doc_datum ON inkoop.documenten USING btree (datum);
CREATE INDEX idx_doc_ref ON inkoop.documenten USING btree (referentie);
CREATE INDEX idx_maillog_tijd ON inkoop.mail_log USING btree (tijd DESC);
CREATE INDEX idx_regels_afl ON inkoop.regels USING btree (afleverdatum);
CREATE INDEX idx_regels_art ON inkoop.regels USING btree (artikelnr);
CREATE INDEX idx_regels_samenstelling ON inkoop.samenstelling_regels USING btree (samenstelling_id);
CREATE UNIQUE INDEX uq_doc_nummer ON inkoop.documenten USING btree (leverancier_id, soort, nummer);

ALTER TABLE ONLY inkoop.artikel_alias
    ADD CONSTRAINT artikel_alias_leverancier_id_fkey FOREIGN KEY (leverancier_id) REFERENCES inkoop.leveranciers(id);
ALTER TABLE ONLY inkoop.assortiment
    ADD CONSTRAINT assortiment_leverancier_id_fkey FOREIGN KEY (leverancier_id) REFERENCES inkoop.leveranciers(id);
ALTER TABLE ONLY inkoop.backorders
    ADD CONSTRAINT backorders_document_id_fkey FOREIGN KEY (document_id) REFERENCES inkoop.documenten(id) ON DELETE CASCADE;
ALTER TABLE ONLY inkoop.documenten
    ADD CONSTRAINT documenten_leverancier_id_fkey FOREIGN KEY (leverancier_id) REFERENCES inkoop.leveranciers(id);
ALTER TABLE ONLY inkoop.mail_log
    ADD CONSTRAINT mail_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES inkoop.documenten(id) ON DELETE SET NULL;
ALTER TABLE ONLY inkoop.mail_log
    ADD CONSTRAINT mail_log_leverancier_id_fkey FOREIGN KEY (leverancier_id) REFERENCES inkoop.leveranciers(id);
ALTER TABLE ONLY inkoop.regels
    ADD CONSTRAINT regels_document_id_fkey FOREIGN KEY (document_id) REFERENCES inkoop.documenten(id) ON DELETE CASCADE;;
