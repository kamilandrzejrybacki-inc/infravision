#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══ InfraVision Rebuild — $(date -Iseconds) ═══"

# Pull latest code
echo "── Pulling latest ──"
git pull --ff-only 2>/dev/null || true

# Also update ansible repo
if [ -d "${ANSIBLE_PATH:-}" ]; then
  (cd "$ANSIBLE_PATH" && git pull --ff-only 2>/dev/null || true)
fi

# Run pipeline + build inside node container
# Copy source to a temp dir inside the container (not bind mount)
# so npm ci works without permission issues, then copy dist/ back
echo "── Building ──"
docker run --rm \
  --network host \
  -v "$PROJECT_DIR":/src:ro \
  -v "${ANSIBLE_PATH:-/home/kamil/Code/ansible}":/ansible:ro \
  -v "$PROJECT_DIR/dist-out":/dist-out \
  -e NETBOX_URL="${NETBOX_URL}" \
  -e NETBOX_TOKEN="${NETBOX_TOKEN}" \
  -e INFRA_DOMAIN="${INFRA_DOMAIN}" \
  -e ANSIBLE_PATH=/ansible \
  -e GRAFANA_URL="${GRAFANA_URL}" \
  -e GRAFANA_TOKEN="${GRAFANA_TOKEN}" \
  node:20-alpine \
  sh -c '
    cp -a /src /app && cd /app &&
    npm ci --silent &&
    npm run generate-data &&
    npm run build &&
    rm -rf /dist-out/* &&
    cp -a dist/* /dist-out/
  '

# Ensure nginx container is running, deploy to volume
echo "── Deploying ──"
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d 2>/dev/null || true

VOLUME_PATH=$(docker volume inspect infravision_site-data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$VOLUME_PATH" ] && [ -d "$PROJECT_DIR/dist-out" ]; then
  sudo rsync -a --delete "$PROJECT_DIR/dist-out/" "$VOLUME_PATH/"
  echo "✓ Deployed to nginx volume"
fi

echo "✓ Rebuild complete — http://$(hostname -I | awk '{print $1}'):8090"
