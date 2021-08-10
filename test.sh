#!/bin/sh
./run.sh

docker-compose config | yq '.services | "\(.static.image) \(.coog.image) \(.gateway.image)"'
