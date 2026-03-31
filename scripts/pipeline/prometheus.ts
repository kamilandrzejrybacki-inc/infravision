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

  // Filter out infrastructure/plumbing containers by image pattern
  // Exporters, monitoring agents, sidecars, and ephemeral build containers
  const infraImagePatterns = [
    /exporter/i,            // *-exporter (docker, postgres, redis, smartctl, mysqld)
    /grafana\/alloy/i,      // monitoring agent
    /crowdsec/i,            // security agent
    /vault-shim/i,          // sidecar shims
    /infravision/i,         // infravision itself (nginx + builder)
    /lightpanda/i,          // headless browser tool
    /backup/i,              // backup-related containers
  ];

  // Docker auto-named containers (adjective_scientist pattern) are ephemeral
  const autoNameRegex = /^[a-z]+_[a-z]+$/;

  // Group sub-containers with their parent by detecting suffix patterns
  // e.g., "netbox-worker" and "netbox-housekeeping" → "netbox"
  const suffixPatterns = ["-worker", "-housekeeping", "-old", "-backup"];

  const services: DiscoveredService[] = [];
  const seen = new Set<string>();

  for (const entry of containers) {
    const name = entry.metric.name;
    const instance = entry.metric.instance;
    const imageName = entry.metric.image_name || "";

    // Skip ephemeral auto-named containers
    if (autoNameRegex.test(name)) continue;

    // Skip infrastructure containers by image pattern
    if (infraImagePatterns.some(p => p.test(imageName) || p.test(name))) continue;

    // Group sub-containers under parent by stripping common suffixes
    let serviceId = name;
    for (const suffix of suffixPatterns) {
      if (name.endsWith(suffix)) {
        serviceId = name.slice(0, -suffix.length);
        break;
      }
    }
    if (seen.has(`${instance}/${serviceId}`)) continue;
    seen.add(`${instance}/${serviceId}`);

    services.push({
      id: serviceId,
      label: prettifyName(serviceId),
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

function prettifyName(name: string): string {
  return name
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
