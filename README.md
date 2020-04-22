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


# Divers

coog=# update ir_note_type set code = concat(concat(code, '_'), id);


# Configuration specifique client

Il faut alimenter le docker-compose.override.yaml à la racine du projet avec les spécificités clientes si besoin.

Ce fichier est automatiquement lu par docker-compose et mergé avec le docker-compose.yaml.

ex:


    version: "3"
    
    services:
      paybox:
        entrypoint: ["echo", "Service foo disabled"]
      coog:
          image: coopengo/coog-client:${IMAGE_VERSION_COOG}


Les autres configurations éditables sont :
- .env              (variables liés au docker-compose.yaml)
- ./env_files/*     (variables liés au container)
