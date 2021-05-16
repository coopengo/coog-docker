#!/bin/bash
# BACK
docker-compose up postgres initcoog reverse-proxy coog static redis # celery &
# FRONT
#docker-compose up mongo gateway api api-identity-manager web &
