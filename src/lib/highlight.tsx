import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { dependencies, physicalConnections } from "@/data/infrastructure";

interface HighlightContextType {
  hoveredServiceId: string | null;
  highlightedIds: Set<string>;
  onServiceHover: (serviceId: string | null) => void;
}

const HighlightContext = createContext<HighlightContextType>({
  hoveredServiceId: null,
  highlightedIds: new Set(),
  onServiceHover: () => {},
});

export function useHighlight() {
  return useContext(HighlightContext);
}

// Build a full dependency graph (bidirectional) so hovering any node in a chain highlights the whole chain
function buildDepGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  };
  for (const dep of dependencies) {
    addEdge(dep.source, dep.target);
  }
  for (const conn of physicalConnections) {
    addEdge(conn.source, conn.target);
  }
  return graph;
}

function getConnectedSet(startId: string, graph: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = graph.get(current);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    }
  }
  return visited;
}

const depGraph = buildDepGraph();

// Assign a stable color to each dependency group (connected component)
// Each unique dependency target gets a color
const DEP_COLORS: Record<string, string> = {};
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

// Color by the dependency TARGET (the thing being depended on) — this groups visually
let colorIdx = 0;
for (const dep of dependencies) {
  if (!DEP_COLORS[dep.target]) {
    DEP_COLORS[dep.target] = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
    colorIdx++;
  }
}
// Physical connections get their own color
for (const conn of physicalConnections) {
  const key = `phys-${conn.source}-${conn.target}`;
  if (!DEP_COLORS[key]) {
    DEP_COLORS[key] = "220 45% 55%"; // blue-grey for physical
  }
}

export function getDepColor(targetId: string): string {
  return DEP_COLORS[targetId] || "220 20% 50%";
}

// Get all dependency badges for a given service: what it depends ON, and a "physical" link if applicable
export function getDependencyBadges(serviceId: string): { targetId: string; targetLabel: string; color: string; type: "dep" | "physical" }[] {
  const badges: { targetId: string; targetLabel: string; color: string; type: "dep" | "physical" }[] = [];

  for (const dep of dependencies) {
    if (dep.source === serviceId) {
      badges.push({
        targetId: dep.target,
        targetLabel: dep.target,
        color: getDepColor(dep.target),
        type: "dep",
      });
    }
  }

  return badges;
}

// Get reverse dependencies — services that depend ON this service
export function getReverseDependencies(serviceId: string): string[] {
  return dependencies.filter(d => d.target === serviceId).map(d => d.source);
}

// Get direct neighbors only (not full chain) for hover highlighting
export function getDirectConnections(serviceId: string): Set<string> {
  const connected = new Set<string>();
  connected.add(serviceId);
  for (const dep of dependencies) {
    if (dep.source === serviceId) connected.add(dep.target);
    if (dep.target === serviceId) connected.add(dep.source);
  }
  return connected;
}

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [hoveredServiceId, setHoveredServiceId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const onServiceHover = useCallback((serviceId: string | null) => {
    setHoveredServiceId(serviceId);
    if (serviceId) {
      setHighlightedIds(getDirectConnections(serviceId));
    } else {
      setHighlightedIds(new Set());
    }
  }, []);

  return (
    <HighlightContext.Provider value={{ hoveredServiceId, highlightedIds, onServiceHover }}>
      {children}
    </HighlightContext.Provider>
  );
}
