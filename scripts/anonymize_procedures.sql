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
