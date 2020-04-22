# Pré-requis Hardware
- OS : centos 7
- RAM : 16Gb
- CPU : 8 CPU
- HDD : 100Go

# Documentation externe :

Docker-compose : https://docs.docker.com/compose


# Installer Docker 

  Doc officielle Centos : https://docs.docker.com/engine/install/centos/

# Certificats SSL sur le localhost


    wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64
    sudo mv mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
    sudo chmod +x /usr/local/bin/mkcert
    mkcert -install
    mkcert -cert-file certs/localhost-cert.pem -key-file certs/localhost-key.pem "coog.localhost"

# Démarrer coog


    docker-compose up

OU


    docker-compose up -d #(mode démon)

# Démarrer un service spécifique


    docker-compose up coog

# Arrêter un service spécifique


    docker-compose down coog

# Commande de module update

Init DB :
  

    ep  admin -u ir res -d coog

# Scaling de container

Il est possible de scaler des conteneurs de cette manière :


    docker-compose up --scale coog=5

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

Les données susceptibles d'être à backuper se situent automatiquement dans le répertoire de la machine host /coog .
Elle contient le point de montage de coog ainsi que ceux des bases de données.

Pour backuper postgres, il faut utiliser la commande pg_dump. Ci-joint la documentation officielle Postgres :
- https://www.postgresql.org/docs/current/backup.html

Ex d'utilisation au travers de la commande docker :


    docker exec -it coog-docker_postgres_1 pg_dump -d coog -U coog

Pour backuper le repertoire Workspace de Coog, il faut utiliser la commande tar sur le repertoire /coog au niveau de la machine host.