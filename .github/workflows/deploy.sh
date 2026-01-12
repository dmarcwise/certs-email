#!/bin/bash
set -euo pipefail

# Expected environment variables:
# - COMPOSE_FILE_PATH
# - OP_CONNECT_TOKEN
# - DOCKER_REGISTRY_NAME
# - DOCKER_REGISTRY_TOKEN
# - DOCKER_IMAGE

export OP_CONNECT_HOST="http://127.0.0.1:8080"

# Extract all the required env variables from the Compose file in a bash list.
# These variables are automatically fetched by "op run" below
VARS=($(yq '.services[].environment[]' $COMPOSE_FILE_PATH))

for var in "${VARS[@]}"; do
  export "$var=op://DMARCwise-PROD/PROD-certs-email/$var"
done

echo "Logging in to Docker registry '${DOCKER_REGISTRY_NAME}'"

echo $DOCKER_REGISTRY_TOKEN | docker login --username AWS --password-stdin $DOCKER_REGISTRY_NAME

echo "Deploying ${DOCKER_IMAGE}"

op run -- \
  docker stack deploy --compose-file $COMPOSE_FILE_PATH --prune --detach=false certs-email --with-registry-auth

echo "Asserting successful deployment"

# Assert successful service update, since the above command exit code is always 0
# Possible statuses: https://github.com/moby/moby/blob/v28.3.3/daemon/cluster/convert/service.go#L59-L74
[[ $(docker service inspect certs-email_certs-email --format "{{.UpdateStatus.State}}") == "completed" ]]
