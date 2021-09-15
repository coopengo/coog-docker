DO $$

DECLARE
-- Les variables suivantes ne seront pas prises en compte si la personne morale est souscriptrice d'un contrat

-- Variable qui indique si l'on doit anonymiser les personnes morales.
-- true : Indique que les personnes morales seront anonymisées
    anonymize_companies boolean := true;
-- Variable qui indique si l'on doit garder la raison sociale des personnes morales.
-- true : Indique que le nom sera gardé en clair dans la base même si le reste des informations est anonymisé
    keep_company_name boolean := false;

-- Ne pas modifier les variables sous ce commentaire
    anon_parties_where_clause text := 'id: not in :(select party from bank union select party from insurer)';
    anon_only_persons_where_clause text := 'id: not in :(select id from party_party where not is_person)';
    anon_party_names_where_clause text := '';
    col_test integer := 0;

BEGIN

    if not anonymize_companies then
        anon_parties_where_clause := anon_only_persons_where_clause;
    end if;
    PERFORM anon_table('party_party', 'code, first_name, commercial_name, birth_name, sepa_creditor_identifier', 'siren', anon_parties_where_clause);
    if keep_company_name then
        anon_party_names_where_clause := anon_party_names_where_clause || ';' || anon_only_persons_where_clause;
    end if;
    PERFORM anon_table('party_party', 'name', '', anon_party_names_where_clause);
    -- Anonymize all parties which are subscribers regardless of  the previous rules
    PERFORM anon_table('party_party', 'name, first_name, commercial_name, birth_name, sepa_creditor_identifier', 'siren', 'id: in :(select subscriber from contract)');
    alter table party_party drop constraint if exists "party_party_SSN_uniq_all";
    col_test := col_exist('party_party', 'ssn');
    if col_test > 0 then
        update party_party set ssn = '160754612101120';
    end if;

    PERFORM anon_table('party_contact_mechanism', 'value, value_compact');
    PERFORM anon_table('party_address', 'street, name, party_name', 'siret_nic');
    PERFORM anon_table('party_identifier', 'code');
    PERFORM anon_table('contract', 'contract_number, quote_number');
    PERFORM anon_table('contract_option_beneficiary', 'reference');
    PERFORM anon_table('contract_clause', 'text');
    PERFORM anon_table('contract_option', 'customized_beneficiary_clause');
    PERFORM anon_table('report_template', 'email_dest, email_bcc, email_cc');
    PERFORM anon_table('res_user', 'name', 'email', 'id: not in :(select "user" from "res_user-res_group" where "group" not in (select id from res_group where name=''Coog Do Not Anonymize''))');
    PERFORM anon_table('claim_ij_subscription', 'ssn');
    update res_user set login = md5(login) where login != 'admin';
    update res_user set password_hash = '$pbkdf2-sha512$25000$9J7T2rtXKiUE4PwfY.x9Tw$Of5naHuwI71tuLLZluyq0dA.X4yq5fewhDImuzaDkVYnmAHKeIyLvOqLIgWB34m5SlFHOCyQd9CHD9ISQ/TE9g' where login = 'admin';
    PERFORM anon_table('ir_attachment', 'name', 'data');
    PERFORM anon_table('account_invoice', '', 'comment, description');
    PERFORM anon_table('account_invoice_line', 'description');
    PERFORM anon_table('account_statement_line', '', 'description');
    PERFORM anon_table('account_payment', '', 'description');

END $$;
