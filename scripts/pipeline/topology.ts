import type { PhysicalDevice, PhysicalConnection } from "./types.js";

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
 * - NetBox cables: direct point-to-point links between named devices
 * - Subnet grouping: hosts sharing a /24 prefix are assumed to share a switch
 */
export async function discoverPhysicalTopology(
  config: TopologyConfig,
  netboxDevices: PhysicalDevice[],
  knownHosts: Map<string, string>, // id → ip
  netboxCables: PhysicalConnection[] = [],
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

  // ── 2. Direct links from NetBox cables ────────────────────────
  // Any cable between two named hosts that are in knownHosts = direct physical link
  const knownHostNames = new Set(knownHosts.keys());
  for (const cable of netboxCables) {
    const src = cable.sourceDevice;
    const tgt = cable.targetDevice;
    if (!knownHostNames.has(src) || !knownHostNames.has(tgt)) continue;
    const key = [src, tgt].sort().join("↔");
    if (links.some(l => [l.source, l.target].sort().join("↔") === key)) continue;
    links.push({
      source: src,
      target: tgt,
      label: cable.label || "Direct",
      sourceInterface: cable.sourceInterface || undefined,
      targetInterface: cable.targetInterface || undefined,
    });
    console.log(`  Direct link (NetBox cable): ${src} ←→ ${tgt}`);
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

/** Extract /24 subnet prefix from IP (e.g., "x.y.z.w" → "x.y.z") */
function getSubnet(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return "";
  return parts.slice(0, 3).join(".");
}
