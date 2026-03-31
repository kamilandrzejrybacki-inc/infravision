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

  // Allow plaintext HTTP only for local/private networks
  if (!url.startsWith("https://")) {
    const host = new URL(url).hostname;
    const isPrivate = host === "localhost" || host === "127.0.0.1" ||
      host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (!isPrivate) {
      console.warn("[argocd] WARNING: ARGOCD_URL is not HTTPS and not a private network — password auth disabled");
      return null;
    }
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
