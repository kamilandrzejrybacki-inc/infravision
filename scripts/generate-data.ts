import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";
import type { PipelineConfig, InfraVisionOutput, DiscoveredService, CaddyRoute, GrafanaDashboard } from "./pipeline/types.js";
import { discoverPhysicalLayer } from "./pipeline/netbox.js";
import { discoverCaddyRoutes, discoverArgoApps, discoverK8sHost } from "./pipeline/ansible.js";
import { discoverArgoCDApps } from "./pipeline/argocd.js";
import { discoverRunningContainers } from "./pipeline/prometheus.js";
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

const config: PipelineConfig = {
  netbox: {
    url: requireEnv("NETBOX_URL"),
    token: requireEnv("NETBOX_TOKEN"),
  },
  argocd: {
    url: optionalEnv("ARGOCD_URL", ""),
    token: optionalEnv("ARGOCD_TOKEN", ""),
  },
  grafana: {
    url: optionalEnv("GRAFANA_URL", ""),
    token: optionalEnv("GRAFANA_TOKEN", ""),
  },
  domain: requireEnv("INFRA_DOMAIN"),
  ansiblePath: requireEnv("ANSIBLE_PATH"),
};

// ── Host accent colors assigned in discovery order ─────────────────
const HOST_COLORS = [
  "2 62% 56%",     // red
  "35 75% 54%",    // amber
  "162 46% 48%",   // teal
  "215 52% 58%",   // blue
  "268 42% 58%",   // purple
  "330 50% 55%",   // pink
  "90 40% 48%",    // olive
  "195 50% 50%",   // cyan
];

