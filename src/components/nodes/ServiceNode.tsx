import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useHighlight } from "@/lib/highlight";

interface ServiceData {
  label: string;
  serviceData: {
    id: string;
    type: string;
    syncStatus?: string;
    dependencies: string[];
    active?: boolean;
  };
  isK8s: boolean;
  isLast: boolean;
}

const syncColors: Record<string, string> = {
  synced: "hsl(145, 55%, 48%)",
  "out-of-sync": "hsl(38, 78%, 54%)",
  failed: "hsl(2, 62%, 52%)",
};

const ServiceNode = memo(({ data, id }: NodeProps) => {
  const { label, serviceData, isK8s, isLast } = data as unknown as ServiceData;
  const isActive = serviceData.active !== false;
  const prefix = isK8s ? (isLast ? "└ " : "├ ") : "";
  const { hoveredServiceId, highlightedIds, onServiceHover, getDependencyBadges, getReverseDependencies, getDepColor } = useHighlight();

  const badges = getDependencyBadges(id);
  const reverseDeps = getReverseDependencies(id);
  const isDepTarget = reverseDeps.length > 0;

  const isHighlightActive = hoveredServiceId !== null;
  const isHighlighted = highlightedIds.has(id);
  const isDimmed = isHighlightActive && !isHighlighted;

  const selfColor = isDepTarget ? getDepColor(id) : null;

  return (
    <div
      style={{
        height: "auto",
        minHeight: 32,
        padding: "5px 10px",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        color: isActive ? "hsl(220, 10%, 91%)" : "hsl(220, 12%, 46%)",
        background: isHighlighted && isHighlightActive
          ? "hsla(215, 24%, 26%, 0.65)"
          : "transparent",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        transition: "background 0.12s ease, opacity 0.18s ease",
        opacity: isDimmed ? 0.18 : (isActive ? 1 : 0.5),
        outline: isHighlighted && isHighlightActive
          ? "1px solid hsla(215, 48%, 54%, 0.35)"
          : "none",
      }}
      onMouseEnter={() => onServiceHover(id)}
      onMouseLeave={() => onServiceHover(null)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {isK8s && serviceData.syncStatus && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: syncColors[serviceData.syncStatus] || syncColors.synced,
              flexShrink: 0,
              marginRight: 2,
            }}
          />
        )}
        {selfColor && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: `hsl(${selfColor})`,
              flexShrink: 0,
            }}
          />
        )}
        <span style={{
          fontFamily: isK8s ? "'JetBrains Mono', monospace" : "inherit",
          fontSize: isK8s ? 12 : 13,
          whiteSpace: "nowrap",
          textDecoration: isActive ? "none" : "line-through",
        }}>
          {prefix}{label}
        </span>
        {!isActive && (
          <span style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "1px 6px",
            borderRadius: 3,
            background: "hsla(220, 18%, 22%, 0.7)",
            color: "hsl(220, 12%, 46%)",
            border: "1px solid hsla(220, 18%, 32%, 0.5)",
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}>
            not deployed
          </span>
        )}
        {badges.map(badge => (
          <span
            key={badge.targetId}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 7px",
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              background: `hsla(${badge.color} / 0.15)`,
              color: `hsl(${badge.color})`,
              border: `1px solid hsla(${badge.color} / 0.3)`,
              lineHeight: "16px",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: `hsl(${badge.color})`,
                flexShrink: 0,
              }}
            />
            {badge.targetLabel}
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
});

ServiceNode.displayName = "ServiceNode";
export default ServiceNode;
