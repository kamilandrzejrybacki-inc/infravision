#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══ InfraVision Rebuild — $(date -Iseconds) ═══"

# Pull latest code
echo "── Pulling latest code ──"
git pull --ff-only 2>/dev/null || echo "git pull skipped (not a git repo or no remote)"

# Run pipeline + build inside a node container with network access
echo "── Running data pipeline + build ──"
docker run --rm \
  --network host \
  -v "$PROJECT_DIR":/app \
  -v "${ANSIBLE_PATH:-/home/kamil-rybacki/Code/ansible}":/ansible:ro \
  -w /app \
  -e NETBOX_URL="${NETBOX_URL}" \
  -e NETBOX_TOKEN="${NETBOX_TOKEN}" \
  -e INFRA_DOMAIN="${INFRA_DOMAIN}" \
  -e ANSIBLE_PATH=/ansible \
  -e GRAFANA_URL="${GRAFANA_URL}" \
  -e GRAFANA_TOKEN="${GRAFANA_TOKEN}" \
  node:20-alpine \
  sh -c "npm ci --silent && npm run generate-data && npm run build"

# Copy built files to the nginx volume
echo "── Deploying to nginx volume ──"
VOLUME_PATH=$(docker volume inspect infravision_site-data -f '{{.Mountpoint}}' 2>/dev/null || echo "")

if [ -z "$VOLUME_PATH" ]; then
  echo "Creating volume and starting nginx..."
  docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d
  VOLUME_PATH=$(docker volume inspect infravision_site-data -f '{{.Mountpoint}}')
fi

# Copy dist/ contents to the volume (need sudo for Docker volume path)
sudo rsync -a --delete "$PROJECT_DIR/dist/" "$VOLUME_PATH/"

echo "✓ Rebuild complete — site live at http://$(hostname -I | awk '{print $1}'):8090"
