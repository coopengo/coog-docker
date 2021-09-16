<!-- TOC ignore:true -->
# Coog Docker
<!-- TOC -->

- [Coog Docker](#coog-docker)
  - [Prérequis](#prérequis)
    - [Software/Hardware](#softwarehardware)
    - [Coog-admin DEPRECATED](#coog-admin-deprecated)
    - [Documentation externe](#documentation-externe)
    - [Certificats SSL sur le localhost](#certificats-ssl-sur-le-localhost)
    - [IMPORTANT](#important)
  - [Démarrer coog](#démarrer-coog)
  - [Configuration spécifique client](#configuration-spécifique-client)
  - [Configurer les variables d'environnements](#configurer-les-variables-denvironnements)
    - [Configurer les variables d'environnements **systèmes** : ".env"](#configurer-les-variables-denvironnements-systèmes--env)
    - [Configurer les variables d'environnements **coog** : "./env_files/*"](#configurer-les-variables-denvironnements-coog--env_files)
  - [Mapper le volume avec les bons droits sur le Host](#mapper-le-volume-avec-les-bons-droits-sur-le-host)
  - [Gérer les services](#gérer-les-services)
    - [Démarrer un service spécifique](#démarrer-un-service-spécifique)
    - [Arrêter un service spécifique](#arrêter-un-service-spécifique)
  - [Activer la chaîne de batch : celery daily (à positionner en crontab)](#activer-la-chaîne-de-batch--celery-daily-à-positionner-en-crontab)
  - [Initialisation de la base de données (coog module update)](#initialisation-de-la-base-de-données-coog-module-update)
  - [Scaling de container](#scaling-de-container)
  - [Base de données](#base-de-données)
    - [Backup](#backup)
    - [Restore](#restore)
    - [Anonymiser une base](#anonymiser-une-base)
  - [Installer sentry](#installer-sentry)

<!-- /TOC -->

## Prérequis

### Software/Hardware

- OS : centos 7
- RAM : 16Gb
- CPU : 8 CPU
- HDD : 100Go
- docker-compose : 3.5

- 1 serveur de base de données POSTGRESQL 12 sécurisé et backupé

### Coog-admin DEPRECATED

Dans un souci de standardisation et de simplification de son installation, coog-admin a été déprécié au profit de coog-docker (basé uniquement sur docker et docker-compose).

### Documentation externe

Docker : <https://docs.docker.com/engine/install/centos/>

Docker-compose : <https://docs.docker.com/compose>

### Certificats SSL sur le localhost

    wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64
    sudo mv mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
    sudo chmod +x /usr/local/bin/mkcert
    mkcert -install
    mkcert -cert-file certs/cert.pem -key-file certs/key.pem "coog.localhost"

### IMPORTANT

Les commandes `docker-compose` sont à exécuter à la racine du répertoire coog-docker.

## Démarrer coog

    docker-compose up

OU

    docker-compose up -d #(mode démon)

## Configuration spécifique client

Il faut alimenter le docker-compose.override.yaml à la racine du projet avec les spécificités clientes si besoin.

Ce fichier est automatiquement lu par docker-compose et mergé avec le docker-compose.yaml.

ex: Désactiver les conteneur paybox et changer l'image de référence de coog :

    version: "3"
    
    services:
      paybox:
        image: alpine:latest
        command: "true"
        entrypoint: "true"
      coog:
          image: ${IMAGE_REGISTRY}/coog-client:${IMAGE_VERSION_COOG}

Les autres configurations éditables sont :

- .env              (variables liées au docker-compose.yaml)
- ./env_files/*     (variables liées au container)

## Configurer les variables d'environnements

### Configurer les variables d'environnements **systèmes** : ".env"

Le fichier .env, à la racine du projet coog-docker, contient les données des versions des conteneurs, ainsi que les différentes options systèmes liées à Docker-compose.
Il faut le mettre à jour selon ses besoins (version des conteneurs, nom du projet, DNS du serveur etc).

### Configurer les variables d'environnements **coog** : "./env_files/*"

Il suffit de mettre à jour le contenu des .env présent dans le repertoire env_files.
Le var.env est appelé dans tous les conteneurs coog.
Penser à faire :

    docker-compose up -d

## Mapper le volume avec les bons droits sur le Host

Le répertoire /workspace/io des conteneurs, est mappé avec le répertoire de la machine Host /coog/coog_data
Le répertoire /workspace/tmp  est mappé avec le répertoire de la machine Host /coog/coog_tmp

Pour des questions de sécurité, les conteneurs coog ne tournent pas en root.

Il est donc indispensable de positionner les bons droits sur les répertoires /coog/coog_data et /coog/coog_tmp qui sont mappés dans les conteneurs.

Commande à faire sur la machine HOST :

    sudo chown 1003:1003 /coog/coog_data
    sudo chown 1003:1003 /coog/coog_tmp

## Gérer les services

### Démarrer un service spécifique

    docker-compose up <service>

**Exemple :**

    docker-compose up coog

### Arrêter un service spécifique

    docker-compose down <service>

**Exemple :**

    docker-compose down coog

## Activer la chaîne de batch : celery daily (à positionner en crontab)

Pour lancer la chaîne de batch quotidienne, on peut spécifier dans la crontab du système :

    docker-compose -p coog_batch --project-directory ./coopengo/coog-docker/ -f ./coopengo/coog-docker/docker-compose.daily.yml up

## Initialisation de la base de données (coog module update)

Init DB :

    ep  admin -u ir res -d coog

## Scaling de container

Il est possible de scaler des conteneurs de cette manière :

    docker-compose up --scale coog=5

## Base de données

### Backup 

Les données susceptibles d'être à backuper se situent dans le répertoire de la machine host "/coog" .
Ce répertoire correspond au point de montage de coog, ainsi que celui des bases de données.

Pour backuper postgres, il faut utiliser la commande pg_dump. Voir la documentation officielle PostgreSql :

- <https://www.postgresql.org/docs/current/backup.html>

Ex d'utilisation au travers de la commande docker :

    docker exec -it coog-docker_postgres_1 pg_dump -d coog -U coog

Pour backuper le répertoire Workspace de Coog, il faut utiliser la commande tar sur le répertoire /coog au niveau de la machine Host.

Ex de commande tar :

    tar -zcvpf /backup/coog-$(date +%d-%m-%Y).tar.gz /coog/coog_data

### Restore

    docker exec -it coog-docker_postgres_1 psql <dbname> < <dumpfile>

### Anonymiser une base

Pour anonymiser une base de données, il faut télécharger le script `anonymize_coo_db.sql` dans le dossier `scripts/` et taper les commandes suivante :

    # Créer une copie de la base à anonymiser
    
    PG_USER=<nom_de_l_utilisateur>
    COPY=<nom_de_la_copie>
    DB_NAME=<nom_de_la_db>
    
    createdb -e -U $PG_USER DB_COPY -T DB_NAME
    psql -U <nom_de_l'utilisateur> -d <nom_de_la_copie> 2>&1 /dev/null << cat $(pwd)/scripts/anonymize_coog_db.sql
    
    # Création d'un dump de la base
    pg_dump -U $PG_USER -d $COPY -Fc > $COPY.dump
    dropdb -e -U $PG_USER $COPY

## Installer sentry

Il est possible d'installer des outils d'aide à la gestion d'erreurs.
Ce sont des outils non adhérant à Coog et qui reste à la charge de l'utilisateur.

Un exemple de configuration pour lever Sentry (à placer dans le docker-compose.override.yaml) :

    version: '3'
    
    volumes:
      pgdbsentry:
    
    services:
      redissentry:
        image: redis
        networks:
          - backend
    
      postgressentry:
        image: postgres
        environment:
          POSTGRES_USER: sentry
          POSTGRES_PASSWORD: sentry
          POSTGRES_DB: sentry
        volumes:
          - pgdbsentry:/var/lib/postgresql/data
        networks:
          - backend
    
      sentry:
        image: sentry
        links:
         - redissentry
         - postgressentry
        environment:
          SENTRY_SECRET_KEY: '!!!SECRET!!!'
          SENTRY_POSTGRES_HOST: postgressentry
          SENTRY_DB_USER: sentry
          SENTRY_DB_PASSWORD: sentry
          SENTRY_REDIS_HOST: redissentry
        networks:
          - backend
          - frontend
        labels:
          - traefik.http.routers.sentry.rule=Host(`sentry.localhost`)
          - traefik.http.routers.sentry.entrypoints=http
          - traefik.port=9000
        depends_on:
          - reverse-proxy
    
      cron:
        image: sentry
        links:
         - redissentry
         - postgressentry
        command: "sentry run cron"
        environment:
          SENTRY_SECRET_KEY: '!!!SECRET!!!'
          SENTRY_POSTGRES_HOST: postgressentry
          SENTRY_DB_USER: sentry
          SENTRY_DB_PASSWORD: sentry
          SENTRY_REDIS_HOST: redis_sentry
        networks:
          - backend
          - frontend
        depends_on:
          - reverse-proxy
    
      worker:
        image: sentry
        links:
         - redissentry
         - postgressentry
        command: "sentry run worker"
        environment:
          SENTRY_SECRET_KEY: '!!!SECRET!!!'
          SENTRY_POSTGRES_HOST: postgressentry
          SENTRY_DB_USER: sentry
          SENTRY_DB_PASSWORD: sentry
          SENTRY_REDIS_HOST: redissentry
        networks:
          - backend
          - frontend
        depends_on:
          - reverse-proxy

Une fois levée, il faut initialiser la BDD de cette manière :

    docker exec -it demo_sentry_1 sentry upgrade
  
Sentry est ainsi disponible à l'adresse : <http://sentry.localhost:8080/>

Il reste à finaliser la configuration du backend COOG avec ces variables d'environnement (à setter dans le conteneur Coog, fichier var.env):

    COOG_SENTRY_PUB=<public_key>
    COOG_SENTRY_SEC=<private_key>
    COOG_SENTRY_PROJECT=<project_id>
    COOG_SENTRY_PROTOCOL=http
    COOG_SENTRY_HOST=<[external-]server-ip>
    COOG_SENTRY_PORT=9000
