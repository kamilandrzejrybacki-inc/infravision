import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { PhysicalDevice } from "./types.js";

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

/** Discover physical Ethernet topology from Ansible configs + NetBox devices */
export async function discoverPhysicalTopology(
  config: TopologyConfig,
  netboxDevices: PhysicalDevice[],
  knownHosts: Map<string, string>, // id → ip
): Promise<PhysicalTopology> {
  console.log("[topology] Discovering physical connections...");

  const networkDevices: NetworkDevice[] = [];
  const links: PhysicalLink[] = [];

  // ── 1. Identify the router from NetBox (192.168.0.1) ──────────
  const routerDevice = netboxDevices.find(d => d.name === "192.168.0.1" && d.status === "active");
  if (routerDevice) {
    networkDevices.push({
      id: "router",
      label: "Router",
      ip: "192.168.0.1",
      role: "router",
    });
  }

  // ── 2. Discover NAS direct link from nas-link-setup ───────────
  const nasLinkVars = join(config.ansiblePath, "infrastructure/nas-link-setup/group_vars/all.yml");
  if (existsSync(nasLinkVars)) {
    const content = await readFile(nasLinkVars, "utf-8");

    const node1Iface = extractVar(content, "node1_nas_link_iface");
    const nasIface = extractVar(content, "nas_iface");
    const node1Ip = extractVar(content, "node1_lan_ip");

    // Find which known host is node1 by IP
    let node1Id = "";
    for (const [id, ip] of knownHosts) {
      if (ip === node1Ip) { node1Id = id; break; }
    }

    if (node1Id) {
      links.push({
        source: node1Id,
        target: "lw-nas",
        label: "USB-eth",
        sourceInterface: node1Iface || undefined,
        targetInterface: nasIface || undefined,
      });
      console.log(`  Direct link: ${node1Id} ←USB-eth→ lw-nas`);
    }
  }

  // ── 3. LAN switch topology ────────────────────────────────────
  // All hosts on 192.168.0.0/24 connect through a switch to the router.
  // The switch is implied (not a separate NetBox device), but we model it
  // so the physical topology is accurate.
  const lanHosts = [...knownHosts.entries()].filter(([_, ip]) =>
    ip.startsWith("192.168.0.")
  );

  if (lanHosts.length > 1) {
    networkDevices.push({
      id: "switch",
      label: "LAN Switch",
      ip: "",
      role: "switch",
    });

    // Router → Switch
    if (routerDevice) {
      links.push({
        source: "router",
        target: "switch",
        label: "Uplink",
      });
    }

    // Each LAN host → Switch
    for (const [hostId, _] of lanHosts) {
      links.push({
        source: hostId,
        target: "switch",
        label: "Ethernet",
      });
    }

    console.log(`  LAN switch: ${lanHosts.map(([id]) => id).join(", ")} → switch → router`);
  }

  console.log(`[topology] Found ${networkDevices.length} network devices, ${links.length} physical links`);
  return { networkDevices, links };
}

function extractVar(yaml: string, name: string): string {
  const match = yaml.match(new RegExp(`^${name}:\\s*["']?([^"'\\s]+)`, "m"));
  return match ? match[1] : "";
}
