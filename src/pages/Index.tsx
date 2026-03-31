import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { HighlightProvider, useHighlight } from "@/lib/highlight";
import { loadInfrastructureData } from "@/data/infrastructure";
import { InfraVisionRepository } from "@/data/infrastructure-repository";
import type { Host, Connection, NetworkZone, Service } from "@/data/types";
import { computeLayout } from "@/lib/layout";
import { buildEdges } from "@/lib/edges";

const nodeTypes: NodeTypes = {
  zone: ZoneNode,
  host: HostNode,
  service: ServiceNode,
  k8sCluster: K8sClusterNode,
};

interface ProcessedData {
  hosts: Host[];
  zones: NetworkZone[];
  connections: Connection[];
  tags: string[];
  metadata: { generated_at: string };
  getServiceById: (id: string) => Service | undefined;
  getHostById: (id: string) => Host | undefined;
}

interface InfraCanvasProps {
  processedData: ProcessedData;
}

function InfraCanvas({ processedData }: InfraCanvasProps) {
  const { hoveredServiceId, getDirectConnections } = useHighlight();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLayers, setActiveLayers] = useState(["physical", "services", "k8s"]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeHosts, setActiveHosts] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"service" | "host" | null>(null);

  useEffect(() => {
    if (processedData && activeHosts.length === 0) {
      setActiveHosts(processedData.hosts.map(h => h.id));
    }
  }, [processedData, activeHosts]);

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
    const { nodes } = computeLayout(processedData.zones, activeLayers, activeTags, processedData.hosts, processedData.connections);
    const allServices = processedData.hosts.flatMap(h => h.services);
    const effectiveActiveHosts = activeHosts.length > 0
      ? activeHosts
      : processedData.hosts.map(h => h.id);
    const query = searchQuery.toLowerCase();

    return nodes.map(node => {
      let dimmed = false;

      if (node.type === "service") {
        const svcData = (node.data as any).serviceData;
        if (svcData.type === "k8s" && !activeLayers.includes("k8s")) dimmed = true;
        if (svcData.type !== "k8s" && !activeLayers.includes("services")) dimmed = true;
        if (activeTags.length > 0 && !activeTags.some((t: string) => svcData.tags.includes(t))) dimmed = true;
        if (!effectiveActiveHosts.includes(svcData.hostId)) dimmed = true;
        if (!showInactive && svcData.active === false) dimmed = true;
        if (query && !svcData.label?.toLowerCase().includes(query) && !svcData.hostId?.toLowerCase().includes(query)) dimmed = true;
      }

      if (node.type === "host") {
        if (!effectiveActiveHosts.includes(node.id)) dimmed = true;
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
  }, [activeLayers, activeTags, activeHosts, showInactive, searchQuery, processedData]);

  const edges = useMemo(
    () => buildEdges(processedData.connections),
    [processedData]
  );

  const dimmedEdges = useMemo(() => {
    if (!hoveredServiceId) return edges;
    const connectedServices = getDirectConnections(hoveredServiceId);

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
  }, [edges, hoveredServiceId, getDirectConnections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);

  useEffect(() => {
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
        showInactive={showInactive}
        onToggleInactive={() => setShowInactive(v => !v)}
        generatedAt={processedData.metadata?.generated_at}
        tags={processedData.tags}
        hosts={processedData.hosts}
      />

      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 36,
            background: "hsla(220, 20%, 9%, 0.92)",
            borderBottom: "1px solid hsla(220, 16%, 22%, 0.5)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            zIndex: 10,
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            color: "hsl(220, 12%, 44%)",
            backdropFilter: "blur(6px)",
          }}
        >
          InfraVision — Homelab Infrastructure Map
        </div>

        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: "hsl(220, 22%, 9%)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsla(220, 14%, 28%, 0.25)" />
          <Controls showInteractive={false} style={{ bottom: 16, left: 16 }} />
          <MiniMap
            nodeStrokeWidth={3}
            style={{ bottom: 16, right: selectedId ? 316 : 16 }}
            maskColor="hsla(220, 22%, 7%, 0.75)"
          />
        </ReactFlow>
      </div>

      <DetailPanel
        selectedId={selectedId}
        selectedType={selectedType}
        onClose={() => { setSelectedId(null); setSelectedType(null); }}
        getServiceById={processedData.getServiceById}
        getHostById={processedData.getHostById}
      />
    </div>
  );
}

export default function Index() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['infrastructure'],
    queryFn: loadInfrastructureData,
    staleTime: Infinity,
  });

  const processedData = useMemo(() => {
    if (!data) return null;
    const repo = new InfraVisionRepository(data);
    return {
      hosts: repo.getHostsWithServices(),
      zones: data.zones,
      connections: data.connections,
      tags: data.tags,
      metadata: data.metadata,
      getServiceById: (id: string) => repo.getServiceById(id),
      getHostById: (id: string) => repo.getHostById(id),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'hsl(220, 22%, 9%)' }}>
        <div style={{ color: 'hsl(220, 12%, 44%)', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
          loading infrastructure data...
        </div>
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : 'Failed to load infrastructure data';
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'hsl(220, 22%, 9%)' }}>
        <div style={{ color: 'hsl(2, 62%, 52%)', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
          {message}
        </div>
      </div>
    );
  }

  if (!processedData) return null;

  return (
    <HighlightProvider connections={processedData.connections}>
      <InfraCanvas processedData={processedData} />
    </HighlightProvider>
  );
}
