CREATE OR REPLACE FUNCTION col_exist(table_name text, col text) RETURNS integer as $$
DECLARE
    test text;
BEGIN
    if col is null then
        RETURN 0;
    end if;
    EXECUTE 'select ' || col || ' from ' || table_name || ' limit 1' INTO test;
    RETURN 1;
EXCEPTION
    WHEN undefined_column THEN
        RAISE NOTICE 'the column % does not exist, ignoring' , col;
        RETURN 0;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION table_exist(table_name text) RETURNS integer as $$
DECLARE
    test text;
BEGIN
    if table_name is null then
        RETURN 0;
    end if;
    EXECUTE 'select * from ' || table_name || ' limit 1 ' INTO test;
    RETURN 1;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'the table % does not exist, ignoring' , table_name;
        RETURN 0;
END
$$ LANGUAGE plpgsql;

/* Arguments:
    * table name
    * list of fields to md5 (ex: "field1, field2")
    * list of fields to set null
    * where clause ("field_name:operator:value")
*/

CREATE OR REPLACE FUNCTION anon_table(table_name text, cols text default '', nulcolls text DEFAULT '', where_meta text DEFAULT '') RETURNS integer as $$
DECLARE
    cols_list text[];
    cols_md5_statement text := '';
    null_cols_list text[];
    null_cols_statement text := '';
    i int;
    j int;
    k int;
    col_test integer;
    table_test integer;
    history_table text := table_name || '__history';
    history_exist integer;
    where_statement text := '';
    where_tab text[];
    where_values text[];
    set_cols_statement text;
BEGIN
    table_test := table_exist(table_name);
    history_exist := table_exist(history_table);
    if table_test < 1 then
        RETURN 0;
    end if;
    select string_to_array(cols, ',') into cols_list;
    select string_to_array(nulcolls, ',') into null_cols_list;
    select string_to_array(where_meta, ';') into where_tab;
    k := 1;
    loop
        if where_tab = '{}' then
            EXIT;
        end if;
        if k > array_upper(where_tab, 1) then
            EXIT;
        else
            select string_to_array(where_tab[k], ':') into where_values;
            col_test := col_exist(table_name, where_values[1]);
            if col_test > 0 then
                if char_length(where_statement) > 0 then
                    where_statement := where_statement || ' and ';
                end if;
                where_statement := where_statement || where_values[1] || where_values[2] || where_values[3];
            end if;
            k := k+1;
        end if;
    end loop;
    if char_length(where_statement) > 0 then
        where_statement = ' WHERE ' || where_statement;
    end if;
    i := 1;
    loop
        if cols_list = '{}' then
            EXIT;
        end if;
        if i > array_upper(cols_list, 1) then
            EXIT;
        else
            col_test := col_exist(table_name, cols_list[i]);
            if col_test > 0 then
                cols_md5_statement := cols_md5_statement || cols_list[i] || '=md5(' || cols_list[i] || '),';
            end if;
            i := i + 1;
        end if;
    end loop;
    j := 1;
    loop
        if null_cols_list = '{}' then
            EXIT;
        end if;
        if j > array_upper(null_cols_list, 1) then
            EXIT;
        else
            col_test := col_exist(table_name, null_cols_list[j]);
            if col_test > 0 then
                null_cols_statement := null_cols_statement || null_cols_list[j]   || ' = null,';
            end if;
            j := j + 1;
        end if;
    end loop;
    if char_length(null_cols_statement) > 0 or char_length(cols_md5_statement) > 0 then
        set_cols_statement := ' set ' || cols_md5_statement || null_cols_statement;
        set_cols_statement := trim(trailing ',' from set_cols_statement);
        EXECUTE 'update ' || table_name || set_cols_statement || where_statement || ';';
        if history_exist > 0 then
            EXECUTE 'update ' || history_table || set_cols_statement || where_statement || ';';
        end if;
    end if;
    RAISE NOTICE  'anonymized table % ', table_name;
    RETURN 0;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION anon_db() RETURNS void as $$
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
    PERFORM anon_table('res_user', 'name', 'email', 'id: not in :(select id from res_user where login = ''admin'');id: not in :(select "user" from "res_user-res_group" where "group" in (select id from res_group where name=''Coog Do Not Anonymize''))');
    PERFORM anon_table('claim_ij_subscription', 'ssn');
    update res_user set login = md5(login) where login != 'admin';
    -- Set admin user's password to 'admin' when anonymizing a database. We hardcoded this hash that was generated by trytond-admin as postgres doesn't have sha1 hashing by default.
    update res_user set password_hash = '$pbkdf2-sha512$25000$9J7T2rtXKiUE4PwfY.x9Tw$Of5naHuwI71tuLLZluyq0dA.X4yq5fewhDImuzaDkVYnmAHKeIyLvOqLIgWB34m5SlFHOCyQd9CHD9ISQ/TE9g' where login = 'admin';
    PERFORM anon_table('ir_attachment', 'name', 'data');
    PERFORM anon_table('account_invoice', '', 'comment, description');
    PERFORM anon_table('account_invoice_line', 'description');
    PERFORM anon_table('account_statement_line', '', 'description');
    PERFORM anon_table('account_payment', '', 'description');

END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    PERFORM anon_db();
END;
$$;

drop function anon_db();
drop function col_exist(text, text);
drop function table_exist(text);
drop function anon_table(text, text, text, text);
