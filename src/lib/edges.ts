import type { Edge } from '@xyflow/react';
import type { Connection } from '../data/types';

const DEPENDENCY_EDGE_STYLE = {
  stroke: 'hsla(35, 70%, 55%, 0.6)',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
};

const PHYSICAL_EDGE_STYLE = {
  stroke: 'hsla(220, 20%, 45%, 0.4)',
  strokeWidth: 1.5,
};

const EDGE_LABEL_STYLE: { [key: string]: string | number } = {
  fontSize: '10px',
  background: 'hsla(222, 20%, 12%, 0.9)',
  padding: '2px 6px',
  borderRadius: '3px',
  color: 'hsla(220, 15%, 65%, 0.8)',
};

export function buildEdges(connections: Connection[]): Edge[] {
  return connections.map((conn, index) => {
    const isDependency = conn.type === 'dependency';
    return {
      id: `edge-${conn.source}-${conn.target}-${index}`,
      source: conn.source,
      target: conn.target,
      type: 'smoothstep',
      animated: isDependency,
      style: isDependency ? DEPENDENCY_EDGE_STYLE : PHYSICAL_EDGE_STYLE,
      label: conn.label,
      labelStyle: conn.label ? EDGE_LABEL_STYLE : undefined,
      labelBgStyle: conn.label ? { fill: 'transparent' } : undefined,
      zIndex: 0,
    };
  });
}
