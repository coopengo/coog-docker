# Script d'anonymisation

Pour anonymiser une base de donnée, suivez les étapes suivantes :  

```sh
# Créer une copie de la base à anonymiser

PG_USER=<nom_de_l_utilisateur>
COPY=<nom_de_la_copie>
DB_NAME=<nom_de_la_db>

createdb -e -U $PG_USER DB_COPY -T DB_NAME
psql -U <nom_de_l'utilisateur> -d <nom_de_la_copie> 2>&1 /dev/null << cat anonymize_recette.sql

# Création d'un dump de la base
pg_dump -U $PG_USER -d $COPY -Fc > $COPY.dump
dropdb -e -U $PG_USER $COPY
```
