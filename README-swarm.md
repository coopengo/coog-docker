Coopengo Docker Ecosystem
=========================

Ce projet permet de lancer, au cas par cas, les différentes briques de coog.

Il est ainsi possible de lancer le projet avec [docker
compose](https://docs.docker.com/compose/) ou bien dans un [swarm
docker](https://docs.docker.com/engine/swarm/).

Utilisation
-----------

### Configuration

#### Fichier `services.env`

Ce fichier contient la liste des services à activer pour le déploiement.

Il permet de configurer un déploiement "pur backoffice", ou un déploiement
complet (Back + Front)

#### Fichier `.env`

- `COOG_TMP` / `COOG_VOLUME` / `POSTGRES_DATA_VOLUME` / `MONGODB_DATA_VOLUME`:
Chemins pour le stockage des données. A changer
- `PROJECT_HOSTNAME`: Le nom de domaine pour accéder à l'application. Par défaut,
permet d'accéder au portail via http://coog.localhost/portal, au back via
http://coog.localhost/sao, et aux APIs via http://coog.localhost/gateway
**Attention** : Il peut être nécessaire d'ajouter ce nom d'hôte manuellement dans la
configuration d'hôte (`/etc/host` sous Linux)
En cas de modification, il sera nécessaire de modifier les URL référançant ce nom
de domaine dans les fichiers `env/*`. Notamment dans `env/var.env`, les variables
`COOG_GATEWAY_URL`, `COOG_PORTAL_URL`, `WHITELIST` et `TRYTOND_WEB__CORS`
- `COOG_DB_NAME`: Le nom de la base de données qui sera utilisée par le
backoffice. Si cette valeur est modifiée, il faut également modifier la variable
`POSTGRES_DB` dans `env/postgres.env`, et **purger le dossier `POSTGRES_DATA_VOLUME`.**
Modifier également `COOG_DB_NAME` et `TRYTOND_DATABASE__PATH` dans `env/var.env`,
ainsi que `COOG_API_COOG_DB` dans `env/web.env`
L'application ne supporte qu'une seule base de données "principale", les bases
secondaires peuvent être créées manuellement via le container postgres

#### Fichier `env/var.env`

La configuration par défaut est fonctionnelle, il est uniquement nécessaire de
modifier les variables suivantes :

- `COOG_WEB_TOKEN`: Le Jeton backoffice qui sera utilisée par l'application. Ce
jeton doit préalablement avoir été créé côté Backoffice, et doit être rattaché
à un utilisateur disposant des droits d'appels aux APIs (groupe "API Full Access"
ou équivalent). Cet utilisateur doit également avoir une identité API rattachée
dans le Backoffice
- `JWT_ENCRYPTION` / `JWT_INTERNAL_ENCRYPTION`: Ces deux variables doivent avoir
la même valeur. Il s'agit d'un jeton utilisé pour sécuriser les communications
Front / Back, il doit donc être autant aléatoire que possible

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
Il est également possible de modifier au préalable les fichiers de variables
d'environnement en lancant la commande ``bin/env`` pour créer des fichiers
non versionnés à partir de fichier exemple (sample.env). Il peut, par exemple,
être intéressant de spécifier un nom de projet différent
``COMPOSE_PROJECT_NAME`` dans le fichier ``.env``.

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

Cron
----

Pour lancer quotidiennement ``celery/daily`` (préalablement ajouté aux services), il suffit d'ajouter un cron executant :
```bash
docker service scale coopengo_celery-daily=0 && docker service scale coopengo_celery-daily=1
```


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
