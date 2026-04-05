import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";
import type { PipelineConfig, InfraVisionOutput, DiscoveredService, CaddyRoute, GrafanaDashboard } from "./pipeline/types.js";
import { discoverPhysicalLayer } from "./pipeline/netbox.js";
import { discoverCaddyRoutes, discoverArgoApps, discoverK8sHost } from "./pipeline/ansible.js";
import { discoverArgoCDApps, getArgoCDSessionToken } from "./pipeline/argocd.js";
import { discoverRunningContainers, resolveHostIPs, discoverNetworkInterfaces } from "./pipeline/prometheus.js";
import { discoverPhysicalTopology } from "./pipeline/topology.js";
import { discoverDependencies } from "./pipeline/dependencies.js";
import { discoverDashboards, matchDashboardsToServices } from "./pipeline/grafana.js";

loadDotEnv({ path: resolve(import.meta.dirname, "../.env") });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function validateUrl(envKey: string, url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${envKey} must use http:// or https://`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("must use")) throw e;
    throw new Error(`${envKey} is not a valid URL: "${url}"`);
  }
  return url;
}

const config: PipelineConfig = {
  netbox: {
    url: validateUrl("NETBOX_URL", requireEnv("NETBOX_URL")),
    token: requireEnv("NETBOX_TOKEN"),
  },
  argocd: {
    url: validateUrl("ARGOCD_URL", optionalEnv("ARGOCD_URL", "")),
    token: optionalEnv("ARGOCD_TOKEN", ""),
    password: optionalEnv("ARGOCD_PASSWORD", ""),
  },
  grafana: {
    url: validateUrl("GRAFANA_URL", optionalEnv("GRAFANA_URL", "")),
    token: optionalEnv("GRAFANA_TOKEN", ""),
  },
  domain: requireEnv("INFRA_DOMAIN"),
  ansiblePath: requireEnv("ANSIBLE_PATH"),
};

const HOST_COLORS = [
  "2 62% 56%", "35 75% 54%", "162 46% 48%", "215 52% 58%",
  "268 42% 58%", "330 50% 55%", "90 40% 48%", "195 50% 50%",
];

