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
  synced: "hsl(145, 60%, 50%)",
  "out-of-sync": "hsl(40, 80%, 55%)",
  failed: "hsl(0, 65%, 55%)",
};

const ServiceNode = memo(({ data, id }: NodeProps) => {
  const { label, serviceData, isK8s, isLast } = data as unknown as ServiceData;
  const isActive = serviceData.active !== false; // undefined/true = active
  const prefix = isK8s ? (isLast ? "└ " : "├ ") : "";
  const { hoveredServiceId, highlightedIds, onServiceHover, getDependencyBadges, getReverseDependencies, getDepColor } = useHighlight();

  const badges = getDependencyBadges(id);
  const reverseDeps = getReverseDependencies(id);
  const isDepTarget = reverseDeps.length > 0;

  const isHighlightActive = hoveredServiceId !== null;
  const isHighlighted = highlightedIds.has(id);
  const isDimmed = isHighlightActive && !isHighlighted;

  // If this service IS a dependency target, show its own color dot
  const selfColor = isDepTarget ? getDepColor(id) : null;

  return (
    <div
      style={{
        height: "auto",
        minHeight: 32,
        padding: "6px 10px",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        color: isActive ? "hsla(0, 0%, 90%, 0.9)" : "hsla(220, 15%, 50%, 0.7)",
        background: isHighlighted && isHighlightActive
          ? "hsla(220, 25%, 28%, 0.6)"
          : "transparent",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        transition: "all 0.2s ease",
        opacity: isDimmed ? 0.2 : (isActive ? 1 : 0.5),
        outline: isHighlighted && isHighlightActive
          ? "1px solid hsla(210, 50%, 55%, 0.3)"
          : "none",
      }}
      onMouseEnter={() => onServiceHover(id)}
      onMouseLeave={() => onServiceHover(null)}
    >
      {/* Single row: dots + name + dependency badges inline */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {isK8s && serviceData.syncStatus && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: syncColors[serviceData.syncStatus] || syncColors.synced,
              flexShrink: 0,
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
              boxShadow: `0 0 4px hsla(${selfColor} / 0.5)`,
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
            padding: "1px 5px",
            borderRadius: 4,
            background: "hsla(220, 20%, 25%, 0.6)",
            color: "hsla(220, 15%, 50%, 0.8)",
            border: "1px solid hsla(220, 20%, 35%, 0.4)",
            whiteSpace: "nowrap",
            letterSpacing: "0.05em",
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
              borderRadius: 8,
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
