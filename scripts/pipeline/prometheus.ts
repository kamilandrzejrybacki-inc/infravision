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
    // instance may be "hostname:port" or "ip:port" — strip port to get the host identifier
    const instance = (entry.metric.instance ?? "").replace(/:\d+$/, "");
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
  return image
    .replace(/^sha256:[a-f0-9]+$/, "")
    .replace(/^docker\.io\//, "")
    .replace(/^ghcr\.io\//, "ghcr:")
    || "";
}

/** Resolve host IPs from Prometheus metrics */
export async function resolveHostIPs(
  config: PrometheusConfig,
  hostnames: string[],
): Promise<Map<string, string>> {
  const ipMap = new Map<string, string>();

  // kube_node_info has internal_ip for K8s nodes
  const kubeResult = await promQuery(config, "kube_node_info");
  for (const entry of kubeResult) {
    const node = entry.metric.node;
    const ip = entry.metric.internal_ip;
    if (node && ip && hostnames.includes(node)) {
      ipMap.set(node, ip);
    }
  }

  // node_uname_info from node_exporter has nodename=<kernel hostname> and
  // instance=<scrape-target IP:port> — this bridges hostname → IP for Docker hosts
  const unameResult = await promQuery(config, "node_uname_info");
  for (const entry of unameResult) {
    const nodename = entry.metric.nodename;
    const rawInstance = entry.metric.instance ?? "";
    const ip = rawInstance.replace(/:\d+$/, ""); // strip port
    if (!nodename || !ip) continue;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue; // only use if instance is an IP
    if (hostnames.includes(nodename) && !ipMap.has(nodename)) {
      ipMap.set(nodename, ip);
    }
  }

  if (ipMap.size > 0) {
    console.log(`[prometheus] Resolved ${ipMap.size} host IPs (kube_node_info + node_uname_info)`);
  }

  return ipMap;
}

/** Discover physical network interfaces per host from Prometheus node_network_info */
export async function discoverNetworkInterfaces(
  config: PrometheusConfig,
): Promise<Map<string, Array<{ device: string; mac: string }>>> {
  const result = new Map<string, Array<{ device: string; mac: string }>>();

  const data = await promQuery(
    config,
    'node_network_info{device!~"lo|docker.*|br-.*|veth.*|cali.*|flannel.*|cni.*",operstate="up"}',
  );

  for (const entry of data) {
    const host = entry.metric.instance;
    const device = entry.metric.device;
    const mac = entry.metric.address;
    if (!host || !device) continue;
    if (!result.has(host)) result.set(host, []);
    result.get(host)!.push({ device, mac: mac || "" });
  }

  console.log(`[prometheus] Network interfaces: ${[...result.entries()].map(([h, ifs]) => `${h}(${ifs.map(i => i.device).join(",")})`).join(" ")}`);
  return result;
}

async function promQuery(
  config: PrometheusConfig,
  expr: string,
): Promise<Array<{ metric: Record<string, string>; value: [number, string] }>> {
  const params = new URLSearchParams({
    query: expr,
    time: String(Math.floor(Date.now() / 1000)),
  });
  const res = await fetch(
    `${config.grafanaUrl}/api/datasources/proxy/uid/${config.datasourceUid}/api/v1/query?${params}`,
    { headers: { Authorization: `Bearer ${config.grafanaToken}`, Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const body = await res.json() as { status: string; data: { result: Array<{ metric: Record<string, string>; value: [number, string] }> } };
  return body.status === "success" ? body.data.result : [];
}
