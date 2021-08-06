# Migration Quotations to SalesRoutes

This container will get quotations saved on Redis, transform them to SalesRoutes, if possible add the user that created them, and will import them to MongoDB.

- [Migration Quotations to SalesRoutes](#migration-quotations-to-salesroutes)
  - [Start migration](#start-migration)
  - [Build container](#build-container)
  - [Run container](#run-container)
  - [Docker compose](#docker-compose)
  - [Environment variables](#environment-variables)
  - [Test transform](#test-transform)

## Start migration

You can start a migration by
- [Building the container](#build-container) and then [running it](#run-container)
- [Docker compose](#docker-compose)

## Build container

```
docker build . -t coopengohub/migrquot2sr
docker push coopengohub/migrquot2sr:latest (optional in local)
```

## Run container

```
docker run coopengohub/migrquot2sr
```

## Docker compose

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

## Environment variables

Theses are the mandatory environment variables:

- `COOG_DB_NAME`: Database name for coog (default is `coog`)
- `REDIS_DB`: Redis database number (default is `7`)
- `REDIS_URL`: Redis url (default is `redis://redis:6379`)
- `MONGO_URL`: Mongo host (default is `mongo`)
- `MONGO_USER`: Mongo user (default is `coog`)
- `MONGO_PASSWORD`: Mongo password (default is `coog`)
- `MONGO_API_DB`: Mongo database used by API (default is `coog-gateway`)
- `MONGO_IDENTITY_DB`: Mongo database used by Identity (default is `coog-gateway`)

## Test transform

The transformation of quotations to salesroutes can be tested with:

```
yarn start:test
```

A [test file](./src/test/quotations.json) is present with some quotations, but you can freely edit it to add new/tricky/problematic quotations.
