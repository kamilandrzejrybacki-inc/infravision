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

/**
 * Discover service dependencies dynamically from Ansible templates.
 * No hardcoded service names — builds alias map from running service IDs
 * and scans for depends_on, _HOST, _URL env var references.
 */
export async function discoverDependencies(
  config: DepConfig,
  runningServiceIds: Set<string>,
): Promise<DepLink[]> {
  console.log("[dependencies] Scanning Ansible for service dependencies...");

  const deps: DepLink[] = [];
  const seen = new Set<string>();

  // Build alias map dynamically from running service IDs
  // "shared-postgres" → aliases: ["postgres", "db", "postgresql"]
  // "shared-redis" → aliases: ["redis", "redis-cache"]
  // Any running service ID also matches as its own alias
  const aliasToServiceId = new Map<string, string>();
  for (const id of runningServiceIds) {
    aliasToServiceId.set(id, id);

    // Generate common aliases by stripping prefixes/suffixes
    const stripped = id.replace(/^shared-/, "");
    if (stripped !== id) aliasToServiceId.set(stripped, id);

    // Common DB alias: "db" if this looks like a database service
    if (/postgres/i.test(id)) {
      aliasToServiceId.set("db", id);
      aliasToServiceId.set("postgres", id);
      aliasToServiceId.set("postgresql", id);
    }
    if (/redis/i.test(id)) {
      aliasToServiceId.set("redis", id);
      aliasToServiceId.set("redis-cache", id);
    }
    if (/mariadb|mysql/i.test(id)) {
      aliasToServiceId.set("mariadb", id);
      aliasToServiceId.set("mysql", id);
    }
  }

  // Scan all Ansible setup directories
  const ansibleRoot = config.ansiblePath;
  const categories = await listSubdirs(ansibleRoot);

  for (const category of categories) {
    const categoryPath = join(ansibleRoot, category);
    const entries = await listSubdirs(categoryPath);

    for (const dirName of entries) {
      if (!dirName.endsWith("-setup")) continue;

      const setupDir = join(categoryPath, dirName);
      const serviceId = dirName.replace(/-setup$/, "");

      // Only discover deps for services that are actually running
      if (!runningServiceIds.has(serviceId)) continue;

      const referencedServices = await scanForServiceReferences(
        setupDir,
        aliasToServiceId,
        runningServiceIds,
      );

      for (const targetId of referencedServices) {
        if (targetId === serviceId) continue;
        const key = `${serviceId}→${targetId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deps.push({ source: serviceId, target: targetId });
      }
    }
  }

  console.log(`[dependencies] Found ${deps.length} dependency links`);
  for (const d of deps) {
    console.log(`  ${d.source} → ${d.target}`);
  }

  return deps;
}

async function listSubdirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

async function scanForServiceReferences(
  dir: string,
  aliases: Map<string, string>,
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
      const dependsBlock = content.match(/depends_on:[\s\S]*?(?=\n\s{0,2}\w|\n---|\z)/g);
      if (dependsBlock) {
        for (const block of dependsBlock) {
          for (const [alias, svcId] of aliases) {
            if (block.includes(alias) && runningIds.has(svcId)) {
              found.add(svcId);
            }
          }
        }
      }

      // Check env var references: *_HOST, *_URL, *_SERVER containing service names
      for (const [alias, svcId] of aliases) {
        if (!runningIds.has(svcId)) continue;
        if (alias.length < 3) continue; // skip very short aliases to avoid false positives

        const patterns = [
          new RegExp(`_HOST[:\\s]*["']?${escapeRegex(alias)}`, "i"),
          new RegExp(`_URL[:\\s]*["']?\\w+://${escapeRegex(alias)}`, "i"),
          new RegExp(`_SERVER[:\\s]*["']?${escapeRegex(alias)}`, "i"),
          new RegExp(`depends_on:[\\s\\S]*?\\b${escapeRegex(alias)}\\b`),
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
