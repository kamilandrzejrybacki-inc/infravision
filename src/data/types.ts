export interface QuickLink {
  label: string;
  url: string;
  icon: string;
}

export interface Service {
  id: string;
  label: string;
  description: string;
  hostId: string;
  type: "docker" | "k8s" | "native";
  ports: number[];
  image?: string;
  chart?: string;
  namespace?: string;
  syncStatus?: "synced" | "out-of-sync" | "failed";
  dependencies: string[];
  tags: string[];
  quickLinks: QuickLink[];
  ansiblePlaybook?: string;
  argocdApp?: string;
  active?: boolean; // false = defined in Ansible but not deployed/running
}

export interface Host {
  id: string;
  label: string;
  ip: string;
  fullIp?: string;
  zone: string;
  color: string;
  services: Service[];
  tags: string[];
  netboxUrl?: string;
  grafanaDashboard?: string;
}

export interface NetworkZone {
  id: string;
  cidr: string;
  label: string;
  hostIds: string[];
}

export interface Connection {
  source: string;
  target: string;
  label?: string;
  type: "dependency" | "physical";
}

export interface InfraVisionData {
  metadata: {
    generated_at: string;
    sources: {
      netbox: string;
      ansible: string;
      argocd: string;
      prometheus: string;
    };
  };
  zones: NetworkZone[];
  hosts: Host[];
  services: Service[];
  connections: Connection[];
  tags: string[];
}
