-- De laatste drie verwijzingen van het inkoopschema; die vielen buiten de
-- vorige migratie.

ALTER TABLE ONLY inkoop.samenstelling_regels
    ADD CONSTRAINT samenstelling_regels_leverancier_id_fkey FOREIGN KEY (leverancier_id) REFERENCES inkoop.leveranciers(id);
ALTER TABLE ONLY inkoop.samenstelling_regels
    ADD CONSTRAINT samenstelling_regels_onderdeel_id_fkey FOREIGN KEY (onderdeel_id) REFERENCES inkoop.samenstellingen(id) ON DELETE RESTRICT;
ALTER TABLE ONLY inkoop.samenstelling_regels
    ADD CONSTRAINT samenstelling_regels_samenstelling_id_fkey FOREIGN KEY (samenstelling_id) REFERENCES inkoop.samenstellingen(id) ON DELETE CASCADE;;
