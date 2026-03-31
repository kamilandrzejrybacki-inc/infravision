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

# ── Auto-discover credentials not in .env ────────────────────────
# ArgoCD: fetch admin password from the K8s secret via SSH to the K8s node
# The K8s node is discovered from the Ansible inventory
if [ -z "${ARGOCD_PASSWORD:-}" ] && [ -z "${ARGOCD_TOKEN:-}" ]; then
  echo "── Discovering ArgoCD credentials ──"
  K8S_HOST=$(grep -r 'ansible_host=' "${ANSIBLE_PATH:-}/k8s/k3s-setup/inventory/" 2>/dev/null | grep -oP 'ansible_host=\K[\d.]+' | head -1)
  if [ -n "$K8S_HOST" ]; then
    # Try available SSH keys to reach the K8s node
    SSH_KEY=""
    for key in ~/.ssh/id_ed25519 ~/.ssh/n8n-backup-key ~/.ssh/id_rsa; do
      [ -f "$key" ] && SSH_KEY="-i $key" && break
    done
    ARGOCD_PASSWORD=$(ssh $SSH_KEY -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new "kamil@${K8S_HOST}" \
      "kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' 2>/dev/null | base64 -d" 2>/dev/null || echo "")
    if [ -n "$ARGOCD_PASSWORD" ]; then
      # Discover ArgoCD URL from k3s group_vars
      ARGOCD_PORT=$(grep -oP 'argocd_nodeport_http:\s*\K\d+' "${ANSIBLE_PATH:-}/k8s/k3s-setup/group_vars/all.yml" 2>/dev/null || echo "30080")
      export ARGOCD_URL="http://${K8S_HOST}:${ARGOCD_PORT}"
      export ARGOCD_PASSWORD
      echo "  ArgoCD: ${ARGOCD_URL} (credentials from K8s secret)"
    else
      echo "  ArgoCD: could not fetch credentials — falling back to Ansible discovery"
    fi
  fi
fi

# Run pipeline + build inside node container
echo "── Building ──"
docker run --rm \
  --name infravision-builder \
  --network host \
  -v "$PROJECT_DIR":/src:ro \
  -v "${ANSIBLE_PATH:-/home/kamil/Code/ansible}":/ansible:ro \
  -v "$PROJECT_DIR/dist-out":/dist-out \
  -e NETBOX_URL="${NETBOX_URL}" \
  -e NETBOX_TOKEN="${NETBOX_TOKEN}" \
  -e INFRA_DOMAIN="${INFRA_DOMAIN}" \
  -e ANSIBLE_PATH=/ansible \
  -e GRAFANA_URL="${GRAFANA_URL:-}" \
  -e GRAFANA_TOKEN="${GRAFANA_TOKEN:-}" \
  -e ARGOCD_URL="${ARGOCD_URL:-}" \
  -e ARGOCD_TOKEN="${ARGOCD_TOKEN:-}" \
  -e ARGOCD_PASSWORD="${ARGOCD_PASSWORD:-}" \
  node:20-alpine \
  sh -c '
    cp -a /src /app && cd /app &&
    npm ci --legacy-peer-deps --silent &&
    npm run generate-data &&
    npm run build &&
    rm -rf /dist-out/* &&
    cp -a dist/* /dist-out/
  '

# Ensure nginx container is running, deploy to volume
echo "── Deploying ──"
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d 2>/dev/null || true

VOLUME_PATH=$(docker volume inspect infravision_site-data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [[ -n "$VOLUME_PATH" && "$VOLUME_PATH" == /var/lib/docker/volumes/* && -d "$PROJECT_DIR/dist-out" ]]; then
  sudo rsync -a --delete "$PROJECT_DIR/dist-out/" "$VOLUME_PATH/"
  echo "✓ Deployed to nginx volume"
else
  echo "ERROR: Volume path '$VOLUME_PATH' failed safety check — aborting deploy" >&2
  exit 1
fi

echo "✓ Rebuild complete — http://$(hostname -I | awk '{print $1}'):8090"
