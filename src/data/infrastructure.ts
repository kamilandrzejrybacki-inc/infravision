import type { Service, Host, NetworkZone, Connection, InfraVisionData } from './types';

// Deprecated: Use Connection type from types.ts instead
export interface Dependency {
  source: string;
  target: string;
  label?: string;
}

// --- Host Colors ---
export const HOST_COLORS: Record<string, string> = {
  "lw-c1": "0 65% 55%",       // red
  "lw-n1": "35 80% 55%",      // amber
  "lw-n2": "160 50% 50%",     // teal
  "lw-nas": "220 50% 60%",    // blue
  "lw-main": "270 45% 60%",   // purple
};

// --- Services ---
const services: Service[] = [
  // lw-c1 (K3s cluster)
  {
    id: "argocd", label: "ArgoCD", description: "GitOps continuous delivery tool",
    hostId: "lw-c1", type: "k8s", ports: [443], chart: "argo/argo-cd",
    dependencies: [], tags: ["automation", "dev-tools"],
    quickLinks: [
      { label: "Open Web UI", url: "https://argocd.lab.local", icon: "🌐" },
      { label: "Grafana Dashboard", url: "https://grafana.lab.local/d/argocd", icon: "📊" },
    ],
    syncStatus: "synced",
  },
  {
    id: "n8n-workers", label: "n8n-workers", description: "Distributed n8n worker nodes",
    hostId: "lw-c1", type: "k8s", ports: [5679], chart: "n8n/n8n",
    dependencies: ["postgresql", "redis"], tags: ["automation", "workflow"],
    quickLinks: [],
    syncStatus: "synced",
  },
  {
    id: "prefect-etl", label: "prefect-etl", description: "ETL orchestration with Prefect",
    hostId: "lw-c1", type: "k8s", ports: [4200], chart: "prefecthq/prefect-server",
    dependencies: ["postgresql"], tags: ["automation", "ai"],
    quickLinks: [
      { label: "Open Web UI", url: "https://prefect.lab.local", icon: "🌐" },
    ],
    syncStatus: "out-of-sync",
  },
  {
    id: "github-runners", label: "github-runners", description: "Self-hosted GitHub Actions runners",
    hostId: "lw-c1", type: "k8s", ports: [], chart: "actions/actions-runner-controller",
    dependencies: [], tags: ["dev-tools", "automation"],
    quickLinks: [],
    syncStatus: "synced",
  },

  // lw-n1
  {
    id: "caddy", label: "Caddy", description: "Reverse proxy and TLS termination",
    hostId: "lw-n1", type: "docker", ports: [80, 443], image: "caddy:2-alpine",
    dependencies: [], tags: ["security"],
    quickLinks: [
      { label: "NetBox Entry", url: "https://netbox.lab.local/dcim/devices/caddy", icon: "📦" },
    ],
  },
  {
    id: "n8n", label: "n8n", description: "Workflow automation platform",
    hostId: "lw-n1", type: "docker", ports: [5678], image: "docker.n8n.io/n8nio/n8n",
    dependencies: ["postgresql", "redis"], tags: ["automation", "workflow"],
    quickLinks: [
      { label: "Open Web UI", url: "https://n8n.lab.local", icon: "🌐" },
      { label: "Grafana Dashboard", url: "https://grafana.lab.local/d/n8n", icon: "📊" },
      { label: "NetBox Entry", url: "https://netbox.lab.local/dcim/devices/n8n", icon: "📦" },
    ],
  },
  {
    id: "postgresql", label: "PostgreSQL", description: "Primary relational database",
    hostId: "lw-n1", type: "docker", ports: [5432], image: "postgres:16-alpine",
    dependencies: [], tags: ["storage"],
    quickLinks: [
      { label: "Grafana Dashboard", url: "https://grafana.lab.local/d/postgres", icon: "📊" },
    ],
  },
  {
    id: "redis", label: "Redis", description: "In-memory data store and message broker",
    hostId: "lw-n1", type: "docker", ports: [6379], image: "redis:7-alpine",
    dependencies: [], tags: ["storage"],
    quickLinks: [],
  },
  {
    id: "grafana-stack", label: "Grafana stack", description: "Monitoring, alerting, and visualization",
    hostId: "lw-n1", type: "docker", ports: [3000], image: "grafana/grafana:latest",
    dependencies: ["postgresql"], tags: ["monitoring"],
    quickLinks: [
      { label: "Open Web UI", url: "https://grafana.lab.local", icon: "🌐" },
    ],
  },
  {
    id: "vault", label: "Vault", description: "Secrets management",
    hostId: "lw-n1", type: "docker", ports: [8200], image: "hashicorp/vault:latest",
    dependencies: [], tags: ["security"],
    quickLinks: [
      { label: "Open Web UI", url: "https://vault.lab.local", icon: "🌐" },
    ],
  },

  // lw-n2
  {
    id: "paperless", label: "Paperless", description: "Document management system",
    hostId: "lw-n2", type: "docker", ports: [8000], image: "paperlessngx/paperless-ngx",
    dependencies: ["postgresql", "redis"], tags: ["files", "ai"],
    quickLinks: [
      { label: "Open Web UI", url: "https://paperless.lab.local", icon: "🌐" },
    ],
  },
  {
    id: "seafile", label: "Seafile", description: "File sync and share platform",
    hostId: "lw-n2", type: "docker", ports: [8082], image: "seafileltd/seafile-mc",
    dependencies: [], tags: ["files", "storage"],
    quickLinks: [
      { label: "Open Web UI", url: "https://seafile.lab.local", icon: "🌐" },
    ],
  },
  {
    id: "uptime-kuma", label: "Uptime Kuma", description: "Uptime monitoring dashboard",
    hostId: "lw-n2", type: "docker", ports: [3001], image: "louislam/uptime-kuma",
    dependencies: [], tags: ["monitoring"],
    quickLinks: [
      { label: "Open Web UI", url: "https://uptime.lab.local", icon: "🌐" },
      { label: "Grafana Dashboard", url: "https://grafana.lab.local/d/uptime", icon: "📊" },
    ],
  },

  // lw-nas
  {
    id: "mergerfs", label: "mergerfs pool", description: "JBOD filesystem pooling",
    hostId: "lw-nas", type: "native", ports: [],
    dependencies: [], tags: ["storage", "files"],
    quickLinks: [],
  },
  {
    id: "snapraid", label: "SnapRAID", description: "Snapshot parity for disk arrays",
    hostId: "lw-nas", type: "native", ports: [],
    dependencies: ["mergerfs"], tags: ["storage"],
    quickLinks: [],
  },
  {
    id: "mimir-loki", label: "Mimir / Loki", description: "Long-term metrics and log storage",
    hostId: "lw-nas", type: "docker", ports: [3100, 9009], image: "grafana/mimir + grafana/loki",
    dependencies: [], tags: ["monitoring", "storage"],
    quickLinks: [
      { label: "Grafana Dashboard", url: "https://grafana.lab.local/d/mimir", icon: "📊" },
    ],
  },
];

