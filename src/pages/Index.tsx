import { useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  type NodeTypes,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ZoneNode from "@/components/nodes/ZoneNode";
import HostNode from "@/components/nodes/HostNode";
import ServiceNode from "@/components/nodes/ServiceNode";
import K8sClusterNode from "@/components/nodes/K8sClusterNode";
import Sidebar from "@/components/Sidebar";
import DetailPanel from "@/components/DetailPanel";
import { HighlightProvider, useHighlight, getDirectConnections } from "@/lib/highlight";
import { zones, hosts, getAllServices, getConnections } from "@/data/infrastructure";
import { computeLayout } from "@/lib/layout";
import { buildEdges } from "@/lib/edges";

const nodeTypes: NodeTypes = {
  zone: ZoneNode,
  host: HostNode,
  service: ServiceNode,
  k8sCluster: K8sClusterNode,
};

function InfraCanvas() {
  const { hoveredServiceId } = useHighlight();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState(["physical", "services", "k8s"]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeHosts, setActiveHosts] = useState<string[]>(hosts.map(h => h.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"service" | "host" | null>(null);

  const toggleLayer = useCallback((layer: string) => {
    setActiveLayers(prev =>
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const toggleHost = useCallback((hostId: string) => {
    setActiveHosts(prev =>
      prev.includes(hostId) ? prev.filter(h => h !== hostId) : [...prev, hostId]
    );
  }, []);

  const layoutNodes = useMemo(() => {
    const { nodes } = computeLayout(zones, activeLayers, activeTags);
    const allServices = getAllServices();
    const query = searchQuery.toLowerCase();

    return nodes.map(node => {
      let dimmed = false;

      if (node.type === "service") {
        const svcData = (node.data as any).serviceData;
        if (svcData.type === "k8s" && !activeLayers.includes("k8s")) dimmed = true;
        if (svcData.type !== "k8s" && !activeLayers.includes("services")) dimmed = true;
        if (activeTags.length > 0 && !activeTags.some((t: string) => svcData.tags.includes(t))) dimmed = true;
        if (!activeHosts.includes(svcData.hostId)) dimmed = true;
        if (query && !svcData.label?.toLowerCase().includes(query) && !svcData.hostId?.toLowerCase().includes(query)) dimmed = true;
      }

      if (node.type === "host") {
        if (!activeHosts.includes(node.id)) dimmed = true;
        if (query && !node.id.toLowerCase().includes(query)) {
          const hostServices = allServices.filter(s => s.hostId === node.id);
          if (!hostServices.some(s => s.label.toLowerCase().includes(query))) dimmed = true;
        }
      }

      return {
        ...node,
        style: {
          ...node.style,
          opacity: dimmed ? 0.2 : 1,
          transition: "opacity 0.2s ease",
        },
      };
    });
  }, [activeLayers, activeTags, activeHosts, searchQuery]);

  const edges = useMemo(() => buildEdges(getConnections()), []);

  const dimmedEdges = useMemo(() => {
    if (!hoveredServiceId) return edges;
    const connectedServices = getDirectConnections(hoveredServiceId);
    connectedServices.add(hoveredServiceId);

    return edges.map(edge => {
      const isHighlighted = connectedServices.has(edge.source) || connectedServices.has(edge.target);
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isHighlighted ? 1 : 0.15,
          strokeWidth: isHighlighted ? 2 : (edge.style?.strokeWidth ?? 1.5),
          transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
        },
      };
    });
  }, [edges, hoveredServiceId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);

  useMemo(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "service") {
      setSelectedId(node.id);
      setSelectedType("service");
    } else if (node.type === "host") {
      setSelectedId(node.id);
      setSelectedType("host");
    }
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeLayers={activeLayers}
        onToggleLayer={toggleLayer}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        activeHosts={activeHosts}
        onToggleHost={toggleHost}
      />

      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 40,
            background: "hsla(222, 20%, 12%, 0.9)",
            borderBottom: "1px solid hsla(220, 20%, 20%, 0.5)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            zIndex: 10,
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            color: "hsla(220, 15%, 55%, 0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          InfraVision — Homelab Infrastructure Map
        </div>

        <ReactFlow
          nodes={nodes}
          edges={dimmedEdges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: "hsl(222, 25%, 10%)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsla(220, 15%, 30%, 0.3)" />
          <Controls showInteractive={false} style={{ bottom: 16, left: 16 }} />
          <MiniMap
            nodeStrokeWidth={3}
            style={{ bottom: 16, right: selectedId ? 336 : 16 }}
            maskColor="hsla(222, 25%, 5%, 0.7)"
          />
        </ReactFlow>
      </div>

      <DetailPanel
        selectedId={selectedId}
        selectedType={selectedType}
        onClose={() => { setSelectedId(null); setSelectedType(null); }}
      />
    </div>
  );
}

export default function Index() {
  return (
    <HighlightProvider>
      <InfraCanvas />
    </HighlightProvider>
  );
}
