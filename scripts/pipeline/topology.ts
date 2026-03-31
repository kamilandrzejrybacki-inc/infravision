import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { PhysicalDevice, NetworkPrefix } from "./types.js";

interface TopologyConfig {
  ansiblePath: string;
}

interface PhysicalLink {
  source: string;
  target: string;
  label: string;
  sourceInterface?: string;
  targetInterface?: string;
}

interface NetworkDevice {
  id: string;
  label: string;
  ip: string;
  role: "router" | "switch" | "server";
}

export interface PhysicalTopology {
  networkDevices: NetworkDevice[];
  links: PhysicalLink[];
}

/**
 * Discover physical Ethernet topology dynamically from:
 * - NetBox devices: any IP-only device ending in .1 is a candidate router
 * - Ansible nas-link-setup: direct link between hosts (reads IPs + interfaces from group_vars)
 * - Subnet grouping: hosts sharing a /24 prefix are assumed to share a switch
 */
export async function discoverPhysicalTopology(
  config: TopologyConfig,
  netboxDevices: PhysicalDevice[],
  knownHosts: Map<string, string>, // id → ip
): Promise<PhysicalTopology> {
  console.log("[topology] Discovering physical connections...");

  const networkDevices: NetworkDevice[] = [];
  const links: PhysicalLink[] = [];

  // ── 1. Identify router(s) from NetBox ─────────────────────────
  // A device whose name is an IP ending in .1 is a likely gateway/router
  const ipRegex = /^(\d+\.\d+\.\d+)\.1$/;
  for (const d of netboxDevices) {
    const m = d.name.match(ipRegex);
    if (m && d.status === "active") {
      const subnetPrefix = m[1];
      networkDevices.push({
        id: `router-${subnetPrefix}`,
        label: `Router (${d.name})`,
        ip: d.name,
        role: "router",
      });
    }
  }

  // ── 2. Discover direct links from Ansible ─────────────────────
  // Scan infrastructure/*-link-setup/ directories for point-to-point connections
  const infraDir = join(config.ansiblePath, "infrastructure");
  if (existsSync(infraDir)) {
    const entries = await readdir(infraDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.includes("link")) continue;
      const groupVars = join(infraDir, entry.name, "group_vars/all.yml");
      if (!existsSync(groupVars)) continue;

      const content = await readFile(groupVars, "utf-8");

      // Look for paired endpoint definitions (node1/node2 or host_a/nas patterns)
      // Extract all IPs and interface names
      const ipVars = [...content.matchAll(/^(\w+(?:_lan)?_ip):\s*["']?(\d+\.\d+\.\d+\.\d+)/gm)];
      const ifaceVars = [...content.matchAll(/^(\w+_iface):\s*["']?(\S+)/gm)];
      const linkLabel = extractVar(content, "node1_nas_link_iface")?.startsWith("enx")
        ? "USB-eth" // USB ethernet adapter
        : entry.name.replace(/-setup$/, "").replace(/-/g, " ");

      // Find pairs: endpoints with different subnet
      const endpoints: Array<{ id: string; ip: string; iface: string }> = [];
      for (const [, varName, ip] of ipVars) {
        // Resolve IP to a known host
        let hostId = "";
        for (const [id, hostIp] of knownHosts) {
          if (hostIp === ip) { hostId = id; break; }
        }
        const ifaceKey = varName.replace(/_(?:lan_)?ip$/, "_iface");
        const iface = ifaceVars.find(([, k]) => k === ifaceKey)?.[2] ?? "";
        if (hostId) {
          endpoints.push({ id: hostId, ip, iface });
        }
      }

      // Create links between endpoints on different subnets
      for (let i = 0; i < endpoints.length; i++) {
        for (let j = i + 1; j < endpoints.length; j++) {
          const a = endpoints[i], b = endpoints[j];
          if (getSubnet(a.ip) !== getSubnet(b.ip)) {
            const key = [a.id, b.id].sort().join("↔");
            if (!links.some(l => [l.source, l.target].sort().join("↔") === key)) {
              links.push({
                source: a.id,
                target: b.id,
                label: linkLabel,
                sourceInterface: a.iface || undefined,
                targetInterface: b.iface || undefined,
              });
              console.log(`  Direct link: ${a.id} ←${linkLabel}→ ${b.id}`);
            }
          }
        }
      }
    }
  }

  // ── 3. LAN switch topology (derived from subnet grouping) ─────
  // Group hosts by /24 subnet. Any group with 2+ hosts implies a switch.
  const subnetGroups = new Map<string, Array<[string, string]>>();
  for (const [hostId, ip] of knownHosts) {
    const subnet = getSubnet(ip);
    if (!subnet) continue;
    if (!subnetGroups.has(subnet)) subnetGroups.set(subnet, []);
    subnetGroups.get(subnet)!.push([hostId, ip]);
  }

  for (const [subnet, hosts] of subnetGroups) {
    if (hosts.length < 2) continue;

    const switchId = `switch-${subnet}`;
    networkDevices.push({
      id: switchId,
      label: `Switch (${subnet}.0/24)`,
      ip: "",
      role: "switch",
    });

    // Connect router to switch if a router exists on this subnet
    const router = networkDevices.find(
      nd => nd.role === "router" && nd.ip.startsWith(subnet + "."),
    );
    if (router) {
      links.push({ source: router.id, target: switchId, label: "Uplink" });
    }

    // Connect each host to the switch
    for (const [hostId] of hosts) {
      links.push({ source: hostId, target: switchId, label: "Ethernet" });
    }

    console.log(`  Subnet ${subnet}.0/24: ${hosts.map(([id]) => id).join(", ")} → ${switchId}${router ? ` → ${router.id}` : ""}`);
  }

  console.log(`[topology] Found ${networkDevices.length} network devices, ${links.length} physical links`);
  return { networkDevices, links };
}

function extractVar(yaml: string, name: string): string {
  const match = yaml.match(new RegExp(`^${name}:\\s*["']?([^"'\\s]+)`, "m"));
  return match ? match[1] : "";
}

/** Extract /24 subnet prefix from IP (e.g., "x.y.z.w" → "x.y.z") */
function getSubnet(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return "";
  return parts.slice(0, 3).join(".");
}
