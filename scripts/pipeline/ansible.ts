import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { CaddyRoute, DiscoveredService } from "./types.js";

interface AnsibleConfig {
  ansiblePath: string;
  domain: string;
}

/** Parse Caddy template + group_vars for reverse-proxied service routes */
export async function discoverCaddyRoutes(config: AnsibleConfig): Promise<CaddyRoute[]> {
  const groupVarsPath = join(
    config.ansiblePath,
    "security/secure-homelab-access/group_vars/all.yml"
  );
  const caddyTemplatePath = join(
    config.ansiblePath,
    "security/secure-homelab-access/roles/caddy/templates/Caddyfile.j2"
  );

  if (!existsSync(caddyTemplatePath) || !existsSync(groupVarsPath)) {
    console.warn("[ansible] Caddyfile template or group_vars not found");
    return [];
  }

  console.log("[ansible] Parsing Caddyfile template + group_vars...");
  const groupVars = await readFile(groupVarsPath, "utf-8");
  const caddyContent = await readFile(caddyTemplatePath, "utf-8");

  // Extract subdomain_* values from group_vars
  const subdomainMap = new Map<string, string>();
  const subdomainRegex = /^(subdomain_\w+):\s*["']?(\S+?)["']?\s*$/gm;
  let match;
  while ((match = subdomainRegex.exec(groupVars)) !== null) {
    subdomainMap.set(match[1], match[2]);
  }

  // Parse Caddy server blocks by scanning lines
  // Each service block starts with a "# Comment (on HOSTNAME)" line
  // followed by {{ _scheme }}{{ subdomain_X }}.{{ domain }} {
  const routes: CaddyRoute[] = [];
  const lines = caddyContent.split("\n");
  let lastComment = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track comments — host hints are in comments like "# Grafana (monitoring stack on lw-main)"
    if (line.startsWith("# ") && !line.startsWith("# --")) {
      lastComment = line.slice(2).trim();
      continue;
    }

    // Match subdomain variable reference in server block declaration
    const subMatch = line.match(/\{\{\s*(subdomain_\w+)\s*\}\}/);
    if (!subMatch) continue;

    const subdomainVar = subMatch[1];
    const subdomain = subdomainMap.get(subdomainVar) ?? subdomainVar.replace("subdomain_", "");

    // Already seen?
    if (routes.some(r => r.subdomain === subdomain)) continue;

    // Extract host hint from preceding comment (e.g., "on lw-main", "on lw-s1", "K8s on lw-c1")
    const hostHintMatch = lastComment.match(/on\s+(lw-\S+|[\w-]+\))/i);
    const hostHint = hostHintMatch ? hostHintMatch[1].replace(/[()]/g, "") : "";

    // Scan ahead for reverse_proxy target
    let backend = "";
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      if (lines[j].match(/^\s*\}/)) break;
      const proxyMatch = lines[j].match(/reverse_proxy\s+(?:https?:\/\/)?([^\s{]+)/);
      if (proxyMatch) {
        backend = proxyMatch[1];
        break;
      }
    }

    routes.push({
      subdomain,
      backend,
      serviceId: subdomainVar.replace("subdomain_", ""),
      hostHint: hostHint || undefined,
    });
  }

  console.log(`[ansible] Found ${routes.length} Caddy routes: ${routes.map(r => r.subdomain).join(", ")}`);
  return routes;
}

/** Parse ArgoCD applications from k3s-setup group_vars */
export async function discoverArgoApps(config: AnsibleConfig): Promise<DiscoveredService[]> {
  const groupVarsPath = join(config.ansiblePath, "k8s/k3s-setup/group_vars/all.yml");

  if (!existsSync(groupVarsPath)) {
    console.warn("[ansible] k3s group_vars not found");
    return [];
  }

  console.log("[ansible] Parsing ArgoCD applications from group_vars...");
  const content = await readFile(groupVarsPath, "utf-8");
  const services: DiscoveredService[] = [];

  // Extract individual app entries using a direct regex
  const appRegex = /- name:\s*(\S+)\s*\n\s+chart_path:\s*(\S+)\s*\n\s+namespace:\s*(\S+)/g;
  let appMatch;
  while ((appMatch = appRegex.exec(content)) !== null) {
    services.push({
      id: appMatch[1],
      label: appMatch[1],
      description: "",
      hostId: "",
      type: "k8s",
      ports: [],
      chart: appMatch[2],
      namespace: appMatch[3],
      dependencies: [],
      tags: [],
      active: true,
    });
  }

  if (services.length === 0) {
    console.warn("[ansible] No argocd_applications found in group_vars");
  }

  // ArgoCD itself is always present
  services.unshift({
    id: "argocd",
    label: "ArgoCD",
    description: "GitOps continuous delivery tool",
    hostId: "",
    type: "k8s",
    ports: [8443],
    dependencies: [],
    tags: ["automation", "dev-tools"],
    active: true,
  });

  console.log(`[ansible] Found ${services.length} ArgoCD applications: ${services.map(s => s.id).join(", ")}`);
  return services;
}

/** Discover k3s host from inventory */
export async function discoverK8sHost(config: AnsibleConfig): Promise<{ name: string; ip: string } | null> {
  const inventoryPath = join(config.ansiblePath, "k8s/k3s-setup/inventory/hosts.ini");

  if (!existsSync(inventoryPath)) {
    console.warn("[ansible] K3s inventory not found");
    return null;
  }

  const content = await readFile(inventoryPath, "utf-8");
  const hostMatch = content.match(/^(\S+)\s+ansible_host=(\d+\.\d+\.\d+\.\d+)/m);
  if (hostMatch) {
    return { name: hostMatch[1], ip: hostMatch[2] };
  }
  return null;
}

