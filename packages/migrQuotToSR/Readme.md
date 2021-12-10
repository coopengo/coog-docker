# Migration Quotations to SalesRoutes

This container will get quotations saved on Redis, transform them to SalesRoutes, if possible add the user that created them, and will import them to MongoDB.

- [Migration Quotations to SalesRoutes](#migration-quotations-to-salesroutes)
  - [Start migration](#start-migration)
  - [Build container](#build-container)
  - [Run single container](#run-single-container)
  - [Run with Docker Swarm](#run-with-docker-swarm)
  - [Run with Docker Compose in "standalone"](#run-with-docker-compose-in-standalone)
  - [Environment variables](#environment-variables)
  - [Test transform](#test-transform)

## Start migration

You can start a migration by
- [Building the container](#build-container) and then [running it](#run-container)
- [Docker compose](#docker-compose)

## Build container

```
docker build . -t cooghub/trash:migrquot2sr-V.VV.YYWW
docker push cooghub/trash:migrquot2sr-V.VV.YYWW (optional in local)
```

## Run single container

```
docker run cooghub/trash:migrquot2sr-V.VV.YYWW
```

## Run with Docker Swarm

If your environment runs on Docker with docker-compose, you can add this to your `docker-compose.yml` (with correct [environment variables](#environment-variables), env_file and network):

```
services:
  migrquot2sr:
    build: ${MIGRQUOT2SR_DIR}
    env_file:
      - env_files/migrquot2sr.env
    restart: 'no'
    networks:
      - backend
```

## Run with Docker Compose in "standalone"

- Edit `migrequot2sr.env` file with **needed** values for [environment variables](#environment-variables)
- Put Redis dump `dump.rdb` in `/migration` directory
- Put identities/dist_network CSV file `xxx.csv` in `/migration` directory
- Start the script with `docker-compose up`
- Logs `logs.txt` can be found in `/migration` directory
- Mongo dump `identities.json` and `salesroutes.json` can be found in `/migration` directory

## Environment variables

Theses are the mandatory environment variables:

- `COOG_DB_NAME`: Database name for coog (default is `coog`)
- `REDIS_DB`: Redis database number (default is `7`)
- `REDIS_URL`: Redis url (default is `redis://redis:6379`)
- `MONGO_URL`: Mongo host (default is `mongo`)
- `MONGO_INITDB_ROOT_USERNAME`: Mongo user (default is `coog`)
- `MONGO_INITDB_ROOT_PASSWORD`: Mongo password (default is `coog`)
- `MONGO_API_DB`: Mongo database used by API (default is `coog-gateway`)
- `MONGO_IDENTITY_DB`: Mongo database used by Identity (default is `coog-gateway`)
- `GET_IDENTITIES_FROM`: Load/Import Identities from CSV file or API (default is `csv`) (could be `csv` or `api` (need API Identity Manager))
- `IDENTITIES_FILE_NAME`: If `GET_IDENTITIES_FROM` is set to `csv`, filename to read data from (default is `data.csv`)
- `API_IDENTITY_MANAGER_INTERNAL_URL`: If `GET_IDENTITIES_FROM` is set to `api`, URL to API Identity Manager

## Test transform

The transformation of quotations to salesroutes can be tested with:

```
yarn start:test
```

A [test file](./src/test/quotations.json) is present with some quotations, but you can freely edit it to add new/tricky/problematic quotations.