// --- Hosts ---
export const hosts: Host[] = [
  {
    id: "lw-c1", label: "lw-c1", ip: ".107", zone: "primary",
    color: HOST_COLORS["lw-c1"],
    services: services.filter(s => s.hostId === "lw-c1"),
    tags: ["automation", "dev-tools"],
  },
  {
    id: "lw-n1", label: "lw-n1", ip: ".105", zone: "primary",
    color: HOST_COLORS["lw-n1"],
    services: services.filter(s => s.hostId === "lw-n1"),
    tags: ["automation", "monitoring", "storage", "security"],
  },
  {
    id: "lw-n2", label: "lw-n2", ip: ".108", zone: "primary",
    color: HOST_COLORS["lw-n2"],
    services: services.filter(s => s.hostId === "lw-n2"),
    tags: ["files", "monitoring"],
  },
  {
    id: "lw-nas", label: "lw-nas", ip: "10.0.1.2", zone: "nas",
    color: HOST_COLORS["lw-nas"],
    services: services.filter(s => s.hostId === "lw-nas"),
    tags: ["storage", "monitoring"],
  },
];

export const zones: NetworkZone[] = [
  {
    id: "primary",
    cidr: "192.168.0.0/24",
    label: "PRIMARY NETWORK",
    hostIds: ["lw-c1", "lw-n1", "lw-n2"],
  },
  {
    id: "nas",
    cidr: "10.0.1.0/24",
    label: "NAS SUBNET",
    hostIds: ["lw-nas"],
  },
];

export const dependencies: Dependency[] = [
  { source: "n8n", target: "postgresql" },
  { source: "n8n", target: "redis" },
  { source: "n8n-workers", target: "postgresql" },
  { source: "n8n-workers", target: "redis" },
  { source: "prefect-etl", target: "postgresql" },
  { source: "grafana-stack", target: "postgresql" },
  { source: "paperless", target: "postgresql" },
  { source: "paperless", target: "redis" },
  { source: "snapraid", target: "mergerfs" },
];

export const physicalConnections: Dependency[] = [
  { source: "lw-n1", target: "lw-nas", label: "USB-eth" },
];

export const allTags = [
  "automation", "monitoring", "storage", "ai", "security", "files", "dev-tools", "workflow",
];

export function getAllServices(): Service[] {
  return services;
}

export function getServiceById(id: string): Service | undefined {
  return services.find(s => s.id === id);
}

export function getHostById(id: string): Host | undefined {
  return hosts.find(h => h.id === id);
}
