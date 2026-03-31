import type { DiscoveredService } from "./types.js";

interface PrometheusConfig {
  grafanaUrl: string;
  grafanaToken: string;
  datasourceUid: string;
}

interface PromQueryResult {
  data: Array<{
    metric: Record<string, string>;
    value: [number, string];
  }>;
}

/** Step 2: Query Prometheus for actually running Docker containers */
export async function discoverRunningContainers(config: PrometheusConfig): Promise<DiscoveredService[]> {
  console.log("[prometheus] Querying docker_container_info for running containers...");

  const params = new URLSearchParams({
    query: "docker_container_info",
    time: String(Math.floor(Date.now() / 1000)),
  });

  const res = await fetch(
    `${config.grafanaUrl}/api/datasources/proxy/uid/${config.datasourceUid}/api/v1/query?${params}`,
    {
      headers: {
        Authorization: `Bearer ${config.grafanaToken}`,
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) {
    console.warn(`[prometheus] Query failed: ${res.status} — falling back to Ansible`);
    return [];
  }

  const body = await res.json() as { status: string; data: { result: PromQueryResult["data"] } };
  if (body.status !== "success") {
    console.warn("[prometheus] Query returned non-success status");
    return [];
  }

  const containers = body.data.result;
  console.log(`[prometheus] Found ${containers.length} running containers`);

  // Infrastructure/monitoring containers to exclude from the service map
  // These are plumbing, not user-facing services
  const infraContainers = new Set([
    "docker-exporter",
    "alloy",
    "nas-alloy",
    "crowdsec",
    "redis-exporter",
    "postgres-exporter",
    "mysqld-exporter",
    "smartctl-exporter",
    "n8n-vault-shim",
    "lightpanda",       // MCP browser tool, not infra
  ]);

  // Containers that are sub-processes of a parent service (group them)
  const subContainers: Record<string, string> = {
    "netbox-worker": "netbox",
    "netbox-housekeeping": "netbox",
    "n8n-old": "n8n",           // legacy instance
    "claude-backup-redis": "n8n", // support container
  };

  const services: DiscoveredService[] = [];
  const seen = new Set<string>();

  for (const entry of containers) {
    const name = entry.metric.name;
    const instance = entry.metric.instance;
    const imageName = entry.metric.image_name || "";

    // Skip infrastructure containers
    if (infraContainers.has(name)) continue;

    // Group sub-containers under parent
    const serviceId = subContainers[name] ?? name;
    if (seen.has(`${instance}/${serviceId}`)) continue;
    seen.add(`${instance}/${serviceId}`);

    services.push({
      id: serviceId,
      label: prettifyContainerName(serviceId),
      description: "",
      hostId: instance,
      type: "docker",
      ports: [],
      image: cleanImageName(imageName),
      dependencies: [],
      tags: [],
      active: true,
    });
  }

  console.log(`[prometheus] ${services.length} user-facing services after filtering`);
  return services;
}

function prettifyContainerName(name: string): string {
  const nameMap: Record<string, string> = {
    "grafana": "Grafana",
    "caddy": "Caddy",
    "vault": "Vault",
    "pihole": "Pi-hole",
    "authelia": "Authelia",
    "homepage": "Homepage",
    "nexterm": "Nexterm",
    "netbox": "NetBox",
    "n8n": "n8n",
    "paperless": "Paperless",
    "stirling-pdf": "Stirling PDF",
    "filebrowser": "Filebrowser",
    "loki": "Loki",
    "mimir": "Mimir",
    "shared-postgres": "PostgreSQL",
    "shared-redis": "Redis",
    "shared-mariadb": "MariaDB",
    "wg-easy": "WireGuard",
    "syncthing": "Syncthing",
    "obsidian-couchdb": "Obsidian Livesync",
    "obsidian-rest-api": "Obsidian REST API",
    "quartz": "Quartz",
  };
  return nameMap[name] ?? name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanImageName(image: string): string {
  // Remove sha256 prefix, registry prefixes for readability
  return image
    .replace(/^sha256:[a-f0-9]+$/, "")
    .replace(/^docker\.io\//, "")
    .replace(/^ghcr\.io\//, "ghcr:")
    || "";
}
