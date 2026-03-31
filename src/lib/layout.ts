import type { Connection, Host, NetworkZone } from "@/data/types";
import type { Node } from "@xyflow/react";

const NETWORK_ZONE_PADDING = 60;
const ZONE_LABEL_HEIGHT = 30;
const HOST_GAP_X = 60;
const HEADER_HEIGHT = 48;
const SERVICE_NODE_HEIGHT = 32;
const SERVICE_NODE_PADDING = 12;
const SERVICE_LEFT_INDENT = 16;
const BOTTOM_PADDING = 20;
const K8S_CLUSTER_INDENT = 20;
const K8S_HEADER_HEIGHT = 28;
const NETWORK_ZONE_GAP = 80;
const MIN_HOST_WIDTH = 220;
const MAX_HOST_WIDTH = 520;

// Reuse a single canvas element for all measurements
let _canvas: HTMLCanvasElement | null = null;
function measureText(text: string, font: string): number {
  if (typeof document === "undefined") return text.length * 7.5;
  if (!_canvas) _canvas = document.createElement("canvas");
  const ctx = _canvas.getContext("2d")!;
  ctx.font = font;
  return ctx.measureText(text).width;
}

const F_INTER_13 = "13px Inter, sans-serif";
const F_MONO_12 = "12px 'JetBrains Mono', monospace";
const F_MONO_10 = "10px 'JetBrains Mono', monospace";
const F_MONO_14B = "600 14px 'JetBrains Mono', monospace";
const F_MONO_11 = "11px 'JetBrains Mono', monospace";

const GAP = 6;
const SERVICE_H_PADDING = 20; // 10px left + 10px right inside service node
const HOST_H_PADDING = 28;    // 14px left + 14px right inside host header
const BADGE_H_PADDING = 14;   // 7px left + 7px right per badge
const BADGE_DOT = 5;
const DOT_SELF = 6;
const DOT_SYNC = 8;

function computeHostWidth(
  host: Host,
  serviceLabel: Map<string, string>,
  depTargetIds: Set<string>,
): number {
  const isK8sHost = host.id === "lw-c1";

  // Header: label + IP (+ physical badge on right — ignore for width, it's pushed right)
  const headerContent =
    measureText(host.label, F_MONO_14B) + GAP +
    measureText(host.ip ?? "", F_MONO_11);
  const headerNeeded = headerContent + HOST_H_PADDING;

  let maxRowNeeded = headerNeeded;

  const services = host.services;
  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const isK8s = svc.type === "k8s";
    const prefix = isK8s ? (i === services.length - 1 ? "└ " : "├ ") : "";
    const nameFont = isK8s ? F_MONO_12 : F_INTER_13;
    const nameWidth = measureText(prefix + svc.label, nameFont);

    let dotsWidth = 0;
    if (isK8s && svc.syncStatus) dotsWidth += DOT_SYNC + GAP;
    if (depTargetIds.has(svc.id)) dotsWidth += DOT_SELF + GAP;

    let badgesWidth = 0;
    for (const depId of svc.dependencies) {
      const depLabel = serviceLabel.get(depId) ?? depId;
      const badgeWidth = BADGE_DOT + GAP + measureText(depLabel, F_MONO_10) + BADGE_H_PADDING;
      badgesWidth += GAP + badgeWidth;
    }

    const rowContent = dotsWidth + nameWidth + badgesWidth;
    // service node width = HOST_WIDTH - 2*SERVICE_LEFT_INDENT, with its own H padding
    const hostWidthNeeded = rowContent + SERVICE_H_PADDING + 2 * SERVICE_LEFT_INDENT;
    if (hostWidthNeeded > maxRowNeeded) maxRowNeeded = hostWidthNeeded;
  }

  // +24px breathing room to compensate for font-loading timing
  return Math.min(MAX_HOST_WIDTH, Math.max(MIN_HOST_WIDTH, Math.ceil(maxRowNeeded) + 24));
}