async function main() {
  console.log("═══ InfraVision Data Pipeline ═══\n");

  // ── Step 1: Physical Layer (NetBox + Ansible) ──────────────────
  console.log("── Step 1: Physical Layer ──");

  const physical = await discoverPhysicalLayer(config.netbox);
  const caddyRoutes = await discoverCaddyRoutes(config);
  const k8sHost = await discoverK8sHost(config);

  const allDevices = physical.devices.filter(d => d.status === "active" && d.name !== "localhost");
  const namedDevices = allDevices.filter(d => !/^\d+\.\d+\.\d+\.\d+$/.test(d.name));
  const ipDevices = allDevices.filter(d => /^\d+\.\d+\.\d+\.\d+$/.test(d.name));

  console.log(`  Named devices: ${namedDevices.map(d => d.name).join(", ") || "none"}`);
  console.log(`  IP devices: ${ipDevices.map(d => d.name).join(", ") || "none"}`);
  if (k8sHost) console.log(`  K8s host: ${k8sHost.name} @ ${k8sHost.ip}`);

  // ── Step 2: Service Discovery ──────────────────────────────────
  console.log("\n── Step 2: Service Discovery ──");

  // 2a: K8s services from live ArgoCD API or Ansible fallback
  let k8sServices: DiscoveredService[] = [];
  if (config.argocd.url) {
    let argoToken = config.argocd.token;
    if (!argoToken && config.argocd.password) {
      argoToken = await getArgoCDSessionToken(config.argocd.url, config.argocd.password) ?? "";
    }
    if (argoToken) {
      k8sServices = await discoverArgoCDApps({ url: config.argocd.url, token: argoToken });
    }
  }
  if (k8sServices.length === 0) {
    console.log("[pipeline] Falling back to Ansible for K8s app discovery");
    k8sServices = await discoverArgoApps(config);
  }
  if (k8sHost) {
    for (const svc of k8sServices) {
      if (!svc.hostId) svc.hostId = k8sHost.name;
    }
  }

  // 2b: Docker services from Prometheus (ground truth)
  let dockerServices: DiscoveredService[] = [];
  if (config.grafana.url && config.grafana.token) {
    dockerServices = await discoverRunningContainers({
      grafanaUrl: config.grafana.url,
      grafanaToken: config.grafana.token,
      datasourceUid: "mimir",
    });
  }

  // ── Build Host Map from live sources (Prometheus + NetBox) ──────
  const hostMap = new Map<string, { id: string; label: string; ip: string; tags: string[] }>();

  // All hosts come from Prometheus instance labels (what's actually monitored)
  const allHostnames = new Set<string>();
  for (const svc of k8sServices) { if (svc.hostId) allHostnames.add(svc.hostId); }
  for (const svc of dockerServices) { if (svc.hostId) allHostnames.add(svc.hostId); }

  for (const hostname of allHostnames) {
    // Check if this host is also a named NetBox device (for tags)
    const netboxDevice = namedDevices.find(d => d.name === hostname);
    // If Prometheus scrapes by IP, the instance label IS the IP
    const isIpHostname = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    hostMap.set(hostname, {
      id: hostname,
      label: netboxDevice?.label ?? hostname,
      ip: isIpHostname ? hostname : (netboxDevice?.ip ?? ""),
      tags: netboxDevice?.tags ?? [],
    });
  }

  // Resolve IPs from Prometheus: kube_node_info has internal_ip for K8s nodes
  if (config.grafana.url && config.grafana.token) {
    const promIPs = await resolveHostIPs(
      { grafanaUrl: config.grafana.url, grafanaToken: config.grafana.token, datasourceUid: "mimir" },
      [...allHostnames],
    );
    for (const [hostname, ip] of promIPs) {
      const host = hostMap.get(hostname);
      if (host && !host.ip) host.ip = ip;
    }
  }

  // Fill remaining IPs from NetBox IP-named devices
  // (e.g., NetBox has "192.168.0.105" as a device — match by NetBox description or interface MACs)
  for (const [hostname, host] of hostMap) {
    if (host.ip) continue;
    // Check NetBox for IP addresses assigned to this device name
    const netboxIpDevice = physical.devices.find(d =>
      d.status === "active" && /^\d+\.\d+\.\d+\.\d+$/.test(d.name) && d.ip === hostname
    );
    if (netboxIpDevice) host.ip = netboxIpDevice.name;
  }

  // ── Merge services ─────────────────────────────────────────────
  const serviceMap = new Map<string, DiscoveredService>();
  for (const svc of k8sServices) serviceMap.set(svc.id, svc);
  for (const svc of dockerServices) {
    if (!serviceMap.has(svc.id)) serviceMap.set(svc.id, svc);
  }

  // Remove hosts with zero services
  const hostsWithServices = new Set([
    ...k8sServices.map(s => s.hostId),
    ...dockerServices.map(s => s.hostId),
  ]);
  for (const key of [...hostMap.keys()]) {
    if (!hostsWithServices.has(key)) hostMap.delete(key);
  }

  const allServices = [...serviceMap.values()];
  console.log(`\n  Total services: ${allServices.length} (${k8sServices.length} K8s + ${dockerServices.length} Docker)`);

  // ── Dependencies ───────────────────────────────────────────────
  const runningIds = new Set(allServices.map(s => s.id));
  const depLinks = await discoverDependencies(config, runningIds);

  // ── Step 3: Enrichment ─────────────────────────────────────────
  console.log("\n── Step 3: Enrichment ──");

  let dashboardMap = new Map<string, GrafanaDashboard[]>();
  if (config.grafana.url && config.grafana.token) {
    const dashboards = await discoverDashboards(config.grafana);
    dashboardMap = matchDashboardsToServices(dashboards, allServices.map(s => s.id));
    console.log(`  Dashboard matches: ${dashboardMap.size} services`);
  }

  const serviceQuickLinks = buildQuickLinks(allServices, caddyRoutes, dashboardMap, config.domain);

  // ── Step 4: Physical Topology + Assembly ───────────────────────
  console.log("\n── Step 4: Physical Topology + Assembly ──");

  const hostIPs = new Map<string, string>();
  for (const [id, data] of hostMap) {
    if (data.ip) hostIPs.set(id, data.ip);
  }

  const topology = await discoverPhysicalTopology(config, physical.devices, hostIPs, physical.connections);

  // Add network devices (router, switch) as hosts
  for (const nd of topology.networkDevices) {
    if (!hostMap.has(nd.id)) {
      hostMap.set(nd.id, { id: nd.id, label: nd.label, ip: nd.ip, tags: [nd.role] });
    }
  }

  // ── Build zones dynamically from host subnets ──────────────────
  // Group hosts by /24 subnet and create a zone per group
  const subnetHosts = new Map<string, string[]>();
  for (const [id, data] of hostMap) {
    const subnet = getSubnet(data.ip);
    if (!subnet) continue;
    if (!subnetHosts.has(subnet)) subnetHosts.set(subnet, []);
    subnetHosts.get(subnet)!.push(id);
  }

  // Find NetBox prefix descriptions for each subnet
  const prefixDescriptions = new Map<string, string>();
  for (const p of physical.prefixes) {
    const subnet = getSubnet(p.prefix.split("/")[0]);
    if (subnet) prefixDescriptions.set(subnet, p.description);
  }

  const zones: Array<{ id: string; cidr: string; label: string; hostIds: string[] }> = [];
  for (const [subnet, hostIds] of subnetHosts) {
    const cidr = `${subnet}.0/24`;
    const desc = prefixDescriptions.get(subnet) ?? "";
    const label = desc ? desc.toUpperCase() : `${cidr}`;
    const zoneId = desc
      ? desc.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      : `net-${subnet.replace(/\./g, "-")}`;

    zones.push({ id: zoneId, cidr, label, hostIds });
  }

  // Hosts without IPs (e.g., switches) go into the zone that has the most hosts
  const largestZone = zones.reduce((a, b) => a.hostIds.length >= b.hostIds.length ? a : b, zones[0]);
  for (const [id, data] of hostMap) {
    if (!data.ip && largestZone && !largestZone.hostIds.includes(id)) {
      largestZone.hostIds.push(id);
    }
  }

  // Assign zone to each host
  const hostZoneMap = new Map<string, string>();
  for (const zone of zones) {
    for (const hostId of zone.hostIds) {
      hostZoneMap.set(hostId, zone.id);
    }
  }

  const hosts = [...hostMap.values()].map((h, idx) => ({
    ...h,
    zone: hostZoneMap.get(h.id) ?? zones[0]?.id ?? "",
    color: HOST_COLORS[idx % HOST_COLORS.length],
  }));

  const allTags = [...new Set(allServices.flatMap(s => s.tags))].sort();

  const connections = [
    ...depLinks.map(d => ({ source: d.source, target: d.target, type: "dependency" as const })),
    ...topology.links.map(l => ({ source: l.source, target: l.target, type: "physical" as const, label: l.label })),
  ];

  const output: InfraVisionOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      sources: {
        netbox: "configured",
        ansible: "configured",
        ...(config.argocd.url ? { argocd: "configured" } : {}),
        ...(config.grafana.url ? { grafana: "configured" } : {}),
      },
    },
    zones,
    hosts: hosts.map(h => ({ id: h.id, label: h.label, ip: h.ip, zone: h.zone, color: h.color, tags: h.tags })),
    services: allServices.map(s => ({
      id: s.id, label: s.label, description: s.description, hostId: s.hostId,
      type: s.type, ports: s.ports,
      ...(s.image ? { image: s.image } : {}),
      ...(s.chart ? { chart: s.chart } : {}),
      dependencies: s.dependencies, tags: s.tags,
      quickLinks: serviceQuickLinks.get(s.id) ?? [],
      ...(s.syncStatus ? { syncStatus: s.syncStatus } : {}),
      active: s.active,
    })),
    connections,
    tags: allTags,
  };

  const outputPath = resolve(import.meta.dirname, "../public/infravision-data.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`\n✓ Written to ${outputPath}`);
  console.log(`  ${output.hosts.length} hosts, ${output.services.length} services, ${output.zones.length} zones`);
  console.log(`  ${output.connections.length} connections, ${caddyRoutes.length} quickLink routes`);

  console.log("\n── Service Summary ──");
  for (const svc of output.services) {
    const links = svc.quickLinks.length > 0 ? ` [${svc.quickLinks.length} links]` : "";
    console.log(`  ${svc.type.padEnd(7)} ${svc.hostId.padEnd(14)} ${svc.label}${links}`);
  }
}