async function main() {
  console.log("═══ InfraVision Data Pipeline ═══\n");

  // ── Step 1: Physical Layer (NetBox + Ansible) ──────────────────
  console.log("── Step 1: Physical Layer ──");

  const physical = await discoverPhysicalLayer(config.netbox);
  const caddyRoutes = await discoverCaddyRoutes(config);
  const k8sHost = await discoverK8sHost(config);

  // All NetBox devices (include IP-named ones as they represent real machines)
  const allDevices = physical.devices.filter(d =>
    d.status === "active" && d.name !== "localhost"
  );

  // Named devices are the "known" hosts; IP-only ones need resolution
  const namedDevices = allDevices.filter(d => !/^\d+\.\d+\.\d+\.\d+$/.test(d.name));
  const ipDevices = allDevices.filter(d => /^\d+\.\d+\.\d+\.\d+$/.test(d.name));

  console.log(`  Named devices: ${namedDevices.map(d => d.name).join(", ") || "none"}`);
  console.log(`  IP devices: ${ipDevices.map(d => d.name).join(", ") || "none"}`);
  if (k8sHost) console.log(`  K8s host: ${k8sHost.name} @ ${k8sHost.ip}`);
  console.log(`  Caddy routes: ${caddyRoutes.map(r => r.subdomain).join(", ") || "none"}`);

  // ── Step 2: Service Discovery ──────────────────────────────────
  console.log("\n── Step 2: Service Discovery ──");

  // 2a: K8s services — prefer live ArgoCD API, fallback to Ansible
  let k8sServices: DiscoveredService[] = [];
  if (config.argocd.url && config.argocd.token) {
    k8sServices = await discoverArgoCDApps(config.argocd);
  }
  if (k8sServices.length === 0) {
    console.log("[pipeline] Falling back to Ansible for K8s app discovery");
    k8sServices = await discoverArgoApps(config);
  }

  // Assign K8s host
  if (k8sHost) {
    for (const svc of k8sServices) {
      if (!svc.hostId) svc.hostId = k8sHost.name;
    }
  }

  // 2b: Docker services — query Prometheus for ACTUALLY running containers
  // This is ground truth: docker_container_info only reports live containers
  let dockerServices: DiscoveredService[] = [];
  if (config.grafana.url && config.grafana.token) {
    dockerServices = await discoverRunningContainers({
      grafanaUrl: config.grafana.url,
      grafanaToken: config.grafana.token,
      datasourceUid: "mimir",
    });
  }

  // ── Build Host Map ─────────────────────────────────────────────
  const knownHostIPs: Record<string, string> = {
    "lw-main": "192.168.0.105",
    "lw-s1": "192.168.0.108",
    "lw-c1": "192.168.0.107",
    "lw-nas": "10.0.1.2",
  };

  const hostMap = new Map<string, { id: string; label: string; ip: string; tags: string[] }>();
  for (const d of namedDevices) {
    hostMap.set(d.name, { id: d.name, label: d.name, ip: d.ip || knownHostIPs[d.name] || "", tags: d.tags });
  }
  if (k8sHost && !hostMap.has(k8sHost.name)) {
    hostMap.set(k8sHost.name, { id: k8sHost.name, label: k8sHost.name, ip: k8sHost.ip, tags: [] });
  }
  if (!hostMap.has("lw-nas")) {
    hostMap.set("lw-nas", { id: "lw-nas", label: "lw-nas", ip: "10.0.1.2", tags: [] });
  }
  // Fill missing IPs
  for (const [name, ip] of Object.entries(knownHostIPs)) {
    const host = hostMap.get(name);
    if (host && !host.ip) host.ip = ip;
  }

  // ── Merge services ─────────────────────────────────────────────
  const serviceMap = new Map<string, DiscoveredService>();

  // K8s services (confirmed via ArgoCD)
  for (const svc of k8sServices) {
    serviceMap.set(svc.id, svc);
  }

  // Docker services (confirmed via Prometheus — actually running right now)
  // Host is already set correctly from the `instance` label
  for (const svc of dockerServices) {
    if (!serviceMap.has(svc.id)) {
      serviceMap.set(svc.id, svc);
    }
  }

  // Remove hosts that have zero services
  const hostsWithServices = new Set([
    ...k8sServices.map(s => s.hostId),
    ...dockerServices.map(s => s.hostId),
  ]);
  for (const key of [...hostMap.keys()]) {
    if (!hostsWithServices.has(key)) hostMap.delete(key);
  }

  const allServices = [...serviceMap.values()];
  console.log(`\n  Total services: ${allServices.length} (${k8sServices.length} K8s + ${dockerServices.length} Docker)`);

  // ── Step 3: Enrichment (Grafana + Caddy quickLinks) ────────────
  console.log("\n── Step 3: Enrichment ──");

  let dashboards: GrafanaDashboard[] = [];
  let dashboardMap = new Map<string, GrafanaDashboard[]>();

  if (config.grafana.url && config.grafana.token) {
    dashboards = await discoverDashboards(config.grafana);
    dashboardMap = matchDashboardsToServices(
      dashboards,
      allServices.map(s => s.id),
    );
    console.log(`  Dashboard matches: ${dashboardMap.size} services`);
  } else {
    console.log("  Grafana not configured — skipping");
  }

  // Build quickLinks from Caddy routes + Grafana dashboards
  const serviceQuickLinks = buildQuickLinks(allServices, caddyRoutes, dashboardMap, config.domain);

  // ── Step 4: Assemble Output ────────────────────────────────────
  console.log("\n── Step 4: Assembling output ──");

  // Remove ghost hosts that leaked from Ansible inventory group names
  const knownHosts = new Set(["lw-main", "lw-s1", "lw-c1", "lw-nas"]);
  for (const key of hostMap.keys()) {
    if (!knownHosts.has(key)) {
      hostMap.delete(key);
    }
  }

  // Build zones: primary network (192.168.0.0/24) + NAS subnet from Caddy hints
  // NetBox prefixes are mostly overlay networks (10.x, 172.x) — the physical LAN
  // (192.168.0.0/24) isn't tracked there, so we create it explicitly.
  const zones: Array<{ id: string; cidr: string; label: string; hostIds: string[] }> = [];

  // Primary LAN zone: contains lw-main, lw-s1, lw-c1
  zones.push({
    id: "primary",
    cidr: "192.168.0.0/24",
    label: "PRIMARY NETWORK",
    hostIds: [],
  });

  // NAS subnet: lw-nas is on a separate 10.0.1.0/24 network
  zones.push({
    id: "nas",
    cidr: "10.0.1.0/24",
    label: "NAS SUBNET",
    hostIds: [],
  });

  // K8s overlay from NetBox
  const k8sPrefix = physical.prefixes.find(p => p.description.toLowerCase().includes("kubernetes cluster"));
  if (k8sPrefix) {
    zones.push({
      id: "k8s",
      cidr: k8sPrefix.prefix,
      label: k8sPrefix.description.toUpperCase(),
      hostIds: [],
    });
  }

  // Assign colors and zone membership to hosts
  const hosts = [...hostMap.values()].map((h, idx) => ({
    ...h,
    zone: "",
    color: HOST_COLORS[idx % HOST_COLORS.length],
  }));

  for (const host of hosts) {
    for (const zone of zones) {
      if (ipInPrefix(host.ip, zone.cidr)) {
        host.zone = zone.id;
        zone.hostIds.push(host.id);
        break;
      }
    }
    if (!host.zone && zones.length > 0) {
      host.zone = zones[0].id;
      zones[0].hostIds.push(host.id);
    }
  }

  // Collect all unique tags
  const allTags = [...new Set(allServices.flatMap(s => s.tags))].sort();

  // Build connections
  const connections = [
    ...allServices.flatMap(s =>
      s.dependencies.map(dep => ({
        source: s.id,
        target: dep,
        type: "dependency" as const,
      }))
    ),
    ...physical.connections.map(c => ({
      source: c.sourceDevice,
      target: c.targetDevice,
      type: "physical" as const,
      label: c.label,
    })),
  ];

  const output: InfraVisionOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      sources: {
        netbox: config.netbox.url,
        ansible: config.ansiblePath,
        ...(config.argocd.url ? { argocd: config.argocd.url } : {}),
        ...(config.grafana.url ? { grafana: config.grafana.url } : {}),
      },
    },
    zones,
    hosts: hosts.map(h => ({
      id: h.id,
      label: h.label,
      ip: h.ip,
      zone: h.zone,
      color: h.color,
      tags: h.tags,
    })),
    services: allServices.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      hostId: s.hostId,
      type: s.type,
      ports: s.ports,
      ...(s.image ? { image: s.image } : {}),
      ...(s.chart ? { chart: s.chart } : {}),
      dependencies: s.dependencies,
      tags: s.tags,
      quickLinks: serviceQuickLinks.get(s.id) ?? [],
      ...(s.syncStatus ? { syncStatus: s.syncStatus } : {}),
      active: s.active,
    })),
    connections,
    tags: allTags,
  };

  // Write output
  const outputPath = resolve(import.meta.dirname, "../public/infravision-data.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`\n✓ Written to ${outputPath}`);
  console.log(`  ${output.hosts.length} hosts, ${output.services.length} services, ${output.zones.length} zones`);
  console.log(`  ${output.connections.length} connections, ${caddyRoutes.length} quickLink routes`);

  // Print summary table
  console.log("\n── Service Summary ──");
  for (const svc of output.services) {
    const links = svc.quickLinks.length > 0 ? ` [${svc.quickLinks.length} links]` : "";
    console.log(`  ${svc.type.padEnd(7)} ${svc.hostId.padEnd(14)} ${svc.label}${links}`);
  }
}

