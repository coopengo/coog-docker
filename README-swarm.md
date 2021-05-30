Coopengo Docker Ecosystem
=========================

Ce projet permet de lancer, au cas par cas, les différentes briques de coog.

Il est ainsi possible de lancer le projet avec [docker compose](https://docs.docker.com/compose/) ou bien dans un [swarm docker](https://docs.docker.com/engine/swarm/).

Utilisation
-----------

### Docker Compose

Pour lancer le projet, il suffit de lancer :
```bash
$ ./bin/up
Vérification des fichiers d'environnement
  - .env existe
  - services.env existe
  - env/var.env existe
  - env/postgres.env existe
  - env/rabbitmq.env existe
  - env/web.env existe
  - env/celery.env existe
  - env/redis.env existe
  - env/celery-single.env existe
Ajout de services
  ✓ database/postgres ajouté
  ✓ database/redis ajouté
  ✓ init ajouté
  ✓ coog ajouté
  ✓ static ajouté
  ✓ celery/base ajouté
  ✓ database/mongo ajouté
  ✓ gateway ajouté
  ✓ api/base ajouté
  ✓ api/identity-manager ajouté
  ✓ web ajouté
Lancement
Creating network "coog-backend" with the default driver
Creating network "coog-frontend" with the default driver
```
Il est également possible de modifier au préalable les fichiers de variables d'environnement en lancant la commande ```bin/env``` pour créer des fichiers non versionnés à partir de fichier exemple (sample.env). Il peut, par exemple, être intéressant de spécifier un nom de projet différent ```COMPOSE_PROJECT_NAME``` dans le fichier ```.env```.

Il est possible de passer n'importe quel argument utilisé par docker-compose :
```bash
./bin/up -d
```

Pour arrêter les services :
```bash
./bin/down
# ou
docker-compose down
```

### Docker Swarm

De la même façon, il suffit de lancer :
```bash
$ docker swarm init
Swarm initialized: current node (m3xcqxeqgngkfgxf60u7lg2hj) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-0ef8g6d1h2z6hhckwyo1avuq6xxu6zxl9fq3blk7mtooi7lcxh-bftjlalwhi5gu8yhhf6cdtbi8 192.168.43.213:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.

$ ./bin/deploy
Vérification des fichiers d'environnement
  - .env existe
  - services.env existe
  - env/var.env existe
  - env/postgres.env existe
  - env/rabbitmq.env existe
  - env/web.env existe
  - env/celery.env existe
  - env/redis.env existe
  - env/celery-single.env existe
Ajout de services
  ✓ database/postgres ajouté
  ✓ database/redis ajouté
  ✓ init ajouté
  ✓ coog ajouté
  ✓ static ajouté
  ✓ celery/base ajouté
  ✓ database/mongo ajouté
  ✓ gateway ajouté
  ✓ api/base ajouté
  ✓ api/identity-manager ajouté
  ✓ web ajouté
Déploiement
Ignoring unsupported options: restart

Creating network coog-backend
Creating network coog-frontend
Creating service coopengo_init
Creating service coopengo_postgres
Creating service coopengo_redis
Creating service coopengo_reverse-proxy
Creating service coopengo_web
Creating service coopengo_coog
Creating service coopengo_api-identity-manager
Creating service coopengo_celery
Creating service coopengo_gateway
Creating service coopengo_mongo
Creating service coopengo_static
Creating service coopengo_api
$ docker stack ls
NAME       SERVICES   ORCHESTRATOR
coopengo   12         Swarm
$ docker service ls
ID             NAME                            MODE         REPLICAS   IMAGE                                             PORTS
t2acdj0ot2yg   coopengo_api                    replicated   1/1        coopengohub/api:coog-2.12.0.23                    
r6gbeitfapwd   coopengo_api-identity-manager   replicated   1/1        coopengohub/api-identity-manager:coog-2.12.0.23   
4mmszamphq32   coopengo_celery                 replicated   1/1        coopengohub/coog:coog-2.12.0                      
61526499ehto   coopengo_coog                   replicated   1/1        coopengohub/coog:coog-2.12.0                      
pyaick34xtnc   coopengo_gateway                replicated   1/1        coopengohub/gateway:coog-2.12.0.23                
dn10ox9zt3oi   coopengo_init                   replicated   0/1        coopengohub/coog:coog-2.12.0                      
isbggpu7pfdp   coopengo_mongo                  replicated   1/1        mongo:latest                                      
xwy3adkrqllg   coopengo_postgres               replicated   1/1        postgres:12-alpine                                
lplvtssh6qkj   coopengo_redis                  replicated   1/1        redis:5.0.7-alpine                                
exllw9cd7h83   coopengo_reverse-proxy          replicated   1/1        traefik:2.3.4                                     *:80->80/tcp, *:443->443/tcp, *:8080->8080/tcp
a0x86wi4ubcw   coopengo_static                 replicated   1/1        coopengohub/static:coog-2.12.0                    
4ld376o6927e   coopengo_web                    replicated   1/1        coopengohub/web:coog-2.12.0  
````


<!-- Environnements
--------------

Il est possible de lancer plusieurs instances des services de coog.

Dans le fichier ```.env```, il suffit de personnaliser :

* ```COMPOSE_PROJECT_NAME```
* ```NETWORK_BACKEND_NAME```
* ```NETWORK_BACKEND_SUBNET```
* ```NETWORK_FRONTEND_NAME```
* ```NETWORK_BACKEND_SUBNET```
* ```TRAEFIK_HTTP_PORT```
* ```TRAEFIK_HTTPS_PORT```
* ```TRAEFIK_MANAGMENT_PORT``` -->
