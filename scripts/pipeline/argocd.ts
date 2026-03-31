import type { DiscoveredService } from "./types.js";

interface ArgoCDConfig {
  url: string;
  token: string;
}

interface ArgoCDApplication {
  metadata: { name: string; namespace: string };
  spec: {
    source?: {
      repoURL?: string;
      path?: string;
      chart?: string;
      helm?: { parameters?: Array<{ name: string; value: string }> };
    };
    destination?: { namespace?: string };
  };
  status?: {
    sync?: { status: string };
    health?: { status: string };
  };
}

interface ArgoCDAppList {
  items: ArgoCDApplication[];
}

/** Step 2a: Query ArgoCD API for live application status */
export async function discoverArgoCDApps(config: ArgoCDConfig): Promise<DiscoveredService[]> {
  console.log("[argocd] Querying applications...");

  const res = await fetch(`${config.url}/api/v1/applications`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
    // ArgoCD self-signed cert
    ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ? {} : {}),
  });

  if (!res.ok) {
    console.warn(`[argocd] API returned ${res.status} — falling back to Ansible-discovered apps`);
    return [];
  }

  const data = (await res.json()) as ArgoCDAppList;
  const apps = data.items ?? [];

  console.log(`[argocd] Found ${apps.length} live applications`);

  return apps.map(app => {
    const syncStatus = app.status?.sync?.status?.toLowerCase() ?? "unknown";
    const healthStatus = app.status?.health?.status?.toLowerCase() ?? "unknown";

    return {
      id: app.metadata.name,
      label: app.metadata.name,
      description: "",
      hostId: "", // Will be resolved to K8s host
      type: "k8s" as const,
      ports: [],
      chart: app.spec.source?.path ?? app.spec.source?.chart,
      namespace: app.spec.destination?.namespace ?? app.metadata.namespace,
      dependencies: [],
      tags: [],
      active: healthStatus !== "missing" && healthStatus !== "unknown",
      syncStatus: syncStatus === "synced" ? "synced"
        : syncStatus === "outofsync" ? "out-of-sync"
        : syncStatus,
    };
  });
}