function buildQuickLinks(
  services: DiscoveredService[],
  caddyRoutes: CaddyRoute[],
  dashboardMap: Map<string, GrafanaDashboard[]>,
  domain: string,
): Map<string, Array<{ label: string; url: string; icon: string }>> {
  const result = new Map<string, Array<{ label: string; url: string; icon: string }>>();

  // Index Caddy routes by serviceId
  const routeByServiceId = new Map<string, CaddyRoute>();
  for (const route of caddyRoutes) {
    if (route.serviceId) {
      routeByServiceId.set(route.serviceId, route);
    }
  }

  // Map Caddy service IDs to actual service IDs for quickLink matching
  const quickLinkRemap: Record<string, string> = {
    "hashi-vault": "vault",
    "pdf": "stirling-pdf",
    "grafana": "grafana-stack",
  };
  for (const [caddyId, svcId] of Object.entries(quickLinkRemap)) {
    const route = routeByServiceId.get(caddyId);
    if (route && !routeByServiceId.has(svcId)) {
      routeByServiceId.set(svcId, route);
    }
  }

  for (const svc of services) {
    const links: Array<{ label: string; url: string; icon: string }> = [];

    // Exact match only — fuzzy matching causes too many false positives
    const matchedRoute = routeByServiceId.get(svc.id);

    if (matchedRoute) {
      links.push({
        label: "Open Web UI",
        url: `https://${matchedRoute.subdomain}.${domain}`,
        icon: "🌐",
      });
    }

    // Add Grafana dashboard links (rewrite localhost URLs to public domain)
    const dashboards = dashboardMap.get(svc.id);
    if (dashboards) {
      for (const dash of dashboards) {
        const publicUrl = dash.url.replace(/https?:\/\/localhost:\d+/, `https://grafana.${domain}`);
        links.push({
          label: `Dashboard: ${dash.title}`,
          url: publicUrl,
          icon: "📊",
        });
      }
    }

    if (links.length > 0) {
      result.set(svc.id, links);
    }
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

main().catch(err => {
  console.error("\n✗ Pipeline failed:", err.message);
  process.exit(1);
});
