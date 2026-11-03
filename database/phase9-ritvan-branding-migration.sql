-- Ritvan POS Phase 9: rebrand the default stored business name safely.
-- Run against ritvan_pos after importing an existing Nexora POS database.
-- Only the untouched default is changed; custom business names remain unchanged.
USE ritvan_pos;

UPDATE business_settings
SET business_name = 'Ritvan Store'
WHERE id = 1 AND business_name = 'Nexora Store';

SELECT 'Phase 9 Ritvan POS branding migration completed' AS migration_status;