/**
 * Build quickLinks by matching Caddy route subdomains to service IDs.
 * Uses fuzzy matching: caddy subdomain "grafana" matches service "grafana",
 * caddy subdomain "pdf" matches service containing "pdf", etc.
 */
function buildQuickLinks(
  services: DiscoveredService[],
  caddyRoutes: CaddyRoute[],
  dashboardMap: Map<string, GrafanaDashboard[]>,
  domain: string,
): Map<string, Array<{ label: string; url: string; icon: string }>> {
  const result = new Map<string, Array<{ label: string; url: string; icon: string }>>();

  // Build index: caddy subdomain/serviceId → route
  const routeIndex = new Map<string, CaddyRoute>();
  for (const route of caddyRoutes) {
    if (route.serviceId) routeIndex.set(route.serviceId, route);
    routeIndex.set(route.subdomain, route);
  }

  for (const svc of services) {
    const links: Array<{ label: string; url: string; icon: string }> = [];

    // Try exact match on service ID, then on subdomain
    let route = routeIndex.get(svc.id);

    // If no exact match, try matching by checking if any caddy route
    // subdomain is a substring of the service ID or vice versa
    if (!route) {
      const svcNorm = svc.id.toLowerCase().replace(/[-_]/g, "");
      for (const [key, r] of routeIndex) {
        const keyNorm = key.toLowerCase().replace(/[-_]/g, "");
        // Only match if one is a substantial substring of the other (>3 chars)
        if (keyNorm.length > 3 && svcNorm.includes(keyNorm)) { route = r; break; }
        if (svcNorm.length > 3 && keyNorm.includes(svcNorm)) { route = r; break; }
      }
    }

    if (route) {
      links.push({
        label: "Open Web UI",
        url: `https://${route.subdomain}.${domain}`,
        icon: "🌐",
      });
    }

    // Grafana dashboard links
    const dashboards = dashboardMap.get(svc.id);
    if (dashboards) {
      for (const dash of dashboards) {
        const publicUrl = dash.url.replace(/https?:\/\/localhost:\d+/, `https://grafana.${domain}`);
        links.push({ label: `Dashboard: ${dash.title}`, url: publicUrl, icon: "📊" });
      }
    }

    if (links.length > 0) result.set(svc.id, links);
  }

  return result;
}

function ipInPrefix(ip: string, cidr: string): boolean {
  const [prefix, bits] = cidr.split("/");
  if (!prefix || !bits || !ip) return false;
  const ipNum = ipToNum(ip);
  const prefixNum = ipToNum(prefix);
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
  return (ipNum & mask) === (prefixNum & mask);
}

function ipToNum(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function getSubnet(ip: string): string {
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : "";
}

main().catch(err => {
  console.error("\n✗ Pipeline failed:", err.message);
  process.exit(1);
});
