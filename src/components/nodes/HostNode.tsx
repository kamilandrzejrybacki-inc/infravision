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
  const { hoveredServiceId } = useHighlight();

  const physPartner = physConn ? (physConn.source === id ? physConn.target : physConn.source) : null;
  const isHighlightActive = hoveredServiceId !== null;

  return (
    <div
      style={{
        width,
        height,
        background: "hsl(220, 18%, 15%)",
        border: "1px solid hsla(220, 18%, 32%, 0.5)",
        borderLeft: `2px solid ${borderColor}`,
        borderRadius: 6,
        overflow: "visible",
        transition: "opacity 0.18s ease",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid hsla(220, 15%, 26%, 0.5)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
          minHeight: 36,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
              color: borderColor,
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 400,
              color: "hsl(220, 12%, 46%)",
              letterSpacing: "0.02em",
            }}
          >
            {ip}
          </span>
        </div>

        {physConn && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              background: "hsla(215, 45%, 52%, 0.12)",
              color: "hsl(215, 45%, 62%)",
              border: "1px solid hsla(215, 45%, 52%, 0.25)",
              letterSpacing: "0.02em",
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
