/* level 1 */
DO $$
BEGIN
PERFORM anon_table('bank_account_number', 'number, number_compact');
PERFORM anon_table('party_party', 'zip, code');
PERFORM anon_table('contract_extra_data', '', 'extra_data_values');
PERFORM anon_table('party_party', '', 'extra_data');
PERFORM anon_table('contract_option_version', '', 'extra_data');
PERFORM anon_table('beneficiary_extra_data', '', 'extra_data_values');
PERFORM anon_table('benefit_extra_data', '', 'extra_data_values');
PERFORM anon_table('claim_service_extra_data', '', 'extra_data_values');
PERFORM anon_table('"table"', 'name');
PERFORM anon_table('tag', 'name, code');
PERFORM anon_table('rule_engine', 'name');
PERFORM anon_table('account_payment_sepa_mandate', 'identification');
PERFORM anon_table('distribution_network', 'code, name');
PERFORM anon_table('offered_product', 'name, code');
END $$;