interface PlaybookDiscovery {
  id: string;
  label: string;
  description: string;
  targetHost: string;
  type: "docker" | "native";
  ports: number[];
  image?: string;
  tags: string[];
}

/** Discover Docker/native services by scanning Ansible setup playbooks */
export async function discoverAnsibleServices(config: AnsibleConfig): Promise<DiscoveredService[]> {
  const services: DiscoveredService[] = [];
  const ansibleRoot = resolve(config.ansiblePath);
  const seen = new Set<string>();

  // Only scan categories that represent deployable infrastructure
  // Skip dev-tools (MCP servers, CLI tools — not infrastructure)
  const categories = ["automation", "monitoring", "security", "files", "infrastructure"];

  for (const category of categories) {
    const categoryPath = join(ansibleRoot, category);
    if (!existsSync(categoryPath)) continue;

    const entries = await readdir(categoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith("-setup")) continue;

      const setupDir = join(categoryPath, entry.name);
      const setupYml = join(setupDir, "setup.yml");
      if (!existsSync(setupYml)) continue;

      const setupContent = await readFile(setupYml, "utf-8");

      // Extract target host — look for ansible_host or hosts: field
      const hostsMatch = setupContent.match(/hosts:\s*(\S+)/);
      let targetHost = hostsMatch ? hostsMatch[1] : "";

      // Derive service name from directory name (strip "-setup" suffix)
      const serviceName = entry.name.replace(/-setup$/, "");
      if (seen.has(serviceName)) continue;
      seen.add(serviceName);

      // Determine type: check for docker-compose templates OR docker_container module usage
      const hasDockerCompose = await hasFileMatching(setupDir, "docker-compose");
      const hasDockerContainer = await fileContainsPattern(setupDir, "docker_container");
      const serviceType = (hasDockerCompose || hasDockerContainer) ? "docker" : "native";

      // Try to extract image from docker-compose template
      let image: string | undefined;
      if (hasDockerCompose) {
        image = await extractPrimaryImage(setupDir);
      }

      // Extract description from setup.yml comment or first play name
      const descMatch = setupContent.match(/- name:\s*["']?([^"'\n]+)/);
      const description = descMatch ? descMatch[1].trim() : "";

      services.push({
        id: serviceName,
        label: prettifyName(serviceName),
        description,
        hostId: targetHost,
        type: serviceType,
        ports: [],
        image,
        dependencies: [],
        tags: [category],
        active: true,
      });
    }
  }

  console.log(`[ansible] Found ${services.length} Ansible services: ${services.map(s => s.id).join(", ")}`);
  return services;
}

/** Check for NAS-specific services */
export async function discoverNasServices(config: AnsibleConfig): Promise<DiscoveredService[]> {
  const nasPlaybook = join(config.ansiblePath, "files/nas-setup/nas.yml");
  if (!existsSync(nasPlaybook)) return [];

  console.log("[ansible] Scanning NAS playbook...");
  const content = await readFile(nasPlaybook, "utf-8");
  const services: DiscoveredService[] = [];

  const roleMatches = [...content.matchAll(/role:\s*(\w[\w-]*)/g)];
  for (const match of roleMatches) {
    const roleName = match[1];
    services.push({
      id: roleName,
      label: prettifyName(roleName),
      description: "",
      hostId: "",
      type: "native",
      ports: [],
      dependencies: [],
      tags: ["storage"],
      active: true,
    });
  }

  console.log(`[ansible] Found ${services.length} NAS services: ${services.map(s => s.id).join(", ")}`);
  return services;
}

async function fileContainsPattern(dir: string, pattern: string): Promise<boolean> {
  const walk = async (d: string): Promise<boolean> => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (await walk(join(d, entry.name))) return true;
      } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
        const content = await readFile(join(d, entry.name), "utf-8");
        if (content.includes(pattern)) return true;
      }
    }
    return false;
  };
  return walk(dir);
}

async function hasFileMatching(dir: string, pattern: string): Promise<boolean> {
  const walk = async (d: string): Promise<boolean> => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (await walk(join(d, entry.name))) return true;
      } else if (entry.name.includes(pattern)) {
        return true;
      }
    }
    return false;
  };
  return walk(dir);
}

async function extractPrimaryImage(dir: string): Promise<string | undefined> {
  const walk = async (d: string): Promise<string | undefined> => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = await walk(join(d, entry.name));
        if (result) return result;
      } else if (entry.name.includes("docker-compose") && entry.name.endsWith(".j2")) {
        const content = await readFile(join(d, entry.name), "utf-8");
        // Look for image: lines, prefer ones without Jinja2 variables
        const imageMatches = [...content.matchAll(/image:\s*["']?(\S+)/g)];
        for (const m of imageMatches) {
          const img = m[1].replace(/["']/g, "");
          if (!img.startsWith("{{")) return img;
        }
        // If all images are Jinja2, return first one cleaned up
        if (imageMatches.length > 0) {
          const raw = imageMatches[0][1].replace(/["']/g, "");
          // Try to extract default value: {{ var | default('image:tag') }}
          const defaultMatch = raw.match(/default\(['"]([^'"]+)['"]\)/);
          if (defaultMatch) return defaultMatch[1];
        }
      }
    }
    return undefined;
  };
  return walk(dir);
}

function prettifyName(id: string): string {
  return id
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
