# Prérequis Hardware
- OS : centos 7
- RAM : 16Gb
- CPU : 8 CPU
- HDD : 100Go

# Coog-admin DEPRECATED :
Dans un souci de standardisation et de simplification de son installation, coog-admin a été déprécié au profit de coog-docker (basé uniquement sur docker et docker-compose).


# Documentation externe :

Docker : https://docs.docker.com/engine/install/centos/

Docker-compose : https://docs.docker.com/compose


# Certificats SSL sur le localhost


    wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64
    sudo mv mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
    sudo chmod +x /usr/local/bin/mkcert
    mkcert -install
    mkcert -cert-file certs/localhost-cert.pem -key-file certs/localhost-key.pem "coog.localhost"

# IMPORTANT

Les commandes docker-compose sont à exécuter à la racine du répertoire coog-docker.

# Démarrer coog


    docker-compose up

OU


    docker-compose up -d #(mode démon)


# Configurer les variables d'environnements coog

Il suffit de mettre à jour le contenu des .env présent dans le repertoire env_files.
Le var.env est appelé dans tous les conteneurs coog.
Penser à faire :
    
    docker-compose up -d


# Mapper le volume avec les bons droits sur le Host
Le répertoire /workspace/io des conteneurs, est mappé avec le répertoire de la machine Host /coog/coog_data

Pour des questions de sécurité, les conteneurs coog ne tournent pas en root.

Il est donc indispensable de positionner les bons droits sur le répertoire /coog/coog_data qui est mappé dans les conteneurs.

Commande à faire sur la machine HOST :

    sudo chown 1003:1003 /coog/coog_data

# Démarrer un service spécifique


    docker-compose up coog

# Arrêter un service spécifique


    docker-compose down coog

# Initialisation de la base de données (coog module update)

Init DB :


    ep  admin -u ir res -d coog

# Scaling de container

Il est possible de scaler des conteneurs de cette manière :


    docker-compose up --scale coog=5

#celery daily


    COMPOSE_PROJECT_NAME=batch docker-compose -f docker-compose.daily.yml up -d


# Configuration specifique client

Il faut alimenter le docker-compose.override.yaml à la racine du projet avec les spécificités clientes si besoin.

Ce fichier est automatiquement lu par docker-compose et mergé avec le docker-compose.yaml.

ex: Désactiver les conteneur paybox et changer l'image de référence de coog :


    version: "3"
    
    services:
      paybox:
        entrypoint: ["echo", "Service foo disabled"]
      coog:
          image: coopengo/coog-client:${IMAGE_VERSION_COOG}


Les autres configurations éditables sont :
- .env              (variables liés au docker-compose.yaml)
- ./env_files/*     (variables liés au container)


# Backup

Les données susceptibles d'être à backuper se situent dans le répertoire de la machine host "/coog" .
Ce répertopire correspond au point de montage de coog, ainsi que celui des bases de données.

Pour backuper postgres, il faut utiliser la commande pg_dump. Voir la documentation officielle PostgreSql :
- https://www.postgresql.org/docs/current/backup.html

Ex d'utilisation au travers de la commande docker :


    docker exec -it coog-docker_postgres_1 pg_dump -d coog -U coog

Pour backuper le répertoire Workspace de Coog, il faut utiliser la commande tar sur le répertoire /coog au niveau de la machine Host.

Ex de commande tar :


    tar -zcvpf /backup/coog-$(date +%d-%m-%Y).tar.gz /coog/coog_data



# Anonymiser une base

Le but est d'appliquer ces requêtes au sein de la BDD que l'on souhaite anonymiser :


    docker exec -it coog-docker_coog_1 ep anon_queries 1


Exemple de copie d'une base coog et de son anonymisation :


    docker exec -it coog-docker_postgres_1 psql --quiet -c "create database anon_db;" -U coog
    docker exec -t coog-docker_postgres_1 pg_dump -d coog -U coog -c -O > dump_to_anon.sql
    cat dump_to_anon.sql | docker exec -i coog-docker_postgres_1 psql -U coog -d anon_db
    docker exec -it coog-docker_coog_1 ep anon_queries 1 | docker exec -i coog-docker_postgres_1 psql -U coog -d anon_db
    

# Installer sentry

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
    
Sentry est ainsi disponible à l'adresse : http://sentry.localhost:8080/

Il reste à finaliser la configuration du backend COOG avec ces variables d'environnement (à setter dans le conteneur Coog, fichier var.env):

    COOG_SENTRY_PUB=<public_key>
    COOG_SENTRY_SEC=<private_key>
    COOG_SENTRY_PROJECT=<project_id>
    COOG_SENTRY_PROTOCOL=http
    COOG_SENTRY_HOST=<[external-]server-ip>
    COOG_SENTRY_PORT=9000
