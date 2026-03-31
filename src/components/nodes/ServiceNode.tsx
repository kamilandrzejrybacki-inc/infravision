import { memo, useState, useRef } from "react";
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
  const isHovered = hoveredServiceId === id;

  const selfColor = isDepTarget ? getDepColor(id) : null;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const showTooltip = isHovered && (badges.length > 0 || isDepTarget);

  return (
    <div
      ref={nodeRef}
      style={{
        height: "auto",
        minHeight: 28,
        padding: "4px 10px",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        color: isActive ? "hsl(220, 10%, 91%)" : "hsl(220, 12%, 46%)",
        background: isHighlighted && isHighlightActive
          ? "hsla(215, 24%, 26%, 0.65)"
          : "transparent",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        transition: "background 0.12s ease, opacity 0.18s ease",
        opacity: isDimmed ? 0.18 : (isActive ? 1 : 0.5),
        outline: isHighlighted && isHighlightActive
          ? "1px solid hsla(215, 48%, 54%, 0.35)"
          : "none",
        position: "relative",
      }}
      onMouseEnter={() => onServiceHover(id)}
      onMouseLeave={() => onServiceHover(null)}
      onMouseMove={handleMouseMove}
    >
      {/* Sync status dot */}
      {isK8s && serviceData.syncStatus && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: syncColors[serviceData.syncStatus] || syncColors.synced,
            flexShrink: 0,
          }}
        />
      )}

      {/* Dependency target dot */}
      {selfColor && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: `hsl(${selfColor})`,
            flexShrink: 0,
          }}
        />
      )}

      {/* Service name */}
      <span style={{
        fontFamily: isK8s ? "'JetBrains Mono', monospace" : "inherit",
        fontSize: isK8s ? 12 : 13,
        whiteSpace: "nowrap",
        textDecoration: isActive ? "none" : "line-through",
      }}>
        {prefix}{label}
      </span>

      {/* Not deployed badge */}
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

      {/* Small dependency indicator dots (no labels — labels go in tooltip) */}
      {badges.length > 0 && (
        <span style={{ display: "inline-flex", gap: 3, marginLeft: 2 }}>
          {badges.map(badge => (
            <span
              key={badge.targetId}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: `hsl(${badge.color})`,
                flexShrink: 0,
              }}
            />
          ))}
        </span>
      )}

      {/* Hover tooltip with dependency details */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            left: mousePos.x,
            top: mousePos.y - 8,
            transform: "translate(-50%, -100%)",
            background: "hsl(220, 20%, 13%)",
            border: "1px solid hsla(220, 18%, 32%, 0.6)",
            borderRadius: 4,
            padding: "6px 10px",
            pointerEvents: "none",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px hsla(220, 30%, 4%, 0.5)",
          }}
        >
          {badges.length > 0 && (
            <div style={{
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              color: "hsl(220, 12%, 44%)",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}>
              DEPENDS ON
            </div>
          )}
          {badges.map(badge => (
            <div
              key={badge.targetId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: `hsl(${badge.color})`,
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
            </div>
          ))}
          {isDepTarget && reverseDeps.length > 0 && (
            <>
              <div style={{
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: "hsl(220, 12%, 44%)",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginTop: badges.length > 0 ? 2 : 0,
              }}>
                USED BY
              </div>
              {reverseDeps.map(depId => (
                <div
                  key={depId}
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "hsl(220, 12%, 64%)",
                  }}
                >
                  ← {depId}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
});

ServiceNode.displayName = "ServiceNode";
export default ServiceNode;
