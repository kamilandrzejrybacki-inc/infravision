import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

interface DepConfig {
  ansiblePath: string;
}

interface DepLink {
  source: string;
  target: string;
}

/** Discover service dependencies from Ansible docker-compose templates and task files */
export async function discoverDependencies(
  config: DepConfig,
  runningServiceIds: Set<string>,
): Promise<DepLink[]> {
  console.log("[dependencies] Scanning Ansible for service dependencies...");

  const deps: DepLink[] = [];
  const seen = new Set<string>();

  // Map container names to our service IDs
  // Some Ansible templates reference containers by their docker-compose service name
  // which may differ from our service ID
  const containerAliases: Record<string, string> = {
    "postgres": "shared-postgres",
    "db": "shared-postgres",
    "redis": "shared-redis",
    "redis-cache": "shared-redis",
    "mariadb": "shared-mariadb",
    "memcached": "shared-mariadb", // close enough — seafile uses memcached but we track mariadb
    "grafana": "grafana",
    "loki": "loki",
    "mimir": "mimir",
  };

  // Also include direct service ID matches
  for (const id of runningServiceIds) {
    containerAliases[id] = id;
  }

  const categories = ["automation", "monitoring", "security", "files", "infrastructure"];

  for (const category of categories) {
    const categoryPath = join(config.ansiblePath, category);
    if (!existsSync(categoryPath)) continue;

    const entries = await readdir(categoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith("-setup")) continue;

      const setupDir = join(categoryPath, entry.name);
      const serviceId = entry.name.replace(/-setup$/, "");

      // Only care about dependencies FOR services that are actually running
      if (!runningServiceIds.has(serviceId)) continue;

      // Scan all .j2 and .yml files in this setup directory for references
      const referencedServices = await scanForServiceReferences(
        setupDir,
        containerAliases,
        runningServiceIds,
      );

      for (const targetId of referencedServices) {
        if (targetId === serviceId) continue; // no self-references
        const key = `${serviceId}→${targetId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deps.push({ source: serviceId, target: targetId });
      }
    }
  }

  // n8n specifically depends on postgres and redis (deployed on lw-s1, connects to lw-nas)
  // The n8n-setup uses docker_container, not docker-compose, so it won't have depends_on
  addIfBothRunning(deps, seen, "n8n", "shared-postgres", runningServiceIds);
  addIfBothRunning(deps, seen, "n8n", "shared-redis", runningServiceIds);

  // Grafana depends on Mimir (Prometheus datasource) and Loki
  addIfBothRunning(deps, seen, "grafana", "mimir", runningServiceIds);
  addIfBothRunning(deps, seen, "grafana", "loki", runningServiceIds);

  console.log(`[dependencies] Found ${deps.length} dependency links`);
  for (const d of deps) {
    console.log(`  ${d.source} → ${d.target}`);
  }

  return deps;
}

function addIfBothRunning(
  deps: DepLink[],
  seen: Set<string>,
  source: string,
  target: string,
  running: Set<string>,
) {
  const key = `${source}→${target}`;
  if (!seen.has(key) && running.has(source) && running.has(target)) {
    seen.add(key);
    deps.push({ source, target });
  }
}

async function scanForServiceReferences(
  dir: string,
  aliases: Record<string, string>,
  runningIds: Set<string>,
): Promise<Set<string>> {
  const found = new Set<string>();

  const walk = async (d: string) => {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".j2") && !entry.name.endsWith(".yml") && !entry.name.endsWith(".yaml")) continue;

      const content = await readFile(fullPath, "utf-8");

      // Check depends_on sections
      const dependsMatches = content.matchAll(/depends_on:[\s\S]*?(?=\n\s{2}\w|\n\w|$)/g);
      for (const m of dependsMatches) {
        const block = m[0];
        for (const [alias, svcId] of Object.entries(aliases)) {
          if (block.includes(alias) && runningIds.has(svcId)) {
            found.add(svcId);
          }
        }
      }

      // Check env var references to known services
      // Patterns: POSTGRES_HOST, REDIS_URL, DB_HOST, etc. containing service names
      for (const [alias, svcId] of Object.entries(aliases)) {
        if (!runningIds.has(svcId)) continue;
        // Look for the alias in host/url references
        const patterns = [
          new RegExp(`_HOST[:\s]*["']?${alias}`, "i"),
          new RegExp(`_URL[:\s]*["']?\\w+://${alias}`, "i"),
          new RegExp(`_SERVER[:\s]*["']?${alias}`, "i"),
          new RegExp(`depends_on:[\\s\\S]*?\\b${alias}\\b`),
        ];
        for (const pat of patterns) {
          if (pat.test(content)) {
            found.add(svcId);
            break;
          }
        }
      }
    }
  };

  await walk(dir);
  return found;
}
