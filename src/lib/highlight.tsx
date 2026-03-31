import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { Connection } from "@/data/types";

interface DependencyBadge {
  targetId: string;
  targetLabel: string;
  color: string;
  type: "dep" | "physical";
}

interface HighlightContextType {
  hoveredServiceId: string | null;
  highlightedIds: Set<string>;
  onServiceHover: (serviceId: string | null) => void;
  getDirectConnections: (serviceId: string) => Set<string>;
  getDependencyBadges: (serviceId: string) => DependencyBadge[];
  getReverseDependencies: (serviceId: string) => string[];
  getDepColor: (targetId: string) => string;
}

const HighlightContext = createContext<HighlightContextType>({
  hoveredServiceId: null,
  highlightedIds: new Set(),
  onServiceHover: () => {},
  getDirectConnections: () => new Set(),
  getDependencyBadges: () => [],
  getReverseDependencies: () => [],
  getDepColor: () => "220 20% 50%",
});

export function useHighlight() {
  return useContext(HighlightContext);
}

const COLOR_PALETTE = [
  "35 80% 55%",    // amber
  "200 60% 55%",   // cyan
  "320 55% 55%",   // magenta
  "145 55% 50%",   // green
  "270 50% 60%",   // purple
  "15 75% 55%",    // orange
  "180 50% 45%",   // teal-dark
  "50 70% 50%",    // gold
];

function buildDepColors(connections: Connection[]): Record<string, string> {
  const colors: Record<string, string> = {};
  let colorIdx = 0;
  for (const conn of connections) {
    if (conn.type === "dependency" && !colors[conn.target]) {
      colors[conn.target] = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
      colorIdx++;
    }
  }
  return colors;
}

interface HighlightProviderProps {
  children: ReactNode;
  connections: Connection[];
}

export function HighlightProvider({ children, connections }: HighlightProviderProps) {
  const [hoveredServiceId, setHoveredServiceId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const depColors = useMemo(() => buildDepColors(connections), [connections]);

  const getDepColor = useCallback((targetId: string): string => {
    return depColors[targetId] || "220 20% 50%";
  }, [depColors]);

  const getDirectConnections = useCallback((serviceId: string): Set<string> => {
    const connected = new Set<string>();
    connected.add(serviceId);
    for (const conn of connections) {
      if (conn.source === serviceId) connected.add(conn.target);
      if (conn.target === serviceId) connected.add(conn.source);
    }
    return connected;
  }, [connections]);

  const getDependencyBadges = useCallback((serviceId: string): DependencyBadge[] => {
    const badges: DependencyBadge[] = [];
    for (const conn of connections) {
      if (conn.type === "dependency" && conn.source === serviceId) {
        badges.push({
          targetId: conn.target,
          targetLabel: conn.target,
          color: getDepColor(conn.target),
          type: "dep",
        });
      }
    }
    return badges;
  }, [connections, getDepColor]);

  const getReverseDependencies = useCallback((serviceId: string): string[] => {
    return connections
      .filter(conn => conn.type === "dependency" && conn.target === serviceId)
      .map(conn => conn.source);
  }, [connections]);

  const onServiceHover = useCallback((serviceId: string | null) => {
    setHoveredServiceId(serviceId);
    if (serviceId) {
      setHighlightedIds(getDirectConnections(serviceId));
    } else {
      setHighlightedIds(new Set());
    }
  }, [getDirectConnections]);

  return (
    <HighlightContext.Provider value={{
      hoveredServiceId,
      highlightedIds,
      onServiceHover,
      getDirectConnections,
      getDependencyBadges,
      getReverseDependencies,
      getDepColor,
    }}>
      {children}
    </HighlightContext.Provider>
  );
}
