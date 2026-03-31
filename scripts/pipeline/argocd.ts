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

/** Get a session token from ArgoCD using admin credentials */
export async function getArgoCDSessionToken(url: string, password: string): Promise<string | null> {
  if (!password) return null;

  if (!url.startsWith("https://") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
    console.warn("[argocd] WARNING: ARGOCD_URL is not HTTPS — password auth disabled to prevent credential exposure over plaintext");
    console.warn("[argocd] Use ARGOCD_TOKEN instead, or set ARGOCD_URL to an HTTPS endpoint");
    return null;
  }

  try {
    const res = await fetch(`${url}/api/v1/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password }),
    });

    if (!res.ok) {
      console.warn(`[argocd] Session login failed: ${res.status}`);
      return null;
    }

    const data = await res.json() as { token: string };
    return data.token;
  } catch (err) {
    console.warn(`[argocd] Session login error: ${err}`);
    return null;
  }
}

/** Query ArgoCD API for live application status */
export async function discoverArgoCDApps(config: ArgoCDConfig): Promise<DiscoveredService[]> {
  console.log("[argocd] Querying live applications...");

  const res = await fetch(`${config.url}/api/v1/applications`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`[argocd] API returned ${res.status} — falling back to Ansible`);
    return [];
  }

  const data = (await res.json()) as ArgoCDAppList;
  const apps = data.items ?? [];

  console.log(`[argocd] Found ${apps.length} live applications`);

  return apps.map(app => {
    const syncStatus = app.status?.sync?.status ?? "Unknown";
    const healthStatus = app.status?.health?.status ?? "Unknown";
    const normalizedSync = syncStatus === "Synced" ? "synced"
      : syncStatus === "OutOfSync" ? "out-of-sync"
      : syncStatus.toLowerCase();

    return {
      id: app.metadata.name,
      label: prettifyName(app.metadata.name),
      description: "",
      hostId: "",
      type: "k8s" as const,
      ports: [],
      chart: app.spec.source?.path ?? app.spec.source?.chart,
      namespace: app.spec.destination?.namespace ?? app.metadata.namespace,
      dependencies: [],
      tags: [],
      active: healthStatus !== "Missing",
      syncStatus: normalizedSync,
    };
  });
}

function prettifyName(name: string): string {
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
