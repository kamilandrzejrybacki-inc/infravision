/** Raw physical device from NetBox */
export interface PhysicalDevice {
  id: number;
  name: string;
  ip: string;
  status: "active" | "offline" | "planned";
  site: string;
  role: string;
  interfaces: PhysicalInterface[];
  tags: string[];
}

export interface PhysicalInterface {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  cableId: number | null;
}

export interface NetworkPrefix {
  id: number;
  prefix: string;
  description: string;
  status: string;
}

export interface PhysicalConnection {
  sourceDevice: string;
  targetDevice: string;
  sourceInterface: string;
  targetInterface: string;
  label: string;
}

/** Discovered service from ArgoCD, Docker, or systemd */
export interface DiscoveredService {
  id: string;
  label: string;
  description: string;
  hostId: string;
  type: "k8s" | "docker" | "native";
  ports: number[];
  image?: string;
  chart?: string;
  namespace?: string;
  dependencies: string[];
  tags: string[];
  active: boolean;
  syncStatus?: string;
}

/** Caddy route discovered from Ansible template */
export interface CaddyRoute {
  subdomain: string;
  backend: string;
  serviceId?: string;
  hostHint?: string;
}

/** Grafana dashboard link for enrichment */
export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
  tags: string[];
}

/** Pipeline configuration */
export interface PipelineConfig {
  netbox: { url: string; token: string };
  argocd: { url: string; token: string; password?: string };
  grafana: { url: string; token: string };
  domain: string;
  ansiblePath: string;
}

/** The final output matching infravision-data.json schema */
export interface InfraVisionOutput {
  metadata: {
    generated_at: string;
    sources: Record<string, string>;
  };
  zones: Array<{
    id: string;
    cidr: string;
    label: string;
    hostIds: string[];
  }>;
  hosts: Array<{
    id: string;
    label: string;
    ip: string;
    zone: string;
    color: string;
    tags: string[];
  }>;
  services: Array<{
    id: string;
    label: string;
    description: string;
    hostId: string;
    type: "k8s" | "docker" | "native";
    ports: number[];
    image?: string;
    chart?: string;
    dependencies: string[];
    tags: string[];
    quickLinks: Array<{ label: string; url: string; icon: string }>;
    syncStatus?: string;
    active: boolean;
  }>;
  connections: Array<{
    source: string;
    target: string;
    type: "dependency" | "physical";
    label?: string;
  }>;
  tags: string[];
}
