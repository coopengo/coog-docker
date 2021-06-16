#!/bin/bash
# BACK
docker-compose up postgres reverse-proxy coog static unoconv

# FRONT
# docker-compose up mongo gateway api api-identity-manager web portal &

# ALL
# docker-compose up postgres reverse-proxy coog static unoconv mongo gateway api api-identity-manager web portal # initcoog
