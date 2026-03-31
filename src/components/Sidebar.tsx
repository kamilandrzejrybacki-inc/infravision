import { Search } from "lucide-react";
import type { Host } from "@/data/types";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeLayers: string[];
  onToggleLayer: (layer: string) => void;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  activeHosts: string[];
  onToggleHost: (hostId: string) => void;
  showInactive: boolean;
  onToggleInactive: () => void;
  generatedAt?: string;
  tags?: string[];
  hosts?: Host[];
}

const layers = [
  { id: "physical", label: "Physical", bg: "hsl(220, 50%, 45%)" },
  { id: "services", label: "Services", bg: "hsl(25, 70%, 50%)" },
  { id: "k8s", label: "K8s", bg: "hsl(160, 45%, 42%)" },
];

export default function Sidebar({
  searchQuery, onSearchChange,
  activeLayers, onToggleLayer,
  activeTags, onToggleTag,
  activeHosts, onToggleHost,
  showInactive, onToggleInactive,
  generatedAt,
  tags = [],
  hosts = [],
}: SidebarProps) {
  return (
    <div
      style={{
        width: 240,
        height: "100vh",
        background: "hsl(222, 25%, 8%)",
        borderRight: "1px solid hsla(220, 20%, 20%, 0.6)",
        padding: "16px 14px",
        overflowY: "auto",
        flexShrink: 0,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Search */}
      <SectionLabel>SEARCH</SectionLabel>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search
          size={14}
          style={{ position: "absolute", left: 10, top: 10, color: "hsla(220, 15%, 45%, 0.6)" }}
        />
        <input
          type="text"
          placeholder="Search services, hosts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px 8px 32px",
            background: "hsla(220, 15%, 18%, 0.6)",
            border: "1px solid hsla(220, 15%, 25%, 0.5)",
            borderRadius: 6,
            color: "hsla(0, 0%, 92%, 0.95)",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Layers */}
      <SectionLabel>LAYERS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {layers.map(layer => {
          const active = activeLayers.includes(layer.id);
          return (
            <button
              key={layer.id}
              onClick={() => onToggleLayer(layer.id)}
              style={{
                height: 34,
                borderRadius: 6,
                border: "none",
                background: active ? layer.bg : "hsla(220, 15%, 20%, 0.5)",
                color: active ? "white" : "hsla(220, 15%, 55%, 0.7)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
            >
              {layer.label}
            </button>
          );
        })}
      </div>

      {/* Show inactive toggle */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onToggleInactive}
          style={{
            width: "100%",
            height: 34,
            borderRadius: 6,
            border: showInactive ? "1px solid hsla(220, 20%, 35%, 0.6)" : "1px solid transparent",
            background: showInactive ? "hsla(220, 15%, 20%, 0.5)" : "hsla(220, 15%, 16%, 0.4)",
            color: showInactive ? "hsla(220, 15%, 65%, 0.9)" : "hsla(220, 15%, 40%, 0.7)",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10 }}>{showInactive ? "◉" : "○"}</span>
          show not deployed
        </button>
      </div>

      {/* Tags */}
      <SectionLabel>TAGS</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {tags.map(tag => {
          const active = activeTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              style={{
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: 11,
                border: active ? "1px solid hsla(210, 50%, 50%, 0.5)" : "1px solid transparent",
                background: active ? "hsla(210, 40%, 35%, 0.7)" : "hsla(220, 15%, 22%, 0.6)",
                color: active ? "white" : "hsla(220, 10%, 60%, 0.8)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Hosts */}
      <SectionLabel>HOSTS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {hosts.map(host => {
          const active = activeHosts.includes(host.id);
          return (
            <label
              key={host.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: active ? "hsla(0, 0%, 90%, 0.9)" : "hsla(220, 15%, 50%, 0.6)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: `hsl(${host.color})`,
                  opacity: active ? 1 : 0.4,
                }}
              />
              <span>{host.label}</span>
            </label>
          );
        })}
      </div>

      {generatedAt && (
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid hsla(220,20%,25%,0.5)' }}>
          <span style={{ fontSize: '10px', color: 'hsla(220,15%,50%,0.6)' }}>
            Updated: {new Date(generatedAt).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "hsla(220, 15%, 50%, 0.6)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
