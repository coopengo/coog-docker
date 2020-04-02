#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE USER coog WITH ENCRYPTED PASSWORD 'coog' LOGIN;
	CREATE DATABASE coog OWNER coog;
        CREATE EXTENSION unaccent;
        CREATE DATABASE coog2 OWNER coog; 
EOSQL
