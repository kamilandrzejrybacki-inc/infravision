import type { Connection, Host, NetworkZone } from "@/data/types";
import type { Node } from "@xyflow/react";

// Layout spacing constants (4px grid)
const ZONE_PADDING = 48;
const ZONE_LABEL_HEIGHT = 28;
const ZONE_GAP_Y = 60;
const HOST_GAP_X = 40;
const HOST_HEADER_HEIGHT = 44;
const HOST_BOTTOM_PAD = 12;
const SERVICE_ROW_HEIGHT = 30;
const SERVICE_ROW_GAP = 4;
const SERVICE_INDENT = 12;
const K8S_LABEL_INDENT = 16;
const K8S_LABEL_HEIGHT = 24;
const K8S_LABEL_GAP = 6;
const NET_DEVICE_GAP = 10;
const NET_DEVICE_ROW_GAP = 12;

// Canvas text measurement
let _canvas: HTMLCanvasElement | null = null;
function measureText(text: string, font: string): number {
  if (typeof document === "undefined") return text.length * 7.5;
  if (!_canvas) _canvas = document.createElement("canvas");
  const ctx = _canvas.getContext("2d")!;
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Font specs — must match actual component renders exactly
const F_HOST_LABEL = "600 13px 'JetBrains Mono', monospace";
const F_HOST_IP = "400 11px 'JetBrains Mono', monospace";
const F_SERVICE = "400 13px Inter, sans-serif";
const F_SERVICE_K8S = "400 12px 'JetBrains Mono', monospace";
const F_BADGE = "400 10px 'JetBrains Mono', monospace";
const F_NET_DEVICE = "500 10px 'JetBrains Mono', monospace";
const F_NET_DEVICE_IP = "400 9px 'JetBrains Mono', monospace";
const F_PHYS_BADGE = "400 10px 'JetBrains Mono', monospace";

const DOT_SIZE = 5;
const DOT_GAP = 4;
const DOTS_GROUP_GAP = 4; // gap before the indicator dots cluster

function computeHostWidth(
  host: Host,
  serviceLabel: Map<string, string>,
  depTargetIds: Set<string>,
  connections: Connection[],
): number {
  // Header: hostname + gap + IP
  let headerW =
    measureText(host.label, F_HOST_LABEL) + 8 +
    measureText(host.ip ?? "", F_HOST_IP) +
    28; // 14px padding each side

  // Physical connection badge in header (if present)
  const physConn = connections.find(
    c => c.type === "physical" && (c.source === host.id || c.target === host.id),
  );
  if (physConn) {
    const badgeText = physConn.label || "link";
    headerW += 12 + measureText("⇄ " + badgeText, F_PHYS_BADGE) + 16;
  }

  // Service rows: each is dots + name + badges
  let maxServiceW = 0;
  const services = host.services;
  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const isK8s = svc.type === "k8s";
    const prefix = isK8s ? (i === services.length - 1 ? "└ " : "├ ") : "";
    const nameW = measureText(prefix + svc.label, isK8s ? F_SERVICE_K8S : F_SERVICE);

    // Leading dots (sync status, dep target indicator)
    let dotsW = 0;
    if (isK8s && svc.syncStatus) dotsW += DOT_SIZE + DOT_GAP;
    if (depTargetIds.has(svc.id)) dotsW += DOT_SIZE + DOT_GAP;

    // Trailing indicator dots (one per dependency — labels are in tooltip now)
    let trailingDotsW = 0;
    if (svc.dependencies.length > 0) {
      trailingDotsW = DOTS_GROUP_GAP + svc.dependencies.length * DOT_SIZE + (svc.dependencies.length - 1) * 3;
    }

    // "not deployed" badge (still inline)
    let badgeW = 0;
    if (svc.active === false) {
      badgeW = DOT_GAP + measureText("not deployed", F_BADGE) + 14;
    }

    const rowW = dotsW + nameW + trailingDotsW + badgeW + 20; // 10px pad each side
    if (rowW > maxServiceW) maxServiceW = rowW;
  }

  // Host width = max(header, widest service row + indent) + buffer
  const contentW = Math.max(headerW, maxServiceW + 2 * SERVICE_INDENT);
  return Math.ceil(contentW) + 16; // 16px buffer for font-loading timing
}

function computeHostHeight(host: Host): number {
  const isK8sHost = host.services.some(s => s.type === "k8s");
  let h = HOST_HEADER_HEIGHT + HOST_BOTTOM_PAD;
  if (isK8sHost) h += K8S_LABEL_HEIGHT + K8S_LABEL_GAP;
  h += host.services.length * (SERVICE_ROW_HEIGHT + SERVICE_ROW_GAP);
  return h;
}

function computeNetDeviceWidth(label: string, ip: string): number {
  const iconW = 16;
  const labelW = measureText(label, F_NET_DEVICE);
  const ipW = ip ? measureText(ip, F_NET_DEVICE_IP) + 8 : 0;
  return Math.ceil(iconW + labelW + ipW) + 24; // 12px pad each side
}

export interface LayoutResult {
  nodes: Node[];
  zonePositions: Record<string, { x: number; y: number; width: number; height: number }>;
}

const NETWORK_DEVICE_TAGS = new Set(["router", "switch", "firewall", "access-point"]);