function computeHostHeight(host: Host, hostWidth: number): number {
  const isK8sHost = host.id === "lw-c1";
  let height = HEADER_HEIGHT + BOTTOM_PADDING;
  for (const _svc of host.services) {
    height += SERVICE_NODE_HEIGHT + SERVICE_NODE_PADDING;
  }
  if (isK8sHost) height += K8S_HEADER_HEIGHT + 8;
  return height;
}

export interface LayoutResult {
  nodes: Node[];
  zonePositions: Record<string, { x: number; y: number; width: number; height: number }>;
}

export function computeLayout(
  zones: NetworkZone[],
  _activeLayers: string[],
  _activeTags: string[],
  hosts: Host[],
  connections: Connection[] = [],
): LayoutResult {
  const nodes: Node[] = [];
  const zonePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};

  // Build lookup maps for width computation
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
    const zoneHosts = zone.hostIds
      .map(id => hosts.find(h => h.id === id)!)
      .filter(Boolean);

    const hostWidths = zoneHosts.map(h => computeHostWidth(h, serviceLabel, depTargetIds));
    const hostHeights = zoneHosts.map((h, i) => computeHostHeight(h, hostWidths[i]));
    const maxHostHeight = Math.max(...hostHeights, 180);
    const zoneWidth =
      hostWidths.reduce((sum, w) => sum + w, 0) +
      (zoneHosts.length - 1) * HOST_GAP_X +
      2 * NETWORK_ZONE_PADDING;
    const zoneHeight = maxHostHeight + 2 * NETWORK_ZONE_PADDING + ZONE_LABEL_HEIGHT;

    nodes.push({
      id: `zone-${zone.id}`,
      type: "zone",
      position: { x: 0, y: zoneY },
      data: { label: `${zone.cidr} — ${zone.label}`, width: zoneWidth, height: zoneHeight },
      draggable: false,
      selectable: false,
      style: { width: zoneWidth, height: zoneHeight },
    });

    zonePositions[zone.id] = { x: 0, y: zoneY, width: zoneWidth, height: zoneHeight };

    let hostX = NETWORK_ZONE_PADDING;
    const hostY = NETWORK_ZONE_PADDING + ZONE_LABEL_HEIGHT;

    for (let i = 0; i < zoneHosts.length; i++) {
      const host = zoneHosts[i];
      const hostWidth = hostWidths[i];
      const hostHeight = hostHeights[i];
      const isK8sHost = host.id === "lw-c1";
      const physConn = connections.find(
        c => c.type === "physical" && (c.source === host.id || c.target === host.id)
      ) ?? null;

      nodes.push({
        id: host.id,
        type: "host",
        position: { x: hostX, y: hostY },
        parentId: `zone-${zone.id}`,
        extent: "parent" as const,
        data: {
          label: host.label, ip: host.ip, color: host.color,
          width: hostWidth, height: hostHeight, isK8sHost, physConn,
        },
        draggable: false,
        style: { width: hostWidth, height: hostHeight },
      });

      let serviceY = HEADER_HEIGHT;
      if (isK8sHost) {
        nodes.push({
          id: `${host.id}-k3s-label`,
          type: "k8sCluster",
          position: { x: K8S_CLUSTER_INDENT, y: serviceY },
          parentId: host.id,
          extent: "parent" as const,
          draggable: false,
          selectable: false,
          data: { width: hostWidth - 2 * K8S_CLUSTER_INDENT },
        });
        serviceY += K8S_HEADER_HEIGHT + 8;
      }

      for (const service of host.services) {
        nodes.push({
          id: service.id,
          type: "service",
          position: { x: SERVICE_LEFT_INDENT, y: serviceY },
          parentId: host.id,
          extent: "parent" as const,
          data: {
            label: service.label, serviceData: service,
            isK8s: service.type === "k8s",
            isLast: host.services.indexOf(service) === host.services.length - 1,
          },
          draggable: false,
          style: { width: hostWidth - 2 * SERVICE_LEFT_INDENT },
        });
        serviceY += SERVICE_NODE_HEIGHT + SERVICE_NODE_PADDING;
      }

      hostX += hostWidth + HOST_GAP_X;
    }

    zoneY += zoneHeight + NETWORK_ZONE_GAP;
  }

  return { nodes, zonePositions };
}
