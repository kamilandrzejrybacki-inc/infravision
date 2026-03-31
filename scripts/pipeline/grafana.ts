import type { GrafanaDashboard } from "./types.js";

interface GrafanaConfig {
  url: string;
  token: string;
}

interface GrafanaSearchResult {
  uid: string;
  title: string;
  url: string;
  tags: string[];
  type: string;
}

/** Step 3: Query Grafana for dashboards to generate quickLinks per service */
export async function discoverDashboards(config: GrafanaConfig): Promise<GrafanaDashboard[]> {
  console.log("[grafana] Searching dashboards...");

  const res = await fetch(`${config.url}/api/search?type=dash-db&limit=100`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`[grafana] API returned ${res.status} — skipping dashboard enrichment`);
    return [];
  }

  const results = (await res.json()) as GrafanaSearchResult[];

  const dashboards: GrafanaDashboard[] = results
    .filter(r => r.type === "dash-db")
    .map(r => ({
      uid: r.uid,
      title: r.title,
      url: `${config.url}${r.url}`,
      tags: r.tags,
    }));

  console.log(`[grafana] Found ${dashboards.length} dashboards`);
  return dashboards;
}

/** Match dashboards to service IDs by title/tag heuristics */
export function matchDashboardsToServices(
  dashboards: GrafanaDashboard[],
  serviceIds: string[],
): Map<string, GrafanaDashboard[]> {
  const result = new Map<string, GrafanaDashboard[]>();

  for (const svcId of serviceIds) {
    const normalizedId = svcId.toLowerCase().replace(/[-_]/g, "");
    const matches = dashboards.filter(d => {
      const normalizedTitle = d.title.toLowerCase().replace(/[-_\s]/g, "");
      const normalizedTags = d.tags.map(t => t.toLowerCase().replace(/[-_]/g, ""));
      return (
        normalizedTitle.includes(normalizedId) ||
        normalizedTags.some(t => t.includes(normalizedId)) ||
        normalizedId.includes(normalizedTitle.replace(/\s/g, ""))
      );
    });

    if (matches.length > 0) {
      result.set(svcId, matches);
    }
  }

  return result;
}
