import type { Host, NetworkZone } from "@/data/types";
import { dependencies } from "@/data/infrastructure";
import type { Node } from "@xyflow/react";

const NETWORK_ZONE_PADDING = 60;
const ZONE_LABEL_HEIGHT = 30;
const HOST_NODE_WIDTH = 340;
const HOST_GAP_X = 60;
const HEADER_HEIGHT = 48;
const SERVICE_NODE_HEIGHT = 32;
const SERVICE_NODE_PADDING = 12;
const SERVICE_LEFT_INDENT = 16;
const BOTTOM_PADDING = 20;
const K8S_CLUSTER_INDENT = 20;
const K8S_HEADER_HEIGHT = 28;
const NETWORK_ZONE_GAP = 80;

function serviceHasDeps(serviceId: string): boolean {
  return dependencies.some(d => d.source === serviceId);
}

function computeServiceRowHeight(_serviceId: string): number {
  return SERVICE_NODE_HEIGHT;
}

function computeHostHeight(host: Host): number {
  const isK8sHost = host.id === "lw-c1";
  let height = HEADER_HEIGHT + BOTTOM_PADDING;
  for (const svc of host.services) {
    height += computeServiceRowHeight(svc.id) + SERVICE_NODE_PADDING;
  }
  if (isK8sHost) {
    height += K8S_HEADER_HEIGHT + 8;
  }
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
): LayoutResult {
  const nodes: Node[] = [];
  const zonePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  let zoneY = 0;

  for (const zone of zones) {
    const zoneHosts = zone.hostIds
      .map(id => hosts.find(h => h.id === id)!)
      .filter(Boolean);

    const hostHeights = zoneHosts.map(computeHostHeight);
    const maxHostHeight = Math.max(...hostHeights, 180);
    const zoneWidth = (zoneHosts.length * HOST_NODE_WIDTH) +
      ((zoneHosts.length - 1) * HOST_GAP_X) +
      (2 * NETWORK_ZONE_PADDING);
    const zoneHeight = maxHostHeight + (2 * NETWORK_ZONE_PADDING) + ZONE_LABEL_HEIGHT;

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
      const hostHeight = hostHeights[i];
      const isK8sHost = host.id === "lw-c1";

      nodes.push({
        id: host.id,
        type: "host",
        position: { x: hostX, y: hostY },
        parentId: `zone-${zone.id}`,
        extent: "parent" as const,
        data: {
          label: host.label, ip: host.ip, color: host.color,
          width: HOST_NODE_WIDTH, height: hostHeight, isK8sHost,
        },
        draggable: false,
        style: { width: HOST_NODE_WIDTH, height: hostHeight },
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
          data: { width: HOST_NODE_WIDTH - 2 * K8S_CLUSTER_INDENT },
        });
        serviceY += K8S_HEADER_HEIGHT + 8;
      }

      for (const service of host.services) {
        const rowHeight = computeServiceRowHeight(service.id);
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
          style: { width: HOST_NODE_WIDTH - 2 * SERVICE_LEFT_INDENT },
        });
        serviceY += rowHeight + SERVICE_NODE_PADDING;
      }

      hostX += HOST_NODE_WIDTH + HOST_GAP_X;
    }

    zoneY += zoneHeight + NETWORK_ZONE_GAP;
  }

  return { nodes, zonePositions };
}
