/* level 0 */
DO $$
BEGIN
PERFORM anon_table('contract', 'contract_number, quote_number');
PERFORM anon_table('party_party', 'code');
END $$;