export function computeLayout(
  zones: NetworkZone[],
  _activeLayers: string[],
  _activeTags: string[],
  hosts: Host[],
  connections: Connection[] = [],
): LayoutResult {
  const nodes: Node[] = [];
  const zonePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};

  // Build lookup maps
  const serviceLabel = new Map<string, string>();
  const depTargetIds = new Set<string>();
  for (const host of hosts) {
    for (const svc of host.services) {
      serviceLabel.set(svc.id, svc.label);
      for (const depId of svc.dependencies) depTargetIds.add(depId);
    }
  }

  let zoneY = 0;

  for (const zone of zones) {
    const allZoneHosts = zone.hostIds
      .map(id => hosts.find(h => h.id === id)!)
      .filter(Boolean);

    const serverHosts = allZoneHosts.filter(h => !h.tags.some(t => NETWORK_DEVICE_TAGS.has(t)));
    const netDevices = allZoneHosts.filter(h => h.tags.some(t => NETWORK_DEVICE_TAGS.has(t)));

    // Compute each host's dimensions from content
    const hostSizes = serverHosts.map(h => ({
      w: computeHostWidth(h, serviceLabel, depTargetIds, connections),
      h: computeHostHeight(h),
    }));

    const maxHostH = hostSizes.length > 0 ? Math.max(...hostSizes.map(s => s.h)) : 0;

    // Compute network device widths from content
    const netSizes = netDevices.map(nd => ({
      w: computeNetDeviceWidth(nd.label, nd.ip),
      h: 32,
    }));

    const netRowH = netSizes.length > 0 ? 32 + NET_DEVICE_ROW_GAP : 0;

    // Zone dimensions: wrap tightly around content
    const hostsRowW = hostSizes.reduce((sum, s) => sum + s.w, 0) +
      Math.max(0, serverHosts.length - 1) * HOST_GAP_X;
    const netRowW = netSizes.reduce((sum, s) => sum + s.w, 0) +
      Math.max(0, netDevices.length - 1) * NET_DEVICE_GAP;

    const zoneW = Math.max(hostsRowW, netRowW) + 2 * ZONE_PADDING;
    const zoneH = ZONE_LABEL_HEIGHT + maxHostH + netRowH + 2 * ZONE_PADDING;

    nodes.push({
      id: `zone-${zone.id}`,
      type: "zone",
      position: { x: 0, y: zoneY },
      data: { label: `${zone.cidr} — ${zone.label}`, width: zoneW, height: zoneH },
      draggable: false,
      selectable: false,
      style: { width: zoneW, height: zoneH },
    });

    zonePositions[zone.id] = { x: 0, y: zoneY, width: zoneW, height: zoneH };

    // Place server hosts
    let hostX = ZONE_PADDING;
    const hostY = ZONE_PADDING + ZONE_LABEL_HEIGHT;

    for (let i = 0; i < serverHosts.length; i++) {
      const host = serverHosts[i];
      const { w: hostW, h: hostH } = hostSizes[i];
      const isK8sHost = host.services.some(s => s.type === "k8s");
      const physConn = connections.find(
        c => c.type === "physical" && (c.source === host.id || c.target === host.id),
      ) ?? null;

      nodes.push({
        id: host.id,
        type: "host",
        position: { x: hostX, y: hostY },
        parentId: `zone-${zone.id}`,
        extent: "parent" as const,
        data: {
          label: host.label, ip: host.ip, color: host.color,
          width: hostW, height: hostH, isK8sHost, physConn,
        },
        draggable: false,
        style: { width: hostW, height: hostH },
      });

      let svcY = HOST_HEADER_HEIGHT;

      if (isK8sHost) {
        nodes.push({
          id: `${host.id}-k3s-label`,
          type: "k8sCluster",
          position: { x: K8S_LABEL_INDENT, y: svcY },
          parentId: host.id,
          extent: "parent" as const,
          draggable: false,
          selectable: false,
          data: { width: hostW - 2 * K8S_LABEL_INDENT },
        });
        svcY += K8S_LABEL_HEIGHT + K8S_LABEL_GAP;
      }

      for (let si = 0; si < host.services.length; si++) {
        const service = host.services[si];
        nodes.push({
          id: service.id,
          type: "service",
          position: { x: SERVICE_INDENT, y: svcY },
          parentId: host.id,
          extent: "parent" as const,
          data: {
            label: service.label, serviceData: service,
            isK8s: service.type === "k8s",
            isLast: si === host.services.length - 1,
          },
          draggable: false,
          style: { width: hostW - 2 * SERVICE_INDENT },
        });
        svcY += SERVICE_ROW_HEIGHT + SERVICE_ROW_GAP;
      }

      hostX += hostW + HOST_GAP_X;
    }

    // Place network devices at bottom-right edge
    if (netDevices.length > 0) {
      const netY = hostY + maxHostH + NET_DEVICE_ROW_GAP;
      const totalNetW = netSizes.reduce((sum, s) => sum + s.w, 0) +
        (netDevices.length - 1) * NET_DEVICE_GAP;
      let netX = zoneW - ZONE_PADDING - totalNetW;

      for (let ni = 0; ni < netDevices.length; ni++) {
        const nd = netDevices[ni];
        const { w: ndW, h: ndH } = netSizes[ni];
        const role = nd.tags.find(t => NETWORK_DEVICE_TAGS.has(t)) ?? "switch";

        nodes.push({
          id: nd.id,
          type: "networkDevice",
          position: { x: netX, y: netY },
          parentId: `zone-${zone.id}`,
          extent: "parent" as const,
          draggable: false,
          data: { label: nd.label, ip: nd.ip, role, width: ndW, height: ndH },
          style: { width: ndW, height: ndH },
        });
        netX += ndW + NET_DEVICE_GAP;
      }
    }

    zoneY += zoneH + ZONE_GAP_Y;
  }

  return { nodes, zonePositions };
}
