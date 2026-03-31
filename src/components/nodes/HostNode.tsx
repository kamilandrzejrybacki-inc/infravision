import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useHighlight } from "@/lib/highlight";
import type { Connection } from "@/data/types";

interface HostData {
  label: string;
  ip: string;
  color: string;
  width: number;
  height: number;
  isK8sHost: boolean;
  physConn: Connection | null;
}

const HostNode = memo(({ data, id }: NodeProps) => {
  const { label, ip, color, width, height, physConn } = data as unknown as HostData;
  const borderColor = `hsl(${color})`;
  const { hoveredServiceId, highlightedIds } = useHighlight();

  // Resolve physical connection partner label from node data
  const physPartner = physConn ? (physConn.source === id ? physConn.target : physConn.source) : null;

  // Dim host if highlight is active and none of its children are highlighted
  const isHighlightActive = hoveredServiceId !== null;

  return (
    <div
      style={{
        width,
        height,
        background: "hsla(222, 20%, 14%, 0.95)",
        border: "1px solid hsla(220, 20%, 30%, 0.6)",
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 8,
        overflow: "visible",
        transition: "opacity 0.2s ease",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid hsla(220, 15%, 25%, 0.5)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              fontWeight: 600,
              color: borderColor,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 400,
              color: "hsla(220, 15%, 55%, 0.8)",
            }}
          >
            {ip}
          </span>
        </div>

        {/* Physical connection badge */}
        {physConn && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 8,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              background: "hsla(220, 45%, 55%, 0.15)",
              color: "hsl(220, 45%, 65%)",
              border: "1px solid hsla(220, 45%, 55%, 0.3)",
            }}
          >
            <span style={{ fontSize: 9 }}>⇄</span>
            {physConn.label || physPartner}
          </span>
        )}
      </div>
    </div>
  );
});

HostNode.displayName = "HostNode";
export default HostNode;
